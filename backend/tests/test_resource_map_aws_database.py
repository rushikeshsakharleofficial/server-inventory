"""
Pinning tests for _aws_database_map (backend/app/routers/resource_map.py).
Written before refactoring.
"""
from unittest.mock import MagicMock, patch

from app import models
from app.routers.resource_map import _aws_database_map


def _db_inst(cloud_id="db-instance-1", region="us-east-1"):
    return models.DatabaseInstance(id=1, name="aws-db", provider="aws", cloud_id=cloud_id, region=region)


def _config():
    return {"access_key_id": "AKIA...", "secret_access_key": "secret"}


def _db_instance_data(**overrides):
    data = {
        "DBSubnetGroup": {"VpcId": "vpc-1", "DBSubnetGroupName": "sg1", "DBSubnetGroupDescription": "desc", "Subnets": [1, 2]},
        "VpcSecurityGroups": [{"VpcSecurityGroupId": "sg-1"}],
        "DBParameterGroups": [{"DBParameterGroupName": "pg1", "ParameterApplyStatus": "in-sync"}],
        "MultiAZ": True,
        "ReadReplicaDBInstanceIdentifiers": ["replica-1"],
    }
    data.update(overrides)
    return data


def _make_rds_client(inst_data):
    rds = MagicMock()
    rds.describe_db_instances.return_value = {"DBInstances": [inst_data]}
    return rds


def _make_ec2_client():
    ec2 = MagicMock()
    ec2.describe_vpcs.return_value = {"Vpcs": [{"CidrBlock": "10.0.0.0/16", "Tags": [{"Key": "Name", "Value": "main-vpc"}]}]}
    ec2.describe_security_groups.return_value = {"SecurityGroups": [{"GroupName": "db-sg", "Description": "db access", "IpPermissions": [1]}]}
    return ec2


def _patched_boto3_client(rds_client, ec2_client):
    def fake_client(service_name, **kwargs):
        if service_name == "rds":
            return rds_client
        if service_name == "ec2":
            return ec2_client
        raise ValueError(service_name)
    return patch("boto3.client", side_effect=fake_client)


class TestAwsDatabaseMap:
    def test_full_instance_produces_all_node_types(self):
        db_inst = _db_inst()
        rds = _make_rds_client(_db_instance_data())
        ec2 = _make_ec2_client()

        with _patched_boto3_client(rds, ec2):
            result = _aws_database_map(db_inst, _config())

        node_types = {n["type"] for n in result["nodes"]}
        assert "vpc" in node_types
        assert "security_group" in node_types
        assert "subnet_group" in node_types
        assert "parameter_group" in node_types
        assert "availability_zone" in node_types
        assert "read_replica" in node_types

    def test_boto3_not_installed_returns_empty_graph(self):
        db_inst = _db_inst()
        with patch.dict("sys.modules", {"boto3": None}):
            result = _aws_database_map(db_inst, _config())
        assert result == {"nodes": [], "edges": []}

    def test_describe_db_instances_failure_returns_empty_graph(self):
        db_inst = _db_inst()
        rds = MagicMock()
        rds.describe_db_instances.side_effect = RuntimeError("not found")
        ec2 = _make_ec2_client()

        with _patched_boto3_client(rds, ec2):
            result = _aws_database_map(db_inst, _config())
        assert result == {"nodes": [], "edges": []}

    def test_security_group_detail_failure_still_adds_minimal_node(self):
        db_inst = _db_inst()
        rds = _make_rds_client(_db_instance_data())
        ec2 = _make_ec2_client()
        ec2.describe_security_groups.side_effect = RuntimeError("boom")

        with _patched_boto3_client(rds, ec2):
            result = _aws_database_map(db_inst, _config())

        sg_nodes = [n for n in result["nodes"] if n["type"] == "security_group"]
        assert len(sg_nodes) == 1
        assert sg_nodes[0]["label"] == "sg-1"

    def test_vpc_lookup_failure_does_not_abort_whole_map(self):
        db_inst = _db_inst()
        rds = _make_rds_client(_db_instance_data())
        ec2 = _make_ec2_client()
        ec2.describe_vpcs.side_effect = RuntimeError("boom")

        with _patched_boto3_client(rds, ec2):
            result = _aws_database_map(db_inst, _config())

        assert not any(n["type"] == "vpc" for n in result["nodes"])
        assert any(n["type"] == "subnet_group" for n in result["nodes"])

    def test_no_multi_az_no_replicas_produces_no_extra_nodes(self):
        db_inst = _db_inst()
        rds = _make_rds_client(_db_instance_data(MultiAZ=False, ReadReplicaDBInstanceIdentifiers=[]))
        ec2 = _make_ec2_client()

        with _patched_boto3_client(rds, ec2):
            result = _aws_database_map(db_inst, _config())

        node_types = {n["type"] for n in result["nodes"]}
        assert "availability_zone" not in node_types
        assert "read_replica" not in node_types
