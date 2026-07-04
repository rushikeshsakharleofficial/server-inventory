"""
Pinning tests for _aws_server_map (backend/app/routers/resource_map.py),
complexity 63 vs 15 allowed. Written before refactoring.
"""
from unittest.mock import MagicMock, patch

from app import models
from app.routers.resource_map import _aws_server_map


def _server(cloud_id="i-0123456789abcdef0", region="us-east-1"):
    return models.Server(id=1, name="aws-test", provider="aws", cloud_id=cloud_id, region=region)


def _config():
    return {"access_key_id": "AKIA...", "secret_access_key": "secret"}


def _make_ec2_client(instance: dict):
    ec2 = MagicMock()
    ec2.describe_instances.return_value = {"Reservations": [{"Instances": [instance]}]}
    ec2.describe_vpcs.return_value = {"Vpcs": [{"CidrBlock": "10.0.0.0/16", "Tags": [{"Key": "Name", "Value": "main-vpc"}]}]}
    ec2.describe_subnets.return_value = {"Subnets": [{"CidrBlock": "10.0.1.0/24", "AvailabilityZone": "us-east-1a", "Tags": []}]}
    ec2.describe_security_groups.return_value = {"SecurityGroups": [{"Description": "web sg", "IpPermissions": [1], "IpPermissionsEgress": [1, 2]}]}
    ec2.describe_addresses.return_value = {"Addresses": []}
    ec2.describe_nat_gateways.return_value = {"NatGateways": []}
    ec2.describe_route_tables.return_value = {"RouteTables": []}
    return ec2


def _empty_asg_client():
    asg = MagicMock()
    asg.describe_auto_scaling_instances.return_value = {"AutoScalingInstances": []}
    return asg


def _empty_elbv2_client():
    elbv2 = MagicMock()
    elbv2.describe_target_groups.return_value = {"TargetGroups": []}
    return elbv2


def _patched_boto3_client(ec2_client, asg_client=None, elbv2_client=None):
    asg_client = asg_client or _empty_asg_client()
    elbv2_client = elbv2_client or _empty_elbv2_client()

    def fake_client(service_name, **kwargs):
        if service_name == "ec2":
            return ec2_client
        if service_name == "autoscaling":
            return asg_client
        if service_name == "elbv2":
            return elbv2_client
        raise ValueError(f"unexpected service {service_name}")

    return fake_client


