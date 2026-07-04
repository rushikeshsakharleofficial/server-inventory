"""
Pinning tests for AWSProvider.fetch_servers and AWSProvider.fetch_block_storages
(backend/app/providers/aws.py), both radon complexity C(12). Written before refactoring.
"""
from unittest.mock import MagicMock, patch

from app.providers.aws import AWSProvider


def _config(regions=None):
    cfg = {"access_key_id": "AKIA...", "secret_access_key": "secret"}
    if regions is not None:
        cfg["regions"] = regions
    return cfg


def _paginator_client(method_name: str, pages: list[dict]):
    """Build a MagicMock EC2-like client whose paginator yields the given pages."""
    client = MagicMock()
    paginator = MagicMock()
    paginator.paginate.return_value = pages
    client.get_paginator.return_value = paginator
    getattr(client, method_name)  # sanity: attr exists on MagicMock automatically
    return client


def _patched_boto3(client):
    def fake_client(service_name, **kwargs):
        if service_name == "ec2":
            return client
        raise ValueError(f"unexpected service {service_name}")

    return fake_client


class TestFetchServers:
    def test_full_instance_maps_all_fields(self):
        instance = {
            "InstanceId": "i-123",
            "InstanceType": "t3.micro",
            "State": {"Name": "running"},
            "PublicIpAddress": "1.2.3.4",
            "PrivateIpAddress": "10.0.0.5",
            "Platform": "windows",
            "Tags": [{"Key": "Name", "Value": "web-1"}, {"Key": "env", "Value": "prod"}],
            "ImageId": "ami-1",
            "VpcId": "vpc-1",
            "KeyName": "my-key",
            "LaunchTime": "2024-01-01",
        }
        pages = [{"Reservations": [{"Instances": [instance]}]}]
        client = _paginator_client("describe_instances", pages)

        with patch("boto3.client", side_effect=_patched_boto3(client)):
            result = AWSProvider(_config(["us-east-1"])).fetch_servers()

        assert result == [{
            "cloud_id": "i-123",
            "name": "web-1",
            "provider": "aws",
            "region": "us-east-1",
            "instance_type": "t3.micro",
            "status": "running",
            "public_ip": "1.2.3.4",
            "private_ip": "10.0.0.5",
            "os": "windows",
            "tags": {"Name": "web-1", "env": "prod"},
            "extra": {
                "ami_id": "ami-1",
                "vpc_id": "vpc-1",
                "key_name": "my-key",
                "launch_time": "2024-01-01",
            },
        }]

    def test_missing_optional_fields_defaults(self):
        instance = {"InstanceId": "i-456"}
        pages = [{"Reservations": [{"Instances": [instance]}]}]
        client = _paginator_client("describe_instances", pages)

        with patch("boto3.client", side_effect=_patched_boto3(client)):
            result = AWSProvider(_config(["us-east-1"])).fetch_servers()

        s = result[0]
        assert s["cloud_id"] == "i-456"
        assert s["name"] == "i-456"  # falls back to instance id when no Name tag
        assert s["status"] == "unknown"  # missing State -> "unknown" -> STATUS_MAP miss -> "unknown"
        assert s["os"] == "linux"  # default Platform
        assert s["tags"] == {}
        assert s["public_ip"] is None
        assert s["private_ip"] is None
        assert s["extra"]["launch_time"] == ""

    def test_status_map_translation(self):
        for raw_state, expected in [
            ("shutting-down", "stopped"),
            ("stopping", "stopped"),
            ("pending", "pending"),
            ("terminated", "terminated"),
            ("weird-state", "unknown"),
        ]:
            instance = {"InstanceId": "i-1", "State": {"Name": raw_state}}
            pages = [{"Reservations": [{"Instances": [instance]}]}]
            client = _paginator_client("describe_instances", pages)
            with patch("boto3.client", side_effect=_patched_boto3(client)):
                result = AWSProvider(_config(["us-east-1"])).fetch_servers()
            assert result[0]["status"] == expected, raw_state

    def test_pagination_across_multiple_pages(self):
        pages = [
            {"Reservations": [{"Instances": [{"InstanceId": "i-1"}]}]},
            {"Reservations": [{"Instances": [{"InstanceId": "i-2"}]}]},
        ]
        client = _paginator_client("describe_instances", pages)

        with patch("boto3.client", side_effect=_patched_boto3(client)):
            result = AWSProvider(_config(["us-east-1"])).fetch_servers()

        assert [s["cloud_id"] for s in result] == ["i-1", "i-2"]

    def test_multiple_reservations_and_instances_per_page(self):
        pages = [{
            "Reservations": [
                {"Instances": [{"InstanceId": "i-1"}, {"InstanceId": "i-2"}]},
                {"Instances": [{"InstanceId": "i-3"}]},
            ]
        }]
        client = _paginator_client("describe_instances", pages)

        with patch("boto3.client", side_effect=_patched_boto3(client)):
            result = AWSProvider(_config(["us-east-1"])).fetch_servers()

        assert [s["cloud_id"] for s in result] == ["i-1", "i-2", "i-3"]

    def test_multiple_regions_aggregate_results(self):
        instance_east = {"InstanceId": "i-east"}
        instance_west = {"InstanceId": "i-west"}

        clients_by_region = {}

        def fake_client(service_name, region_name=None, **kwargs):
            assert service_name == "ec2"
            if region_name == "us-east-1":
                c = _paginator_client("describe_instances", [{"Reservations": [{"Instances": [instance_east]}]}])
            else:
                c = _paginator_client("describe_instances", [{"Reservations": [{"Instances": [instance_west]}]}])
            clients_by_region[region_name] = c
            return c

        with patch("boto3.client", side_effect=fake_client):
            result = AWSProvider(_config(["us-east-1", "us-west-2"])).fetch_servers()

        assert {(s["cloud_id"], s["region"]) for s in result} == {
            ("i-east", "us-east-1"),
            ("i-west", "us-west-2"),
        }

    def test_regions_as_comma_separated_string(self):
        instance = {"InstanceId": "i-1"}
        pages = [{"Reservations": [{"Instances": [instance]}]}]
        client = _paginator_client("describe_instances", pages)

        seen_regions = []

        def fake_client(service_name, region_name=None, **kwargs):
            seen_regions.append(region_name)
            return client

        with patch("boto3.client", side_effect=fake_client):
            AWSProvider(_config(" us-east-1 , us-west-2 ")).fetch_servers()

        assert seen_regions == ["us-east-1", "us-west-2"]

    def test_default_region_when_not_configured(self):
        instance = {"InstanceId": "i-1"}
        pages = [{"Reservations": [{"Instances": [instance]}]}]
        client = _paginator_client("describe_instances", pages)
        seen_regions = []

        def fake_client(service_name, region_name=None, **kwargs):
            seen_regions.append(region_name)
            return client

        with patch("boto3.client", side_effect=fake_client):
            AWSProvider(_config()).fetch_servers()

        assert seen_regions == ["us-east-1"]

    def test_no_instances_returns_empty_list(self):
        client = _paginator_client("describe_instances", [{"Reservations": []}])
        with patch("boto3.client", side_effect=_patched_boto3(client)):
            result = AWSProvider(_config(["us-east-1"])).fetch_servers()
        assert result == []

    def test_boto3_not_installed_raises_runtime_error(self):
        with patch.dict("sys.modules", {"boto3": None}):
            try:
                AWSProvider(_config(["us-east-1"])).fetch_servers()
                assert False, "expected RuntimeError"
            except RuntimeError as e:
                assert "boto3 not installed" in str(e)


