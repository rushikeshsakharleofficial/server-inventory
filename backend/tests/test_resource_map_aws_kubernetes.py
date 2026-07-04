"""
Pinning tests for _aws_kubernetes_map (backend/app/routers/resource_map.py).
Written before refactoring.
"""
from unittest.mock import MagicMock, patch

from app import models
from app.routers.resource_map import _aws_kubernetes_map


def _cluster(cloud_id="arn:aws:eks:us-east-1:1:cluster/my-cluster", region="us-east-1"):
    return models.KubernetesCluster(id=1, name="my-cluster", provider="aws", cloud_id=cloud_id, region=region)


def _config():
    return {"access_key_id": "AKIA...", "secret_access_key": "secret"}


def _cluster_data(**overrides):
    data = {
        "name": "my-cluster",
        "resourcesVpcConfig": {
            "vpcId": "vpc-1",
            "subnetIds": ["subnet-1", "subnet-2"],
            "securityGroupIds": ["sg-1"],
        },
        "roleArn": "arn:aws:iam::1:role/eks-role",
        "identity": {"oidc": {"issuer": "https://oidc.eks.amazonaws.com/id/ABC"}},
    }
    data.update(overrides)
    return data


def _make_eks_client(cluster_data, nodegroups=None, addons=None):
    eks = MagicMock()
    eks.describe_cluster.return_value = {"cluster": cluster_data}
    eks.list_nodegroups.return_value = {"nodegroups": nodegroups or []}
    eks.describe_nodegroup.return_value = {"nodegroup": {
        "instanceTypes": ["t3.medium"], "scalingConfig": {"desiredSize": 2, "minSize": 1, "maxSize": 4}, "status": "ACTIVE",
    }}
    eks.list_addons.return_value = {"addons": addons or []}
    return eks


def _make_ec2_client():
    ec2 = MagicMock()
    ec2.describe_vpcs.return_value = {"Vpcs": [{"CidrBlock": "10.0.0.0/16", "Tags": [{"Key": "Name", "Value": "main-vpc"}]}]}
    ec2.describe_subnets.return_value = {"Subnets": [{"CidrBlock": "10.0.1.0/24", "AvailabilityZone": "us-east-1a", "Tags": []}]}
    ec2.describe_security_groups.return_value = {"SecurityGroups": [{"GroupName": "eks-sg"}]}
    return ec2


def _patched_boto3_client(eks_client, ec2_client):
    def fake_client(service_name, **kwargs):
        if service_name == "eks":
            return eks_client
        if service_name == "ec2":
            return ec2_client
        raise ValueError(service_name)
    return patch("boto3.client", side_effect=fake_client)


class TestAwsKubernetesMap:
    def test_full_cluster_produces_all_node_types(self):
        cluster = _cluster()
        eks = _make_eks_client(_cluster_data(), nodegroups=["ng1"], addons=["vpc-cni"])
        ec2 = _make_ec2_client()

        with _patched_boto3_client(eks, ec2):
            result = _aws_kubernetes_map(cluster, _config())

        node_types = {n["type"] for n in result["nodes"]}
        assert "vpc" in node_types
        assert "subnet" in node_types
        assert "security_group" in node_types
        assert "iam_role" in node_types
        assert "node_group" in node_types
        assert "oidc_provider" in node_types
        assert "addon" in node_types

    def test_boto3_not_installed_returns_empty_graph(self):
        cluster = _cluster()
        with patch.dict("sys.modules", {"boto3": None}):
            result = _aws_kubernetes_map(cluster, _config())
        assert result == {"nodes": [], "edges": []}

    def test_describe_cluster_failure_returns_empty_graph(self):
        cluster = _cluster()
        eks = MagicMock()
        eks.describe_cluster.side_effect = RuntimeError("cluster not found")
        ec2 = _make_ec2_client()

        with _patched_boto3_client(eks, ec2):
            result = _aws_kubernetes_map(cluster, _config())
        assert result == {"nodes": [], "edges": []}

    def test_subnet_describe_failure_falls_back_to_bare_node(self):
        cluster = _cluster()
        eks = _make_eks_client(_cluster_data())
        ec2 = _make_ec2_client()
        ec2.describe_subnets.side_effect = RuntimeError("boom")

        with _patched_boto3_client(eks, ec2):
            result = _aws_kubernetes_map(cluster, _config())

        subnet_nodes = [n for n in result["nodes"] if n["type"] == "subnet"]
        assert len(subnet_nodes) == 2
        assert subnet_nodes[0]["label"] == "subnet-1"  # falls back to raw id

    def test_nodegroup_listing_failure_does_not_abort_whole_map(self):
        cluster = _cluster()
        eks = _make_eks_client(_cluster_data())
        eks.list_nodegroups.side_effect = RuntimeError("boom")
        ec2 = _make_ec2_client()

        with _patched_boto3_client(eks, ec2):
            result = _aws_kubernetes_map(cluster, _config())

        assert not any(n["type"] == "node_group" for n in result["nodes"])
        assert any(n["type"] == "vpc" for n in result["nodes"])  # rest of map still built

    def test_no_oidc_issuer_produces_no_oidc_node(self):
        cluster = _cluster()
        eks = _make_eks_client(_cluster_data(identity={}))
        ec2 = _make_ec2_client()

        with _patched_boto3_client(eks, ec2):
            result = _aws_kubernetes_map(cluster, _config())

        assert not any(n["type"] == "oidc_provider" for n in result["nodes"])

    def test_addons_listing_failure_does_not_abort_whole_map(self):
        cluster = _cluster()
        eks = _make_eks_client(_cluster_data())
        eks.list_addons.side_effect = RuntimeError("boom")
        ec2 = _make_ec2_client()

        with _patched_boto3_client(eks, ec2):
            result = _aws_kubernetes_map(cluster, _config())

        assert not any(n["type"] == "addon" for n in result["nodes"])
        assert any(n["type"] == "iam_role" for n in result["nodes"])
