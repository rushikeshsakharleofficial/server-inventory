"""
Pinning tests for _aws_append_one_eni (backend/app/routers/resource_map.py).
Written before refactoring.
"""
from unittest.mock import MagicMock

from app.routers.resource_map import _aws_append_one_eni


def _eni(**overrides):
    data = {
        "NetworkInterfaceId": "eni-1",
        "PrivateIpAddress": "10.0.0.5",
        "MacAddress": "aa:bb:cc",
        "Status": "in-use",
        "SubnetId": "subnet-1",
        "PrivateIpAddresses": [
            {"PrivateIpAddress": "10.0.0.5"},
            {"PrivateIpAddress": "10.0.0.6", "Association": {"PublicIp": "34.1.2.3"}},
        ],
    }
    data.update(overrides)
    return data


def _ec2_client():
    ec2 = MagicMock()
    ec2.describe_subnets.return_value = {"Subnets": [{"CidrBlock": "10.0.0.0/24", "AvailabilityZone": "us-east-1a", "Tags": [{"Key": "Name", "Value": "sub1"}]}]}
    return ec2


class TestAwsAppendOneEni:
    def test_full_eni_produces_interface_secondary_public_and_subnet_nodes(self):
        ec2 = _ec2_client()
        nodes, edges = [], []
        _aws_append_one_eni(ec2, "root", _eni(), set(), nodes, edges)

        node_types = [n["type"] for n in nodes]
        assert node_types.count("network_interface") == 1
        assert node_types.count("elastic_ip") == 2  # secondary private + public
        assert node_types.count("subnet") == 1

    def test_primary_ip_not_duplicated_as_secondary(self):
        ec2 = _ec2_client()
        nodes, edges = [], []
        _aws_append_one_eni(ec2, "root", _eni(), set(), nodes, edges)

        secondary_ids = [n["id"] for n in nodes if n["id"].startswith("sip-")]
        assert "sip-10.0.0.5" not in secondary_ids

    def test_subnet_already_seen_skips_lookup(self):
        ec2 = _ec2_client()
        nodes, edges = [], []
        _aws_append_one_eni(ec2, "root", _eni(), {"subnet-1"}, nodes, edges)

        ec2.describe_subnets.assert_not_called()
        assert not any(n["type"] == "subnet" for n in nodes)

    def test_subnet_lookup_failure_does_not_raise(self):
        ec2 = _ec2_client()
        ec2.describe_subnets.side_effect = RuntimeError("boom")
        nodes, edges = [], []
        _aws_append_one_eni(ec2, "root", _eni(), set(), nodes, edges)

        assert not any(n["type"] == "subnet" for n in nodes)

    def test_no_subnet_id_skips_subnet_lookup(self):
        ec2 = _ec2_client()
        nodes, edges = [], []
        _aws_append_one_eni(ec2, "root", _eni(SubnetId=""), set(), nodes, edges)

        ec2.describe_subnets.assert_not_called()