class TestAwsServerMap:
    def test_full_instance_produces_vpc_subnet_sg_eni_nodes(self):
        server = _server()
        instance = {
            "VpcId": "vpc-123",
            "SubnetId": "subnet-abc",
            "SecurityGroups": [{"GroupId": "sg-1", "GroupName": "web"}],
            "NetworkInterfaces": [
                {
                    "NetworkInterfaceId": "eni-1",
                    "PrivateIpAddress": "10.0.1.5",
                    "PrivateIpAddresses": [
                        {"PrivateIpAddress": "10.0.1.5", "Association": {"PublicIp": "3.4.5.6"}},
                        {"PrivateIpAddress": "10.0.1.6"},
                    ],
                    "MacAddress": "aa:bb",
                    "Status": "in-use",
                    "SubnetId": "subnet-abc",
                }
            ],
            "IamInstanceProfile": {"Arn": "arn:aws:iam::1:instance-profile/my-role"},
            "KeyName": "my-key",
        }
        ec2 = _make_ec2_client(instance)

        with patch("boto3.client", side_effect=_patched_boto3_client(ec2)):
            result = _aws_server_map(server, _config())

        node_types = {n["type"] for n in result["nodes"]}
        assert "vpc" in node_types
        assert "subnet" in node_types
        assert "security_group" in node_types
        assert "network_interface" in node_types
        assert "elastic_ip" in node_types  # secondary + public IPs on the ENI
        assert "iam_profile" in node_types
        assert "key_pair" in node_types

    def test_primary_describe_instances_failure_returns_empty_graph(self):
        server = _server()
        ec2 = MagicMock()
        ec2.describe_instances.side_effect = RuntimeError("not found")

        with patch("boto3.client", side_effect=_patched_boto3_client(ec2)):
            result = _aws_server_map(server, _config())

        assert result == {"nodes": [], "edges": []}

    def test_boto3_not_installed_returns_empty_graph(self):
        server = _server()
        with patch.dict("sys.modules", {"boto3": None}):
            result = _aws_server_map(server, _config())
        assert result == {"nodes": [], "edges": []}

    def test_security_group_detail_failure_still_adds_minimal_node(self):
        server = _server()
        instance = {"SecurityGroups": [{"GroupId": "sg-1", "GroupName": "web"}]}
        ec2 = _make_ec2_client(instance)
        ec2.describe_security_groups.side_effect = RuntimeError("access denied")

        with patch("boto3.client", side_effect=_patched_boto3_client(ec2)):
            result = _aws_server_map(server, _config())

        sg_nodes = [n for n in result["nodes"] if n["type"] == "security_group"]
        assert len(sg_nodes) == 1
        assert sg_nodes[0]["properties"] == {"id": "sg-1"}

    def test_vpc_lookup_failure_does_not_abort_whole_function(self):
        server = _server()
        instance = {"VpcId": "vpc-123", "KeyName": "my-key"}
        ec2 = _make_ec2_client(instance)
        ec2.describe_vpcs.side_effect = RuntimeError("throttled")

        with patch("boto3.client", side_effect=_patched_boto3_client(ec2)):
            result = _aws_server_map(server, _config())

        assert not any(n["type"] == "vpc" for n in result["nodes"])
        assert any(n["type"] == "key_pair" for n in result["nodes"])

    def test_instance_in_asg_produces_asg_node(self):
        server = _server()
        instance = {}
        ec2 = _make_ec2_client(instance)
        asg = MagicMock()
        asg.describe_auto_scaling_instances.return_value = {
            "AutoScalingInstances": [
                {"AutoScalingGroupName": "my-asg", "LifecycleState": "InService", "HealthStatus": "Healthy"}
            ]
        }

        with patch("boto3.client", side_effect=_patched_boto3_client(ec2, asg_client=asg)):
            result = _aws_server_map(server, _config())

        asg_nodes = [n for n in result["nodes"] if n["type"] == "autoscaling_group"]
        assert len(asg_nodes) == 1
        assert asg_nodes[0]["label"] == "my-asg"

    def test_instance_behind_load_balancer_produces_lb_node(self):
        server = _server()
        instance = {}
        ec2 = _make_ec2_client(instance)
        elbv2 = MagicMock()
        elbv2.describe_target_groups.return_value = {
            "TargetGroups": [{"TargetGroupArn": "arn:tg:1", "LoadBalancerArns": ["arn:lb:1"]}]
        }
        elbv2.describe_target_health.return_value = {
            "TargetHealthDescriptions": [{"Target": {"Id": server.cloud_id}}]
        }
        elbv2.describe_load_balancers.return_value = {
            "LoadBalancers": [{"LoadBalancerName": "my-lb", "DNSName": "my-lb.aws.com", "Scheme": "internet-facing", "Type": "application"}]
        }

        with patch("boto3.client", side_effect=_patched_boto3_client(ec2, elbv2_client=elbv2)):
            result = _aws_server_map(server, _config())

        lb_nodes = [n for n in result["nodes"] if n["type"] == "load_balancer"]
        assert len(lb_nodes) == 1
        assert lb_nodes[0]["label"] == "my-lb"

    def test_instance_not_in_any_target_group_produces_no_lb_node(self):
        server = _server()
        instance = {}
        ec2 = _make_ec2_client(instance)
        elbv2 = MagicMock()
        elbv2.describe_target_groups.return_value = {
            "TargetGroups": [{"TargetGroupArn": "arn:tg:1", "LoadBalancerArns": ["arn:lb:1"]}]
        }
        elbv2.describe_target_health.return_value = {
            "TargetHealthDescriptions": [{"Target": {"Id": "i-someone-else"}}]
        }

        with patch("boto3.client", side_effect=_patched_boto3_client(ec2, elbv2_client=elbv2)):
            result = _aws_server_map(server, _config())

        assert not any(n["type"] == "load_balancer" for n in result["nodes"])