def _volume_paginator_client(pages: list[dict]):
    client = MagicMock()
    paginator = MagicMock()
    paginator.paginate.return_value = pages
    client.get_paginator.return_value = paginator
    return client


class TestFetchBlockStorages:
    def test_full_volume_maps_all_fields(self):
        vol = {
            "VolumeId": "vol-123",
            "Size": 100,
            "State": "in-use",
            "VolumeType": "gp3",
            "Tags": [{"Key": "Name", "Value": "data-vol"}, {"Key": "env", "Value": "prod"}],
            "Attachments": [{"InstanceId": "i-1"}],
            "AvailabilityZone": "us-east-1a",
            "CreateTime": "2024-01-01",
            "Encrypted": True,
            "Iops": 3000,
            "Throughput": 125,
        }
        client = _volume_paginator_client([{"Volumes": [vol]}])

        with patch("boto3.client", side_effect=_patched_boto3(client)):
            result = AWSProvider(_config(["us-east-1"])).fetch_block_storages()

        assert result == [{
            "cloud_id": "vol-123",
            "name": "data-vol",
            "provider": "aws",
            "region": "us-east-1",
            "size_gb": 100.0,
            "status": "running",
            "attachment": "i-1",
            "volume_type": "gp3",
            "tags": {"Name": "data-vol", "env": "prod"},
            "extra": {
                "availability_zone": "us-east-1a",
                "created_at": "2024-01-01",
                "encrypted": True,
                "iops": 3000,
                "throughput": 125,
            },
        }]

    def test_missing_optional_fields_defaults(self):
        vol = {"VolumeId": "vol-456"}
        client = _volume_paginator_client([{"Volumes": [vol]}])

        with patch("boto3.client", side_effect=_patched_boto3(client)):
            result = AWSProvider(_config(["us-east-1"])).fetch_block_storages()

        v = result[0]
        assert v["name"] == "vol-456"
        assert v["size_gb"] == 0.0
        assert v["status"] == "unknown"
        assert v["attachment"] is None
        assert v["tags"] == {}
        assert v["extra"]["created_at"] == ""

    def test_status_map_translation(self):
        for raw_state, expected in [
            ("available", "available"),
            ("creating", "pending"),
            ("deleting", "terminated"),
            ("error", "stopped"),
            ("weird", "unknown"),
        ]:
            vol = {"VolumeId": "vol-1", "State": raw_state}
            client = _volume_paginator_client([{"Volumes": [vol]}])
            with patch("boto3.client", side_effect=_patched_boto3(client)):
                result = AWSProvider(_config(["us-east-1"])).fetch_block_storages()
            assert result[0]["status"] == expected, raw_state

    def test_no_attachments_gives_none(self):
        vol = {"VolumeId": "vol-1", "Attachments": []}
        client = _volume_paginator_client([{"Volumes": [vol]}])
        with patch("boto3.client", side_effect=_patched_boto3(client)):
            result = AWSProvider(_config(["us-east-1"])).fetch_block_storages()
        assert result[0]["attachment"] is None

    def test_pagination_across_multiple_pages(self):
        pages = [
            {"Volumes": [{"VolumeId": "vol-1"}]},
            {"Volumes": [{"VolumeId": "vol-2"}]},
        ]
        client = _volume_paginator_client(pages)
        with patch("boto3.client", side_effect=_patched_boto3(client)):
            result = AWSProvider(_config(["us-east-1"])).fetch_block_storages()
        assert [v["cloud_id"] for v in result] == ["vol-1", "vol-2"]

    def test_multiple_regions_aggregate_results(self):
        def fake_client(service_name, region_name=None, **kwargs):
            vol_id = "vol-east" if region_name == "us-east-1" else "vol-west"
            return _volume_paginator_client([{"Volumes": [{"VolumeId": vol_id}]}])

        with patch("boto3.client", side_effect=fake_client):
            result = AWSProvider(_config(["us-east-1", "us-west-2"])).fetch_block_storages()

        assert {(v["cloud_id"], v["region"]) for v in result} == {
            ("vol-east", "us-east-1"),
            ("vol-west", "us-west-2"),
        }

    def test_region_failure_is_skipped_not_raised(self):
        good_client = _volume_paginator_client([{"Volumes": [{"VolumeId": "vol-ok"}]}])

        def fake_client(service_name, region_name=None, **kwargs):
            if region_name == "us-east-1":
                bad = MagicMock()
                bad.get_paginator.side_effect = RuntimeError("access denied")
                return bad
            return good_client

        with patch("boto3.client", side_effect=fake_client):
            result = AWSProvider(_config(["us-east-1", "us-west-2"])).fetch_block_storages()

        assert [v["cloud_id"] for v in result] == ["vol-ok"]

    def test_no_volumes_returns_empty_list(self):
        client = _volume_paginator_client([{"Volumes": []}])
        with patch("boto3.client", side_effect=_patched_boto3(client)):
            result = AWSProvider(_config(["us-east-1"])).fetch_block_storages()
        assert result == []

    def test_boto3_not_installed_raises_import_error(self):
        # fetch_block_storages does `import boto3` unconditionally without try/except,
        # so a missing module surfaces as ImportError (unlike fetch_servers).
        with patch.dict("sys.modules", {"boto3": None}):
            try:
                AWSProvider(_config(["us-east-1"])).fetch_block_storages()
                assert False, "expected ImportError"
            except ImportError:
                pass
