from typing import Annotated, Any
import time

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from .. import models
from ..auth import get_current_user
from ..database import get_db
from ..providers import get_provider
from ..crypto import decrypt_config

# ── in-process TTL cache (5 min) for expensive cloud API calls ────────────────
_CACHE_TTL = 300  # seconds
_cache: dict[str, tuple[float, dict]] = {}  # key → (expires_at, payload)


def _cache_get(key: str) -> dict | None:
    entry = _cache.get(key)
    if entry and entry[0] > time.monotonic():
        return entry[1]
    _cache.pop(key, None)
    return None


def _cache_set(key: str, value: dict) -> None:
    _cache[key] = (time.monotonic() + _CACHE_TTL, value)

router = APIRouter(prefix="/api/resource-map", tags=["resource-map"])

_IN_VPC = "in VPC"
_READ_REPLICA = "read replica"
_SERVICE_ACCOUNT = "service account"
_NODE_POOL = "node pool"


def _get_cred_for_provider(db: Session, provider: str) -> models.Credential | None:
    """Return the first active credential for *provider*, or None."""
    return db.query(models.Credential).filter(
        models.Credential.provider == provider,
        models.Credential.is_active.is_(True),
    ).first()


# ── node/edge helpers ──────────────────────────────────────────────────────────

def _node(
    id: str,
    type: str,
    category: str,
    label: str,
    props: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Build a resource-map node dict."""
    return {"id": id, "type": type, "category": category, "label": label, "properties": props or {}}


def _edge(src: str, dst: str, label: str = "") -> dict[str, str]:
    """Build a resource-map edge dict."""
    return {"from": src, "to": dst, "label": label}


# ── AWS ───────────────────────────────────────────────────────────────────────

def _aws_server_map(server: models.Server, config: dict) -> dict:
    try:
        import boto3
    except ImportError:
        return {"nodes": [], "edges": []}

    access_key = config.get("access_key_id")
    secret_key = config.get("secret_access_key")
    region = server.region or "us-east-1"

    ec2 = boto3.client("ec2", region_name=region,
                       aws_access_key_id=access_key, aws_secret_access_key=secret_key)

    root_id = f"server-{server.id}"
    nodes, edges = [], []

    try:
        resp = ec2.describe_instances(InstanceIds=[server.cloud_id])
        instance = resp["Reservations"][0]["Instances"][0]
    except Exception:
        return {"nodes": [], "edges": []}

    # VPC
    vpc_id = instance.get("VpcId")
    if vpc_id:
        try:
            vpc_data = ec2.describe_vpcs(VpcIds=[vpc_id])["Vpcs"][0]
            vpc_name = next((t["Value"] for t in vpc_data.get("Tags", []) if t["Key"] == "Name"), vpc_id)
            nodes.append(_node(vpc_id, "vpc", "network", vpc_name, {"cidr": vpc_data.get("CidrBlock"), "id": vpc_id}))
            edges.append(_edge(root_id, vpc_id, _IN_VPC))
        except Exception:
            pass

    # Subnet
    subnet_id = instance.get("SubnetId")
    if subnet_id:
        try:
            sub_data = ec2.describe_subnets(SubnetIds=[subnet_id])["Subnets"][0]
            sub_name = next((t["Value"] for t in sub_data.get("Tags", []) if t["Key"] == "Name"), subnet_id)
            nodes.append(_node(subnet_id, "subnet", "network", sub_name, {"cidr": sub_data.get("CidrBlock"), "az": sub_data.get("AvailabilityZone"), "id": subnet_id}))
            edges.append(_edge(root_id, subnet_id, "in subnet"))
        except Exception:
            pass

    # Security Groups
    for sg in instance.get("SecurityGroups", []):
        sg_id = sg["GroupId"]
        sg_name = sg.get("GroupName", sg_id)
        try:
            sg_detail = ec2.describe_security_groups(GroupIds=[sg_id])["SecurityGroups"][0]
            in_count = len(sg_detail.get("IpPermissions", []))
            out_count = len(sg_detail.get("IpPermissionsEgress", []))
            nodes.append(_node(sg_id, "security_group", "security", sg_name, {"description": sg_detail.get("Description", ""), "inbound_rules": in_count, "outbound_rules": out_count, "id": sg_id}))
        except Exception:
            nodes.append(_node(sg_id, "security_group", "security", sg_name, {"id": sg_id}))
        edges.append(_edge(root_id, sg_id, "member of"))

    # Network Interfaces — including ALL private IPs and attached subnets
    seen_subnets = {subnet_id} if subnet_id else set()
    for eni in instance.get("NetworkInterfaces", []):
        eni_id = eni["NetworkInterfaceId"]
        primary_ip = eni.get("PrivateIpAddress", "")
        # Collect all private IPs (primary + secondary)
        all_private_ips = [a["PrivateIpAddress"] for a in eni.get("PrivateIpAddresses", []) if a.get("PrivateIpAddress")]
        # Public IPs on this ENI
        all_public_ips = [a["Association"]["PublicIp"] for a in eni.get("PrivateIpAddresses", []) if a.get("Association", {}).get("PublicIp")]
        nodes.append(_node(eni_id, "network_interface", "network", f"ENI {primary_ip}", {
            "mac": eni.get("MacAddress", ""),
            "primary_ip": primary_ip,
            "all_private_ips": all_private_ips,
            "public_ips": all_public_ips,
            "status": eni.get("Status", ""),
            "id": eni_id,
        }))
        edges.append(_edge(root_id, eni_id, "has NIC"))

        # Show each secondary private IP as its own node
        for ip in all_private_ips:
            if ip != primary_ip:
                nodes.append(_node(f"sip-{ip}", "elastic_ip", "network", f"Secondary IP {ip}", {"type": "secondary private IP"}))
                edges.append(_edge(eni_id, f"sip-{ip}", "secondary IP"))

        # Show public IPs attached to this ENI
        for pub_ip in all_public_ips:
            nodes.append(_node(f"pub-{pub_ip}", "elastic_ip", "network", pub_ip, {"type": "public IP via ENI"}))
            edges.append(_edge(eni_id, f"pub-{pub_ip}", "public IP"))

        # Additional subnets from ENI (if different from primary)
        eni_subnet = eni.get("SubnetId", "")
        if eni_subnet and eni_subnet not in seen_subnets:
            seen_subnets.add(eni_subnet)
            try:
                sub_data = ec2.describe_subnets(SubnetIds=[eni_subnet])["Subnets"][0]
                sub_name = next((t["Value"] for t in sub_data.get("Tags", []) if t["Key"] == "Name"), eni_subnet)
                nodes.append(_node(eni_subnet, "subnet", "network", sub_name, {
                    "cidr": sub_data.get("CidrBlock"), "az": sub_data.get("AvailabilityZone"), "id": eni_subnet
                }))
                edges.append(_edge(eni_id, eni_subnet, "in subnet"))
            except Exception:
                pass

    # IAM Instance Profile
    iam_profile = instance.get("IamInstanceProfile")
    if iam_profile:
        arn = iam_profile.get("Arn", "")
        profile_name = arn.split("/")[-1] if "/" in arn else arn
        nodes.append(_node(arn, "iam_profile", "iam", profile_name, {"arn": arn}))
        edges.append(_edge(root_id, arn, "uses role"))

    # Key Pair
    key_name = instance.get("KeyName")
    if key_name:
        nodes.append(_node(f"key-{key_name}", "key_pair", "security", key_name, {"name": key_name}))
        edges.append(_edge(root_id, f"key-{key_name}", "SSH key"))

    # Elastic IPs
    try:
        eips = ec2.describe_addresses(Filters=[{"Name": "instance-id", "Values": [server.cloud_id]}])["Addresses"]
        for eip in eips:
            eip_id = eip.get("AllocationId", eip.get("PublicIp", ""))
            nodes.append(_node(eip_id, "elastic_ip", "network", eip.get("PublicIp", eip_id), {"allocation_id": eip.get("AllocationId"), "domain": eip.get("Domain")}))
            edges.append(_edge(root_id, eip_id, "Elastic IP"))
    except Exception:
        pass

    # NAT Gateways in the same VPC
    if vpc_id:
        try:
            nats = ec2.describe_nat_gateways(Filters=[{"Name": "vpc-id", "Values": [vpc_id]}, {"Name": "state", "Values": ["available"]}])["NatGateways"]
            for nat in nats:
                nat_id = nat["NatGatewayId"]
                nat_subnet = nat.get("SubnetId", "")
                nat_ip = nat.get("NatGatewayAddresses", [{}])[0].get("PublicIp", "")
                nodes.append(_node(nat_id, "nat_gateway", "network", f"NAT {nat_ip}", {"subnet": nat_subnet, "public_ip": nat_ip, "state": nat.get("State"), "id": nat_id}))
                edges.append(_edge(vpc_id, nat_id, "NAT gateway"))
        except Exception:
            pass

    # Auto Scaling Group
    try:
        import boto3
        asg_client = boto3.client("autoscaling", region_name=region,
                                  aws_access_key_id=access_key, aws_secret_access_key=secret_key)
        asg_resp = asg_client.describe_auto_scaling_instances(InstanceIds=[server.cloud_id])
        for asg_inst in asg_resp.get("AutoScalingInstances", []):
            asg_name = asg_inst["AutoScalingGroupName"]
            nodes.append(_node(f"asg-{asg_name}", "autoscaling_group", "compute", asg_name, {"lifecycle": asg_inst.get("LifecycleState"), "health": asg_inst.get("HealthStatus")}))
            edges.append(_edge(root_id, f"asg-{asg_name}", "in ASG"))
    except Exception:
        pass

    # Load Balancers (ELB v2)
    try:
        elbv2 = boto3.client("elbv2", region_name=region,
                             aws_access_key_id=access_key, aws_secret_access_key=secret_key)
        # Get target groups
        tg_resp = elbv2.describe_target_groups()
        for tg in tg_resp.get("TargetGroups", []):
            tg_arn = tg["TargetGroupArn"]
            try:
                health = elbv2.describe_target_health(TargetGroupArn=tg_arn)
                for t in health.get("TargetHealthDescriptions", []):
                    if t["Target"]["Id"] == server.cloud_id:
                        # This instance is in this target group — get its LBs
                        for lb_arn in tg.get("LoadBalancerArns", []):
                            lb_resp = elbv2.describe_load_balancers(LoadBalancerArns=[lb_arn])
                            for lb in lb_resp.get("LoadBalancers", []):
                                lb_name = lb["LoadBalancerName"]
                                nodes.append(_node(lb_arn, "load_balancer", "network", lb_name, {
                                    "dns": lb.get("DNSName"), "scheme": lb.get("Scheme"), "type": lb.get("Type")
                                }))
                                edges.append(_edge(root_id, lb_arn, "behind LB"))
            except Exception:
                continue
    except Exception:
        pass

    # Route Tables
    if subnet_id:
        try:
            rt_resp = ec2.describe_route_tables(Filters=[{"Name": "association.subnet-id", "Values": [subnet_id]}])
            for rt in rt_resp.get("RouteTables", []):
                rt_id = rt["RouteTableId"]
                rt_name = next((t["Value"] for t in rt.get("Tags", []) if t["Key"] == "Name"), rt_id)
                nodes.append(_node(rt_id, "route_table", "network", rt_name, {"routes": len(rt.get("Routes", [])), "id": rt_id}))
                edges.append(_edge(subnet_id, rt_id, "route table"))
        except Exception:
            pass

    return {"nodes": nodes, "edges": edges}


def _aws_database_map(db_inst: models.DatabaseInstance, config: dict) -> dict:
    try:
        import boto3
    except ImportError:
        return {"nodes": [], "edges": []}

    access_key = config.get("access_key_id")
    secret_key = config.get("secret_access_key")
    region = db_inst.region or "us-east-1"

    rds = boto3.client("rds", region_name=region, aws_access_key_id=access_key, aws_secret_access_key=secret_key)
    ec2 = boto3.client("ec2", region_name=region, aws_access_key_id=access_key, aws_secret_access_key=secret_key)

    root_id = f"db-{db_inst.id}"
    nodes, edges = [], []

    try:
        resp = rds.describe_db_instances(DBInstanceIdentifier=db_inst.cloud_id)
        inst = resp["DBInstances"][0]
    except Exception:
        return {"nodes": [], "edges": []}

    # VPC
    vpc_id = inst.get("DBSubnetGroup", {}).get("VpcId")
    if vpc_id:
        try:
            vpc_data = ec2.describe_vpcs(VpcIds=[vpc_id])["Vpcs"][0]
            vpc_name = next((t["Value"] for t in vpc_data.get("Tags", []) if t["Key"] == "Name"), vpc_id)
            nodes.append(_node(vpc_id, "vpc", "network", vpc_name, {"cidr": vpc_data.get("CidrBlock"), "id": vpc_id}))
            edges.append(_edge(root_id, vpc_id, _IN_VPC))
        except Exception:
            pass

    # Security Groups
    for sg in inst.get("VpcSecurityGroups", []):
        sg_id = sg["VpcSecurityGroupId"]
        try:
            sg_detail = ec2.describe_security_groups(GroupIds=[sg_id])["SecurityGroups"][0]
            nodes.append(_node(sg_id, "security_group", "security", sg_detail.get("GroupName", sg_id), {
                "description": sg_detail.get("Description", ""), "inbound_rules": len(sg_detail.get("IpPermissions", [])), "id": sg_id
            }))
        except Exception:
            nodes.append(_node(sg_id, "security_group", "security", sg_id, {"id": sg_id}))
        edges.append(_edge(root_id, sg_id, "member of"))

    # Subnet Group
    sg_group = inst.get("DBSubnetGroup", {})
    if sg_group:
        sg_name = sg_group.get("DBSubnetGroupName", "")
        nodes.append(_node(f"subnet-group-{sg_name}", "subnet_group", "network", sg_name, {
            "description": sg_group.get("DBSubnetGroupDescription", ""), "subnets": len(sg_group.get("Subnets", []))
        }))
        edges.append(_edge(root_id, f"subnet-group-{sg_name}", "subnet group"))

    # Parameter Group
    for pg in inst.get("DBParameterGroups", []):
        pg_name = pg.get("DBParameterGroupName", "")
        nodes.append(_node(f"pg-{pg_name}", "parameter_group", "config", pg_name, {"status": pg.get("ParameterApplyStatus")}))
        edges.append(_edge(root_id, f"pg-{pg_name}", "parameter group"))

    # Multi-AZ / Read Replicas
    if inst.get("MultiAZ"):
        nodes.append(_node("multi-az", "availability_zone", "compute", "Multi-AZ Standby", {"enabled": True}))
        edges.append(_edge(root_id, "multi-az", "standby replica"))

    for replica_id in inst.get("ReadReplicaDBInstanceIdentifiers", []):
        nodes.append(_node(f"replica-{replica_id}", "read_replica", "compute", replica_id, {}))
        edges.append(_edge(root_id, f"replica-{replica_id}", _READ_REPLICA))

    return {"nodes": nodes, "edges": edges}


def _aws_kubernetes_map(cluster: models.KubernetesCluster, config: dict) -> dict:
    try:
        import boto3
    except ImportError:
        return {"nodes": [], "edges": []}

    access_key = config.get("access_key_id")
    secret_key = config.get("secret_access_key")
    region = cluster.region or "us-east-1"

    eks = boto3.client("eks", region_name=region, aws_access_key_id=access_key, aws_secret_access_key=secret_key)
    ec2 = boto3.client("ec2", region_name=region, aws_access_key_id=access_key, aws_secret_access_key=secret_key)

    root_id = f"k8s-{cluster.id}"
    nodes, edges = [], []

    try:
        c = eks.describe_cluster(name=cluster.cloud_id.split("/")[-1] if cluster.cloud_id else cluster.name)["cluster"]
    except Exception:
        return {"nodes": [], "edges": []}

    resources_vpc = c.get("resourcesVpcConfig", {})

    # VPC
    vpc_id = resources_vpc.get("vpcId")
    if vpc_id:
        try:
            vpc_data = ec2.describe_vpcs(VpcIds=[vpc_id])["Vpcs"][0]
            vpc_name = next((t["Value"] for t in vpc_data.get("Tags", []) if t["Key"] == "Name"), vpc_id)
            nodes.append(_node(vpc_id, "vpc", "network", vpc_name, {"cidr": vpc_data.get("CidrBlock"), "id": vpc_id}))
            edges.append(_edge(root_id, vpc_id, _IN_VPC))
        except Exception:
            pass

    # Subnets
    for subnet_id in resources_vpc.get("subnetIds", [])[:5]:
        try:
            sub_data = ec2.describe_subnets(SubnetIds=[subnet_id])["Subnets"][0]
            sub_name = next((t["Value"] for t in sub_data.get("Tags", []) if t["Key"] == "Name"), subnet_id)
            nodes.append(_node(subnet_id, "subnet", "network", sub_name, {"cidr": sub_data.get("CidrBlock"), "az": sub_data.get("AvailabilityZone"), "id": subnet_id}))
            edges.append(_edge(root_id, subnet_id, "subnet"))
        except Exception:
            nodes.append(_node(subnet_id, "subnet", "network", subnet_id, {}))
            edges.append(_edge(root_id, subnet_id, "subnet"))

    # Security Groups
    for sg_id in resources_vpc.get("securityGroupIds", []):
        try:
            sg_detail = ec2.describe_security_groups(GroupIds=[sg_id])["SecurityGroups"][0]
            nodes.append(_node(sg_id, "security_group", "security", sg_detail.get("GroupName", sg_id), {"id": sg_id}))
        except Exception:
            nodes.append(_node(sg_id, "security_group", "security", sg_id, {}))
        edges.append(_edge(root_id, sg_id, "security group"))

    # IAM Role
    role_arn = c.get("roleArn")
    if role_arn:
        role_name = role_arn.split("/")[-1]
        nodes.append(_node(role_arn, "iam_role", "iam", role_name, {"arn": role_arn}))
        edges.append(_edge(root_id, role_arn, "cluster role"))

    # Nodegroups
    try:
        ng_names = eks.list_nodegroups(clusterName=c["name"]).get("nodegroups", [])
        for ng_name in ng_names[:8]:
            ng = eks.describe_nodegroup(clusterName=c["name"], nodegroupName=ng_name)["nodegroup"]
            nodes.append(_node(f"ng-{ng_name}", "node_group", "compute", ng_name, {
                "instance_types": ng.get("instanceTypes", []),
                "desired": ng.get("scalingConfig", {}).get("desiredSize"),
                "min": ng.get("scalingConfig", {}).get("minSize"),
                "max": ng.get("scalingConfig", {}).get("maxSize"),
                "status": ng.get("status"),
            }))
            edges.append(_edge(root_id, f"ng-{ng_name}", "node group"))
    except Exception:
        pass

    # OIDC
    oidc = c.get("identity", {}).get("oidc", {}).get("issuer")
    if oidc:
        nodes.append(_node("oidc", "oidc_provider", "iam", "OIDC Provider", {"issuer": oidc}))
        edges.append(_edge(root_id, "oidc", "OIDC"))

    # Add-ons
    try:
        addons = eks.list_addons(clusterName=c["name"]).get("addons", [])
        for addon in addons:
            nodes.append(_node(f"addon-{addon}", "addon", "config", addon, {}))
            edges.append(_edge(root_id, f"addon-{addon}", "addon"))
    except Exception:
        pass

    return {"nodes": nodes, "edges": edges}


# ── GCP helpers ───────────────────────────────────────────────────────────────

def _gcp_token(config: dict[str, Any]) -> tuple[str, str]:
    """Return (access_token, project_id) for a GCP service-account config."""
    import json
    sa = config.get("service_account_json", {})
    if isinstance(sa, str):
        sa = json.loads(sa)
    from google.oauth2 import service_account
    from google.auth.transport.requests import Request as GRequest
    creds = service_account.Credentials.from_service_account_info(
        sa, scopes=["https://www.googleapis.com/auth/cloud-platform"]
    )
    creds.refresh(GRequest())
    token: str = creds.token
    project_id: str = sa.get("project_id", config.get("project_id", ""))
    return token, project_id


def _gcp_server_map(server: models.Server, config: dict) -> dict:
    import requests
    root_id = f"server-{server.id}"
    nodes, edges = [], []
    try:
        token, project_id = _gcp_token(config)
    except Exception:
        return {"nodes": [], "edges": []}

    headers: dict[str, str | bytes] = {"Authorization": f"Bearer {token}"}
    zone = server.zone or server.region or ""

    # Get instance details
    if server.cloud_id and zone:
        try:
            instance_name = server.cloud_id
            url = f"https://compute.googleapis.com/compute/v1/projects/{project_id}/zones/{zone}/instances/{instance_name}"
            resp = requests.get(url, headers=headers, timeout=20)
            if resp.ok:
                inst = resp.json()
                # Network interfaces — all IPs and subnets
                for nic_idx, nic in enumerate(inst.get("networkInterfaces", [])):
                    net_url = nic.get("network", "")
                    net_name = net_url.split("/")[-1] if net_url else "unknown"
                    sub_url = nic.get("subnetwork", "")
                    sub_name = sub_url.split("/")[-1] if sub_url else "unknown"
                    nic_internal_ip = nic.get("networkIP", "")
                    nodes.append(_node(net_name, "vpc_network", "network", net_name, {"network": net_url}))
                    edges.append(_edge(root_id, net_name, "VPC network"))
                    nodes.append(_node(f"{sub_name}-{nic_idx}", "subnetwork", "network", sub_name,
                                       {"subnetwork": sub_url, "internal_ip": nic_internal_ip}))
                    edges.append(_edge(root_id, f"{sub_name}-{nic_idx}", "subnetwork"))
                    # Primary internal IP
                    if nic_internal_ip:
                        nodes.append(_node(f"int-ip-{nic_internal_ip}", "elastic_ip", "network",
                                           f"Internal {nic_internal_ip}", {"type": "internal IP", "nic": nic_idx}))
                        edges.append(_edge(f"{sub_name}-{nic_idx}", f"int-ip-{nic_internal_ip}", "internal IP"))
                    # Alias IPs (additional subnets/IPs on this NIC)
                    for alias in nic.get("aliasIpRanges", []):
                        alias_ip = alias.get("ipCidrRange", "")
                        nodes.append(_node(f"alias-{alias_ip}", "subnet", "network",
                                           f"Alias {alias_ip}", {"cidr": alias_ip, "subnetwork_range": alias.get("subnetworkRangeName", "")}))
                        edges.append(_edge(f"{sub_name}-{nic_idx}", f"alias-{alias_ip}", "alias IP range"))
                    # Access configs (external IPs)
                    for ac in nic.get("accessConfigs", []):
                        if ac.get("natIP"):
                            nodes.append(_node(f"ext-ip-{ac['natIP']}", "external_ip", "network",
                                               ac["natIP"], {"type": ac.get("type"), "name": ac.get("name"), "nic": nic_idx}))
                            edges.append(_edge(root_id, f"ext-ip-{ac['natIP']}", "external IP"))

                # Service Account
                for sa_entry in inst.get("serviceAccounts", []):
                    sa_email = sa_entry.get("email", "")
                    nodes.append(_node(sa_email, "service_account", "iam", sa_email, {"scopes": sa_entry.get("scopes", [])}))
                    edges.append(_edge(root_id, sa_email, _SERVICE_ACCOUNT))

                # Tags (used for firewall rules)
                tags_list = inst.get("tags", {}).get("items", [])
                if tags_list:
                    # Fetch firewall rules matching any tag
                    fw_url = f"https://compute.googleapis.com/compute/v1/projects/{project_id}/global/firewalls"
                    fw_resp = requests.get(fw_url, headers=headers, timeout=15)
                    if fw_resp.ok:
                        for fw in fw_resp.json().get("items", []):
                            target_tags = fw.get("targetTags", [])
                            if any(t in tags_list for t in target_tags):
                                fw_name = fw["name"]
                                nodes.append(_node(fw_name, "firewall_rule", "security", fw_name, {
                                    "direction": fw.get("direction"),
                                    "priority": fw.get("priority"),
                                    "description": fw.get("description", ""),
                                }))
                                edges.append(_edge(root_id, fw_name, "firewall rule"))

                # Disk info
                for disk in inst.get("disks", [])[:3]:
                    disk_url = disk.get("source", "")
                    disk_name = disk_url.split("/")[-1] if disk_url else "disk"
                    nodes.append(_node(disk_name, "disk", "storage", disk_name, {"boot": disk.get("boot"), "type": disk.get("type"), "mode": disk.get("mode")}))
                    edges.append(_edge(root_id, disk_name, "disk"))
        except Exception:
            pass

    return {"nodes": nodes, "edges": edges}


def _gcp_kubernetes_map(cluster: models.KubernetesCluster, config: dict) -> dict:
    import requests
    root_id = f"k8s-{cluster.id}"
    nodes, edges = [], []
    try:
        token, project_id = _gcp_token(config)
    except Exception:
        return {"nodes": [], "edges": []}

    headers: dict[str, str | bytes] = {"Authorization": f"Bearer {token}"}
    location = cluster.region or "-"
    cluster_name = cluster.name

    try:
        url = f"https://container.googleapis.com/v1/projects/{project_id}/locations/{location}/clusters/{cluster_name}"
        resp = requests.get(url, headers=headers, timeout=20)
        if not resp.ok:
            return {"nodes": [], "edges": []}
        c = resp.json()

        # Network
        net = c.get("network")
        if net:
            nodes.append(_node(net, "vpc_network", "network", net, {}))
            edges.append(_edge(root_id, net, "VPC network"))
        sub = c.get("subnetwork")
        if sub:
            nodes.append(_node(sub, "subnetwork", "network", sub, {}))
            edges.append(_edge(root_id, sub, "subnetwork"))

        # Node pools
        for pool in c.get("nodePools", []):
            pool_name = pool["name"]
            nodes.append(_node(f"pool-{pool_name}", "node_pool", "compute", pool_name, {
                "machine_type": pool.get("config", {}).get("machineType"),
                "disk_gb": pool.get("config", {}).get("diskSizeGb"),
                "count": pool.get("initialNodeCount"),
                "status": pool.get("status"),
            }))
            edges.append(_edge(root_id, f"pool-{pool_name}", _NODE_POOL))

        # Service account
        sa = c.get("nodeConfig", {}).get("serviceAccount")
        if sa:
            nodes.append(_node(sa, "service_account", "iam", sa, {}))
            edges.append(_edge(root_id, sa, _SERVICE_ACCOUNT))

        # Workload identity
        wi = c.get("workloadIdentityConfig", {}).get("workloadPool")
        if wi:
            nodes.append(_node("workload-identity", "workload_identity", "iam", "Workload Identity", {"pool": wi}))
            edges.append(_edge(root_id, "workload-identity", "workload identity"))

    except Exception:
        pass

    return {"nodes": nodes, "edges": edges}


# ── Azure helpers ─────────────────────────────────────────────────────────────

def _az_token(config: dict) -> tuple:
    import requests
    tenant_id = config["tenant_id"]
    url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
    data = {"grant_type": "client_credentials", "client_id": config["client_id"],
            "client_secret": config["client_secret"], "scope": "https://management.azure.com/.default"}
    resp = requests.post(url, data=data, timeout=15)
    resp.raise_for_status()
    return resp.json()["access_token"], config["subscription_id"]


def _azure_server_map(server: models.Server, config: dict) -> dict:
    import requests
    root_id = f"server-{server.id}"
    nodes, edges = [], []
    try:
        token, _ = _az_token(config)
    except Exception:
        return {"nodes": [], "edges": []}

    headers: dict[str, str | bytes] = {"Authorization": f"Bearer {token}"}
    if not server.cloud_id:
        return {"nodes": [], "edges": []}

    vm_url = f"https://management.azure.com{server.cloud_id}?api-version=2023-03-01&$expand=instanceView"
    try:
        vm = requests.get(vm_url, headers=headers, timeout=20).json()
        props = vm.get("properties", {})

        # Network interfaces
        for nic_ref in props.get("networkProfile", {}).get("networkInterfaces", []):
            nic_id = nic_ref["id"]
            nic_url = f"https://management.azure.com{nic_id}?api-version=2023-05-01"
            try:
                nic = requests.get(nic_url, headers=headers, timeout=15).json()
                nic_name = nic.get("name", nic_id.split("/")[-1])
                nic_props = nic.get("properties", {})
                nodes.append(_node(nic_id, "network_interface", "network", nic_name, {}))
                edges.append(_edge(root_id, nic_id, "NIC"))

                # NSG
                nsg_ref = nic_props.get("networkSecurityGroup")
                if nsg_ref:
                    nsg_id = nsg_ref["id"]
                    nsg_url = f"https://management.azure.com{nsg_id}?api-version=2023-05-01"
                    try:
                        nsg = requests.get(nsg_url, headers=headers, timeout=15).json()
                        nsg_name = nsg.get("name", nsg_id.split("/")[-1])
                        inbound = len(nsg.get("properties", {}).get("securityRules", []))
                        nodes.append(_node(nsg_id, "nsg", "security", nsg_name, {"rules": inbound}))
                        edges.append(_edge(root_id, nsg_id, "NSG"))
                    except Exception:
                        pass

                # IP Configs → VNet, Subnet, Public IP
                for ip_cfg in nic_props.get("ipConfigurations", []):
                    ip_props = ip_cfg.get("properties", {})
                    # Subnet / VNet
                    sub_ref = ip_props.get("subnet", {}).get("id", "")
                    if sub_ref:
                        sub_name = sub_ref.split("/")[-1]
                        vnet_name = sub_ref.split("/")[-3] if len(sub_ref.split("/")) > 3 else "VNet"
                        nodes.append(_node(sub_ref, "subnet", "network", sub_name, {"vnet": vnet_name}))
                        edges.append(_edge(root_id, sub_ref, "subnet"))
                        vnet_id = "/".join(sub_ref.split("/")[:-2])
                        nodes.append(_node(vnet_id, "vnet", "network", vnet_name, {}))
                        edges.append(_edge(root_id, vnet_id, "VNet"))
                    # Public IP
                    pub_ref = ip_props.get("publicIPAddress", {}).get("id", "")
                    if pub_ref:
                        pip_url = f"https://management.azure.com{pub_ref}?api-version=2023-05-01"
                        try:
                            pip = requests.get(pip_url, headers=headers, timeout=15).json()
                            pub_ip = pip.get("properties", {}).get("ipAddress", "")
                            nodes.append(_node(pub_ref, "public_ip", "network", pub_ip or "Public IP", {"ip": pub_ip, "allocation": pip.get("properties", {}).get("publicIPAllocationMethod")}))
                            edges.append(_edge(root_id, pub_ref, "public IP"))
                        except Exception:
                            pass
            except Exception:
                pass

        # Identity
        identity = vm.get("identity", {})
        if identity:
            id_type = identity.get("type", "")
            nodes.append(_node("identity", "managed_identity", "iam", f"Managed Identity ({id_type})", {"type": id_type}))
            edges.append(_edge(root_id, "identity", "identity"))

        # Availability Set / VMSS
        avset = props.get("availabilitySet", {}).get("id", "")
        if avset:
            nodes.append(_node(avset, "availability_set", "compute", avset.split("/")[-1], {}))
            edges.append(_edge(root_id, avset, "availability set"))

    except Exception:
        pass

    return {"nodes": nodes, "edges": edges}


# ── DigitalOcean helpers ──────────────────────────────────────────────────────

def _do_server_map(server: models.Server, config: dict) -> dict:
    import requests
    root_id = f"server-{server.id}"
    nodes, edges = [], []
    token = config.get("api_token")
    headers: dict[str, str | bytes] = {"Authorization": f"Bearer {token}"}

    try:
        resp = requests.get(f"https://api.digitalocean.com/v2/droplets/{server.cloud_id}", headers=headers, timeout=15)
        if not resp.ok:
            return {"nodes": [], "edges": []}
        droplet = resp.json().get("droplet", {})

        # VPC
        vpc_uuid = droplet.get("vpc_uuid")
        if vpc_uuid:
            vpc_resp = requests.get(f"https://api.digitalocean.com/v2/vpcs/{vpc_uuid}", headers=headers, timeout=15)
            if vpc_resp.ok:
                vpc = vpc_resp.json().get("vpc", {})
                nodes.append(_node(vpc_uuid, "vpc", "network", vpc.get("name", vpc_uuid), {"ip_range": vpc.get("ip_range"), "region": vpc.get("region")}))
                edges.append(_edge(root_id, vpc_uuid, "VPC"))

        # Floating IPs
        fip_resp = requests.get("https://api.digitalocean.com/v2/floating_ips", headers=headers, timeout=15)
        if fip_resp.ok:
            for fip in fip_resp.json().get("floating_ips", []):
                if fip.get("droplet", {}).get("id") == int(server.cloud_id or 0):
                    ip = fip.get("ip", "")
                    nodes.append(_node(f"fip-{ip}", "floating_ip", "network", ip, {"region": fip.get("region", {}).get("slug")}))
                    edges.append(_edge(root_id, f"fip-{ip}", "floating IP"))

        # Firewalls
        fw_resp = requests.get("https://api.digitalocean.com/v2/firewalls", headers=headers, timeout=15)
        if fw_resp.ok:
            for fw in fw_resp.json().get("firewalls", []):
                droplet_ids = [d["droplet_id"] for d in fw.get("droplet_ids", [])] if isinstance(fw.get("droplet_ids"), list) else fw.get("droplet_ids", [])
                if int(server.cloud_id or 0) in droplet_ids or server.cloud_id in [str(d) for d in droplet_ids]:
                    nodes.append(_node(fw["id"], "firewall", "security", fw.get("name", fw["id"]), {
                        "status": fw.get("status"),
                        "inbound_rules": len(fw.get("inbound_rules", [])),
                        "outbound_rules": len(fw.get("outbound_rules", [])),
                    }))
                    edges.append(_edge(root_id, fw["id"], "firewall"))

        # Load Balancers
        lb_resp = requests.get("https://api.digitalocean.com/v2/load_balancers", headers=headers, timeout=15)
        if lb_resp.ok:
            for lb in lb_resp.json().get("load_balancers", []):
                if int(server.cloud_id or 0) in lb.get("droplet_ids", []):
                    nodes.append(_node(lb["id"], "load_balancer", "network", lb.get("name", lb["id"]), {"ip": lb.get("ip"), "algorithm": lb.get("algorithm")}))
                    edges.append(_edge(root_id, lb["id"], "behind LB"))

        # Tags
        for tag in droplet.get("tags", []):
            nodes.append(_node(f"tag-{tag}", "tag", "meta", tag, {}))
            edges.append(_edge(root_id, f"tag-{tag}", "tag"))

    except Exception:
        pass

    return {"nodes": nodes, "edges": edges}


def _do_database_map(db_inst: models.DatabaseInstance, config: dict) -> dict:
    import requests
    root_id = f"db-{db_inst.id}"
    nodes, edges = [], []
    token = config.get("api_token")
    headers: dict[str, str | bytes] = {"Authorization": f"Bearer {token}"}

    try:
        resp = requests.get(f"https://api.digitalocean.com/v2/databases/{db_inst.cloud_id}", headers=headers, timeout=15)
        if not resp.ok:
            return {"nodes": [], "edges": []}
        db = resp.json().get("database", {})

        # VPC
        vpc_uuid = db.get("private_network_uuid")
        if vpc_uuid:
            vpc_resp = requests.get(f"https://api.digitalocean.com/v2/vpcs/{vpc_uuid}", headers=headers, timeout=15)
            if vpc_resp.ok:
                vpc = vpc_resp.json().get("vpc", {})
                nodes.append(_node(vpc_uuid, "vpc", "network", vpc.get("name", vpc_uuid), {"ip_range": vpc.get("ip_range")}))
                edges.append(_edge(root_id, vpc_uuid, "private network"))

        # Firewall rules
        fw_resp = requests.get(f"https://api.digitalocean.com/v2/databases/{db_inst.cloud_id}/firewall", headers=headers, timeout=15)
        if fw_resp.ok:
            for rule in fw_resp.json().get("rules", []):
                rule_id = rule.get("uuid", rule.get("value", ""))
                nodes.append(_node(f"fw-rule-{rule_id}", "firewall_rule", "security", f"{rule.get('type')} / {rule.get('value')}", {"type": rule.get("type")}))
                edges.append(_edge(root_id, f"fw-rule-{rule_id}", "allowed source"))

        # Read-only replicas
        for replica in db.get("read_only_replicas", []):
            r_name = replica.get("name", "replica")
            nodes.append(_node(f"replica-{r_name}", "read_replica", "compute", r_name, {"region": replica.get("region")}))
            edges.append(_edge(root_id, f"replica-{r_name}", _READ_REPLICA))

        # Tags
        for tag in db.get("tags", []):
            nodes.append(_node(f"tag-{tag}", "tag", "meta", tag, {}))
            edges.append(_edge(root_id, f"tag-{tag}", "tag"))

    except Exception:
        pass

    return {"nodes": nodes, "edges": edges}


def _do_kubernetes_map(cluster: models.KubernetesCluster, config: dict) -> dict:
    import requests
    root_id = f"k8s-{cluster.id}"
    nodes, edges = [], []
    token = config.get("api_token")
    headers: dict[str, str | bytes] = {"Authorization": f"Bearer {token}"}

    try:
        resp = requests.get(f"https://api.digitalocean.com/v2/kubernetes/clusters/{cluster.cloud_id}", headers=headers, timeout=15)
        if not resp.ok:
            return {"nodes": [], "edges": []}
        c = resp.json().get("kubernetes_cluster", {})

        # VPC
        vpc_uuid = c.get("vpc_uuid")
        if vpc_uuid:
            vpc_resp = requests.get(f"https://api.digitalocean.com/v2/vpcs/{vpc_uuid}", headers=headers, timeout=15)
            if vpc_resp.ok:
                vpc = vpc_resp.json().get("vpc", {})
                nodes.append(_node(vpc_uuid, "vpc", "network", vpc.get("name", vpc_uuid), {}))
                edges.append(_edge(root_id, vpc_uuid, "VPC"))

        # Node pools
        for pool in c.get("node_pools", []):
            pool_id = pool.get("id", pool.get("name"))
            nodes.append(_node(f"pool-{pool_id}", "node_pool", "compute", pool.get("name", pool_id), {
                "size": pool.get("size"), "count": pool.get("count"), "auto_scale": pool.get("auto_scale")
            }))
            edges.append(_edge(root_id, f"pool-{pool_id}", _NODE_POOL))

        # Maintenance policy
        maint = c.get("maintenance_policy")
        if maint:
            nodes.append(_node("maint-policy", "maintenance_policy", "config", f"Maintenance: {maint.get('day')} {maint.get('start_time')}", {}))
            edges.append(_edge(root_id, "maint-policy", "maintenance"))

        # Tags
        for tag in c.get("tags", []):
            nodes.append(_node(f"tag-{tag}", "tag", "meta", tag, {}))
            edges.append(_edge(root_id, f"tag-{tag}", "tag"))

    except Exception:
        pass

    return {"nodes": nodes, "edges": edges}


# ── Linode helpers ────────────────────────────────────────────────────────────

def _linode_server_map(server: models.Server, config: dict) -> dict:
    import requests
    root_id = f"server-{server.id}"
    nodes, edges = [], []
    token = config.get("api_token")
    headers: dict[str, str | bytes] = {"Authorization": f"Bearer {token}"}

    try:
        resp = requests.get(f"https://api.linode.com/v4/linode/instances/{server.cloud_id}", headers=headers, timeout=15)
        if not resp.ok:
            return {"nodes": [], "edges": []}

        # Firewall
        fw_resp = requests.get(f"https://api.linode.com/v4/linode/instances/{server.cloud_id}/firewalls", headers=headers, timeout=15)
        if fw_resp.ok:
            for fw in fw_resp.json().get("data", []):
                nodes.append(_node(str(fw["id"]), "firewall", "security", fw.get("label", str(fw["id"])), {"status": fw.get("status"), "rules": fw.get("rules", {}).get("inbound_policy")}))
                edges.append(_edge(root_id, str(fw["id"]), "firewall"))

        # NodeBalancers
        nb_resp = requests.get("https://api.linode.com/v4/nodebalancers", headers=headers, timeout=15)
        if nb_resp.ok:
            # Check each NB's configs for this linode
            for nb in nb_resp.json().get("data", []):
                nb_id = nb["id"]
                cfg_resp = requests.get(f"https://api.linode.com/v4/nodebalancers/{nb_id}/configs", headers=headers, timeout=15)
                if cfg_resp.ok:
                    for cfg in cfg_resp.json().get("data", []):
                        nodes_resp = requests.get(f"https://api.linode.com/v4/nodebalancers/{nb_id}/configs/{cfg['id']}/nodes", headers=headers, timeout=15)
                        if nodes_resp.ok:
                            for node in nodes_resp.json().get("data", []):
                                if str(server.cloud_id) in node.get("address", ""):
                                    nodes.append(_node(str(nb_id), "load_balancer", "network", nb.get("label", str(nb_id)), {"ip": nb.get("ipv4"), "hostname": nb.get("hostname")}))
                                    edges.append(_edge(root_id, str(nb_id), "NodeBalancer"))

        # VLANs
        vlan_resp = requests.get(f"https://api.linode.com/v4/linode/instances/{server.cloud_id}/configs", headers=headers, timeout=15)
        if vlan_resp.ok:
            for cfg in vlan_resp.json().get("data", []):
                for iface in cfg.get("interfaces", []):
                    if iface.get("purpose") == "vlan":
                        vlan_label = iface.get("label", "VLAN")
                        nodes.append(_node(f"vlan-{vlan_label}", "vlan", "network", vlan_label, {"ipam_address": iface.get("ipam_address")}))
                        edges.append(_edge(root_id, f"vlan-{vlan_label}", "VLAN"))

        # Disks
        disk_resp = requests.get(f"https://api.linode.com/v4/linode/instances/{server.cloud_id}/disks", headers=headers, timeout=15)
        if disk_resp.ok:
            for disk in disk_resp.json().get("data", [])[:4]:
                nodes.append(_node(str(disk["id"]), "disk", "storage", disk.get("label", str(disk["id"])), {"size_mb": disk.get("size"), "filesystem": disk.get("filesystem")}))
                edges.append(_edge(root_id, str(disk["id"]), "disk"))

    except Exception:
        pass

    return {"nodes": nodes, "edges": edges}


# ── GCP Database (Cloud SQL) ──────────────────────────────────────────────────

def _gcp_database_map(db_inst: models.DatabaseInstance, config: dict) -> dict:
    import requests
    root_id = f"db-{db_inst.id}"
    nodes, edges = [], []
    try:
        token, project_id = _gcp_token(config)
    except Exception:
        return {"nodes": [], "edges": []}

    headers: dict[str, str | bytes] = {"Authorization": f"Bearer {token}"}
    try:
        url = f"https://sqladmin.googleapis.com/v1/projects/{project_id}/instances/{db_inst.cloud_id}"
        resp = requests.get(url, headers=headers, timeout=20)
        if not resp.ok:
            return {"nodes": [], "edges": []}
        inst = resp.json()
        settings = inst.get("settings", {})
        ip_addrs = inst.get("ipAddresses", [])

        # VPC (private network)
        private_network = settings.get("ipConfiguration", {}).get("privateNetwork", "")
        if private_network:
            net_name = private_network.split("/")[-1]
            nodes.append(_node(net_name, "vpc_network", "network", net_name, {"private_network": private_network}))
            edges.append(_edge(root_id, net_name, "private network"))

        # IP addresses
        for ip in ip_addrs:
            ip_type = ip.get("type", "")
            ip_addr = ip.get("ipAddress", "")
            node_id = f"ip-{ip_addr}"
            nodes.append(_node(node_id, "public_ip" if ip_type == "PRIMARY" else "private_ip", "network",
                               f"{ip_addr} ({ip_type})", {"type": ip_type}))
            edges.append(_edge(root_id, node_id, ip_type.lower()))

        # Authorized networks
        for net in settings.get("ipConfiguration", {}).get("authorizedNetworks", []):
            net_id = f"authnet-{net.get('value', '')}"
            nodes.append(_node(net_id, "firewall_rule", "security", net.get("name") or net.get("value", "allowed network"),
                               {"cidr": net.get("value"), "expiry": net.get("expirationTime")}))
            edges.append(_edge(root_id, net_id, "authorized network"))

        # Backups
        backup_cfg = settings.get("backupConfiguration", {})
        if backup_cfg.get("enabled"):
            nodes.append(_node("backup-config", "backup", "config", "Automated Backups",
                               {"start_time": backup_cfg.get("startTime"), "retention_days": backup_cfg.get("transactionLogRetentionDays"),
                                "point_in_time": backup_cfg.get("pointInTimeRecoveryEnabled")}))
            edges.append(_edge(root_id, "backup-config", "backup policy"))

        # Maintenance window
        maint = settings.get("maintenanceWindow", {})
        if maint:
            nodes.append(_node("maintenance-window", "maintenance_policy", "config",
                               f"Maintenance: day {maint.get('day')} hour {maint.get('hour')}",
                               {"day": maint.get("day"), "hour": maint.get("hour"), "update_track": maint.get("updateTrack")}))
            edges.append(_edge(root_id, "maintenance-window", "maintenance window"))

        # Read replicas
        for replica_name in inst.get("replicaNames", []):
            nodes.append(_node(f"replica-{replica_name}", "read_replica", "compute", replica_name, {}))
            edges.append(_edge(root_id, f"replica-{replica_name}", _READ_REPLICA))

        # Database flags
        flags = settings.get("databaseFlags", [])
        if flags:
            nodes.append(_node("db-flags", "parameter_group", "config", f"{len(flags)} DB flags",
                               {f["name"]: f["value"] for f in flags[:10]}))
            edges.append(_edge(root_id, "db-flags", "database flags"))

        # Service account (for import/export)
        sa_email = inst.get("serviceAccountEmailAddress")
        if sa_email:
            nodes.append(_node(sa_email, "service_account", "iam", sa_email, {}))
            edges.append(_edge(root_id, sa_email, _SERVICE_ACCOUNT))

    except Exception:
        pass
    return {"nodes": nodes, "edges": edges}


# ── Azure Database ────────────────────────────────────────────────────────────

def _azure_database_map(db_inst: models.DatabaseInstance, config: dict) -> dict:
    import requests
    root_id = f"db-{db_inst.id}"
    nodes, edges = [], []
    try:
        token, _ = _az_token(config)
    except Exception:
        return {"nodes": [], "edges": []}

    headers: dict[str, str | bytes] = {"Authorization": f"Bearer {token}"}
    if not db_inst.cloud_id:
        return {"nodes": [], "edges": []}

    # Determine API version based on engine
    engine = (db_inst.engine or "").lower()
    if "postgres" in engine:
        api_ver = "2022-12-01"
    elif "mysql" in engine:
        api_ver = "2021-05-01"
    else:
        api_ver = "2022-12-01"

    try:
        srv_url = f"https://management.azure.com{db_inst.cloud_id}?api-version={api_ver}"
        srv = requests.get(srv_url, headers=headers, timeout=20).json()
        props = srv.get("properties", {})

        # Firewall rules
        fw_url = f"https://management.azure.com{db_inst.cloud_id}/firewallRules?api-version={api_ver}"
        try:
            fw_resp = requests.get(fw_url, headers=headers, timeout=15)
            if fw_resp.ok:
                for rule in fw_resp.json().get("value", []):
                    rule_id = rule["id"]
                    rp = rule.get("properties", {})
                    nodes.append(_node(rule_id, "firewall_rule", "security", rule["name"],
                                       {"start_ip": rp.get("startIpAddress"), "end_ip": rp.get("endIpAddress")}))
                    edges.append(_edge(root_id, rule_id, "firewall rule"))
        except Exception:
            pass

        # VNet rules
        vnet_url = f"https://management.azure.com{db_inst.cloud_id}/virtualNetworkRules?api-version={api_ver}"
        try:
            vnet_resp = requests.get(vnet_url, headers=headers, timeout=15)
            if vnet_resp.ok:
                for rule in vnet_resp.json().get("value", []):
                    vnet_id = rule.get("properties", {}).get("virtualNetworkSubnetId", "")
                    vnet_name = vnet_id.split("/")[-3] if vnet_id else rule["name"]
                    sub_name = vnet_id.split("/")[-1] if vnet_id else ""
                    nodes.append(_node(rule["id"], "subnet", "network", f"{vnet_name}/{sub_name}",
                                       {"vnet_subnet_id": vnet_id}))
                    edges.append(_edge(root_id, rule["id"], "VNet rule"))
        except Exception:
            pass

        # Private endpoints
        for pe_ref in props.get("privateEndpointConnections", []):
            pe_id = pe_ref.get("id", "")
            pe_name = pe_id.split("/")[-1] if pe_id else "private endpoint"
            nodes.append(_node(pe_id, "public_ip", "network", pe_name,
                               {"state": pe_ref.get("properties", {}).get("privateLinkServiceConnectionState", {}).get("status")}))
            edges.append(_edge(root_id, pe_id, "private endpoint"))

        # High availability
        ha = props.get("highAvailability", {})
        if ha.get("mode") and ha["mode"] != "Disabled":
            nodes.append(_node("high-availability", "availability_zone", "compute",
                               f"HA: {ha['mode']}", {"standby_az": ha.get("standbyAvailabilityZone"), "state": ha.get("state")}))
            edges.append(_edge(root_id, "high-availability", "high availability"))

        # Maintenance window
        maint = props.get("maintenanceWindow", {})
        if maint.get("customWindow") == "Enabled":
            nodes.append(_node("maint-window", "maintenance_policy", "config",
                               f"Maintenance: day {maint.get('dayOfWeek')} at {maint.get('startHour')}:00",
                               {"day_of_week": maint.get("dayOfWeek"), "start_hour": maint.get("startHour")}))
            edges.append(_edge(root_id, "maint-window", "maintenance window"))

        # Backup
        backup = props.get("backup", {})
        if backup:
            nodes.append(_node("backup-policy", "backup", "config", "Backup Policy",
                               {"retention_days": backup.get("backupRetentionDays"), "geo_redundant": backup.get("geoRedundantBackup"),
                                "earliest_restore": backup.get("earliestRestoreDate")}))
            edges.append(_edge(root_id, "backup-policy", "backup policy"))

        # Read replicas
        replicas_url = f"https://management.azure.com{db_inst.cloud_id}/replicas?api-version={api_ver}"
        try:
            rep_resp = requests.get(replicas_url, headers=headers, timeout=15)
            if rep_resp.ok:
                for rep in rep_resp.json().get("value", []):
                    nodes.append(_node(rep["id"], "read_replica", "compute", rep["name"],
                                       {"location": rep.get("location"), "fqdn": rep.get("properties", {}).get("fullyQualifiedDomainName")}))
                    edges.append(_edge(root_id, rep["id"], _READ_REPLICA))
        except Exception:
            pass

    except Exception:
        pass
    return {"nodes": nodes, "edges": edges}


# ── Azure Kubernetes (AKS) ────────────────────────────────────────────────────

def _azure_kubernetes_map(cluster: models.KubernetesCluster, config: dict) -> dict:
    import requests
    root_id = f"k8s-{cluster.id}"
    nodes, edges = [], []
    try:
        token, _ = _az_token(config)
    except Exception:
        return {"nodes": [], "edges": []}

    headers: dict[str, str | bytes] = {"Authorization": f"Bearer {token}"}
    if not cluster.cloud_id:
        return {"nodes": [], "edges": []}

    try:
        url = f"https://management.azure.com{cluster.cloud_id}?api-version=2023-08-01"
        c = requests.get(url, headers=headers, timeout=20).json()
        props = c.get("properties", {})

        # VNet / Subnet from agent pool profiles
        for pool in props.get("agentPoolProfiles", []):
            pool_name = pool["name"]
            nodes.append(_node(f"pool-{pool_name}", "node_group", "compute", pool_name, {
                "vm_size": pool.get("vmSize"), "count": pool.get("count"),
                "os_type": pool.get("osType"), "mode": pool.get("mode"),
                "min": pool.get("minCount"), "max": pool.get("maxCount"),
                "auto_scale": pool.get("enableAutoScaling"),
            }))
            edges.append(_edge(root_id, f"pool-{pool_name}", _NODE_POOL))

            # Subnet from pool
            subnet_id = pool.get("vnetSubnetID", "")
            if subnet_id:
                sub_name = subnet_id.split("/")[-1]
                vnet_name = subnet_id.split("/")[-3] if len(subnet_id.split("/")) > 3 else "VNet"
                vnet_id = "/".join(subnet_id.split("/")[:-2])
                nodes.append(_node(subnet_id, "subnet", "network", sub_name, {"vnet": vnet_name}))
                edges.append(_edge(root_id, subnet_id, "subnet"))
                nodes.append(_node(vnet_id, "vnet", "network", vnet_name, {}))
                edges.append(_edge(root_id, vnet_id, "VNet"))

        # Managed identity
        identity = c.get("identity", {})
        if identity:
            nodes.append(_node("cluster-identity", "managed_identity", "iam",
                               f"Managed Identity ({identity.get('type', '')})",
                               {"type": identity.get("type"), "principal_id": identity.get("principalId", "")}))
            edges.append(_edge(root_id, "cluster-identity", "cluster identity"))

        # AAD / RBAC
        aad = props.get("aadProfile", {})
        if aad:
            nodes.append(_node("aad-integration", "oidc_provider", "iam", "Azure AD Integration",
                               {"managed": aad.get("managed"), "azure_rbac": aad.get("enableAzureRBAC"),
                                "tenant_id": aad.get("tenantID")}))
            edges.append(_edge(root_id, "aad-integration", "AAD integration"))

        # OIDC issuer
        oidc_url = props.get("oidcIssuerProfile", {}).get("issuerURL")
        if oidc_url:
            nodes.append(_node("oidc-issuer", "oidc_provider", "iam", "OIDC Issuer", {"url": oidc_url}))
            edges.append(_edge(root_id, "oidc-issuer", "OIDC"))

        # Load balancer public IPs
        lb_profile = props.get("networkProfile", {}).get("loadBalancerProfile", {})
        for ip_ref in lb_profile.get("effectiveOutboundIPs", []):
            ip_id = ip_ref.get("id", "")
            ip_name = ip_id.split("/")[-1] if ip_id else "LB Public IP"
            nodes.append(_node(ip_id, "public_ip", "network", ip_name, {}))
            edges.append(_edge(root_id, ip_id, "outbound IP"))

        # Network plugin
        net_profile = props.get("networkProfile", {})
        if net_profile:
            nodes.append(_node("network-profile", "network_interface", "network",
                               f"Network: {net_profile.get('networkPlugin', 'kubenet')}",
                               {"plugin": net_profile.get("networkPlugin"), "policy": net_profile.get("networkPolicy"),
                                "pod_cidr": net_profile.get("podCidr"), "service_cidr": net_profile.get("serviceCidr")}))
            edges.append(_edge(root_id, "network-profile", "network config"))

        # Addons
        addon_profiles = props.get("addonProfiles", {})
        for addon_name, addon_val in addon_profiles.items():
            if addon_val.get("enabled"):
                nodes.append(_node(f"addon-{addon_name}", "addon", "config", addon_name,
                                   {"enabled": True}))
                edges.append(_edge(root_id, f"addon-{addon_name}", "addon"))

    except Exception:
        pass
    return {"nodes": nodes, "edges": edges}


# ── Linode Database ───────────────────────────────────────────────────────────

def _linode_database_map(db_inst: models.DatabaseInstance, config: dict) -> dict:
    import requests
    root_id = f"db-{db_inst.id}"
    nodes, edges = [], []
    token = config.get("api_token")
    headers: dict[str, str | bytes] = {"Authorization": f"Bearer {token}"}
    engine = (db_inst.engine or "mysql").lower()
    db_id = db_inst.cloud_id

    try:
        url = f"https://api.linode.com/v4/databases/{engine}/instances/{db_id}"
        resp = requests.get(url, headers=headers, timeout=15)
        if not resp.ok:
            return {"nodes": [], "edges": []}
        db = resp.json()

        # Hosts
        hosts = db.get("hosts", {})
        if hosts.get("primary"):
            nodes.append(_node("host-primary", "public_ip", "network", hosts["primary"],
                               {"type": "primary", "port": db.get("port")}))
            edges.append(_edge(root_id, "host-primary", "primary endpoint"))
        if hosts.get("secondary"):
            nodes.append(_node("host-secondary", "read_replica", "compute", hosts["secondary"],
                               {"type": "secondary"}))
            edges.append(_edge(root_id, "host-secondary", "secondary endpoint"))

        # Firewall
        fw_resp = requests.get(f"https://api.linode.com/v4/databases/{engine}/instances/{db_id}/ssl", headers=headers, timeout=15)
        if fw_resp.ok:
            ssl = fw_resp.json()
            nodes.append(_node("ssl-config", "firewall_rule", "security", "SSL Certificate",
                               {"ca_certificate": bool(ssl.get("ca_certificate"))}))
            edges.append(_edge(root_id, "ssl-config", "SSL/TLS"))

        # Allow list
        allow_list = db.get("allow_list", [])
        if allow_list:
            nodes.append(_node("allow-list", "firewall_rule", "security",
                               f"Allow List ({len(allow_list)} CIDRs)",
                               {"cidrs": allow_list[:10]}))
            edges.append(_edge(root_id, "allow-list", "IP allowlist"))

        # Replicas
        for i, member in enumerate(db.get("members", {}).values() if isinstance(db.get("members"), dict) else []):
            nodes.append(_node(f"member-{i}", "read_replica", "compute", f"Member {i+1}",
                               {"host": member}))
            edges.append(_edge(root_id, f"member-{i}", "cluster member"))

        # Backup
        if db.get("backups", {}).get("enabled"):
            backup = db["backups"]
            nodes.append(_node("backup", "backup", "config", "Automated Backups",
                               {"hour": backup.get("schedule", {}).get("hour"),
                                "day_of_week": backup.get("schedule", {}).get("day_of_week")}))
            edges.append(_edge(root_id, "backup", "backup schedule"))

        # Instance type
        inst_type = db.get("type")
        if inst_type:
            nodes.append(_node(f"type-{inst_type}", "parameter_group", "config", inst_type,
                               {"cluster_size": db.get("cluster_size"), "replication_type": db.get("replication_type")}))
            edges.append(_edge(root_id, f"type-{inst_type}", "instance type"))

    except Exception:
        pass
    return {"nodes": nodes, "edges": edges}


# ── Linode Kubernetes (LKE) ───────────────────────────────────────────────────

def _linode_kubernetes_map(cluster: models.KubernetesCluster, config: dict) -> dict:
    import requests
    root_id = f"k8s-{cluster.id}"
    nodes, edges = [], []
    token = config.get("api_token")
    headers: dict[str, str | bytes] = {"Authorization": f"Bearer {token}"}
    cluster_id = cluster.cloud_id

    try:
        resp = requests.get(f"https://api.linode.com/v4/lke/clusters/{cluster_id}", headers=headers, timeout=15)
        if not resp.ok:
            return {"nodes": [], "edges": []}
        c = resp.json()

        # Node pools
        pools_resp = requests.get(f"https://api.linode.com/v4/lke/clusters/{cluster_id}/pools", headers=headers, timeout=15)
        if pools_resp.ok:
            for pool in pools_resp.json().get("data", []):
                pool_id = pool["id"]
                nodes_list = pool.get("nodes", [])
                nodes.append(_node(str(pool_id), "node_pool", "compute",
                                   f"Pool: {pool.get('type', pool_id)}",
                                   {"type": pool.get("type"), "count": pool.get("count"),
                                    "disk_encryption": pool.get("disk_encryption"),
                                    "nodes": len(nodes_list)}))
                edges.append(_edge(root_id, str(pool_id), _NODE_POOL))

                # Per-node info
                for n in nodes_list[:3]:
                    n_id = str(n.get("id", ""))
                    n_status = n.get("status", "")
                    nodes.append(_node(f"node-{n_id}", "network_interface", "compute",
                                       f"Node {n_id[:8]}…",
                                       {"status": n_status, "instance_id": str(n.get("instance_id", ""))}))
                    edges.append(_edge(str(pool_id), f"node-{n_id}", "node"))

        # Control plane
        control_plane = c.get("control_plane", {})
        if control_plane:
            nodes.append(_node("control-plane", "oidc_provider", "iam", "Control Plane",
                               {"high_availability": control_plane.get("high_availability"),
                                "acl": bool(control_plane.get("acl"))}))
            edges.append(_edge(root_id, "control-plane", "control plane"))

        # API endpoint
        ep_resp = requests.get(f"https://api.linode.com/v4/lke/clusters/{cluster_id}/api-endpoints",
                               headers=headers, timeout=15)
        if ep_resp.ok:
            for ep in ep_resp.json().get("data", []):
                endpoint = ep.get("endpoint", "")
                nodes.append(_node(f"ep-{endpoint}", "public_ip", "network",
                                   endpoint, {"type": "API endpoint"}))
                edges.append(_edge(root_id, f"ep-{endpoint}", "API endpoint"))

        # Dashboard
        dash_resp = requests.get(f"https://api.linode.com/v4/lke/clusters/{cluster_id}/dashboard",
                                 headers=headers, timeout=15)
        if dash_resp.ok:
            url = dash_resp.json().get("url", "")
            if url:
                nodes.append(_node("dashboard", "addon", "config", "Kubernetes Dashboard", {"url": url}))
                edges.append(_edge(root_id, "dashboard", "dashboard"))

        # Tags
        for tag in c.get("tags", []):
            nodes.append(_node(f"tag-{tag}", "tag", "meta", tag, {}))
            edges.append(_edge(root_id, f"tag-{tag}", "tag"))

    except Exception:
        pass
    return {"nodes": nodes, "edges": edges}


# ── OVH Server ────────────────────────────────────────────────────────────────

def _ovh_signed_get(base_url: str, app_key: str, app_secret: str, consumer_key: str, path: str):
    import hashlib, time, requests
    now = str(int(time.time()))
    url = f"{base_url}{path}"
    sig_str = f"{app_secret}+{consumer_key}+GET+{url}++{now}"
    sig = "$1$" + hashlib.sha1(sig_str.encode()).hexdigest()
    headers: dict[str, str | bytes] = {
        "X-Ovh-Application": app_key,
        "X-Ovh-Consumer": consumer_key,
        "X-Ovh-Timestamp": now,
        "X-Ovh-Signature": sig,
    }
    return requests.get(url, headers=headers, timeout=15)


def _ovh_append_ip_nodes(ovh_get, root_id: str, nodes: list, edges: list) -> None:
    ip_resp = ovh_get("/ips")
    if not ip_resp.ok:
        return
    for ip in ip_resp.json():
        nodes.append(_node(f"ip-{ip}", "public_ip", "network", ip, {}))
        edges.append(_edge(root_id, f"ip-{ip}", "IP address"))


def _ovh_append_failover_ips(ovh_get_absolute, root_id: str, server_name: str, nodes: list, edges: list) -> None:
    fo_resp = ovh_get_absolute("/ip?type=failover")
    if not fo_resp.ok:
        return
    for fo_ip in fo_resp.json()[:10]:
        detail = ovh_get_absolute(f"/ip/{fo_ip.replace('/', '%2F')}")
        if not detail.ok:
            continue
        ip_data = detail.json()
        if ip_data.get("routedTo", {}).get("serviceName") == server_name:
            nodes.append(_node(f"failover-{fo_ip}", "elastic_ip", "network",
                               f"Failover {fo_ip}", {"block": fo_ip}))
            edges.append(_edge(root_id, f"failover-{fo_ip}", "failover IP"))


def _ovh_append_vrack(ovh_get, root_id: str, nodes: list, edges: list) -> None:
    vrack_resp = ovh_get("/vrack")
    if not vrack_resp.ok:
        return
    vrack = vrack_resp.json()
    vrack_id = vrack.get("vrack", "")
    if vrack_id:
        nodes.append(_node(f"vrack-{vrack_id}", "vpc_network", "network",
                           f"vRack: {vrack_id}",
                           {"vrack_id": vrack_id, "mode": vrack.get("mode"), "status": vrack.get("taskState")}))
        edges.append(_edge(root_id, f"vrack-{vrack_id}", "vRack"))


def _ovh_append_firewalls(ovh_get_absolute, root_id: str, server_name: str, nodes: list, edges: list) -> None:
    fw_resp = ovh_get_absolute(f"/ip?routedTo={server_name}")
    if not fw_resp.ok:
        return
    for ip_block in fw_resp.json()[:5]:
        fw_detail = ovh_get_absolute(f"/ip/{ip_block.replace('/', '%2F')}/firewall")
        if not fw_detail.ok:
            continue
        for fw_ip in fw_detail.json()[:5]:
            fw_rules = ovh_get_absolute(f"/ip/{ip_block.replace('/', '%2F')}/firewall/{fw_ip.replace('/', '%2F')}")
            if not fw_rules.ok:
                continue
            fw_data = fw_rules.json()
            if fw_data.get("enabled"):
                nodes.append(_node(f"fw-{fw_ip}", "firewall", "security",
                                   f"OVH Firewall {fw_ip}",
                                   {"enabled": True, "ip": fw_ip}))
                edges.append(_edge(root_id, f"fw-{fw_ip}", "OVH Firewall"))


def _ovh_append_backup(ovh_get, root_id: str, nodes: list, edges: list) -> None:
    backup_resp = ovh_get("/backupCloudOfferDetails")
    if not backup_resp.ok:
        return
    backup = backup_resp.json()
    nodes.append(_node("backup-cloud", "backup", "storage", "OVH Backup Cloud",
                       {"quota_used": backup.get("quotaUsed"), "quota_total": backup.get("quotaTotal")}))
    edges.append(_edge(root_id, "backup-cloud", "backup storage"))


def _ovh_append_ipmi(ovh_get, root_id: str, nodes: list, edges: list) -> None:
    ipmi_resp = ovh_get("/features/ipmi")
    if not ipmi_resp.ok:
        return
    ipmi = ipmi_resp.json()
    if ipmi.get("activated"):
        nodes.append(_node("ipmi", "network_interface", "network", "IPMI / iDRAC", {"activated": True}))
        edges.append(_edge(root_id, "ipmi", "IPMI access"))


def _ovh_append_dedicated_extras(ovh_get_absolute, root_id: str, server_name: str, nodes: list, edges: list) -> None:
    def _dedicated_get(suffix: str):
        return ovh_get_absolute(f"/dedicated/server/{server_name}{suffix}")

    _ovh_append_vrack(_dedicated_get, root_id, nodes, edges)
    _ovh_append_firewalls(ovh_get_absolute, root_id, server_name, nodes, edges)
    _ovh_append_backup(_dedicated_get, root_id, nodes, edges)
    _ovh_append_ipmi(_dedicated_get, root_id, nodes, edges)


def _ovh_append_vps_extras(ovh_get, root_id: str, nodes: list, edges: list) -> None:
    snap_resp = ovh_get("/snapshot")
    if snap_resp.ok:
        snap = snap_resp.json()
        if snap:
            nodes.append(_node("vps-snapshot", "disk", "storage", "VPS Snapshot",
                               {"creation_date": snap.get("creationDate")}))
            edges.append(_edge(root_id, "vps-snapshot", "snapshot"))

    opt_resp = ovh_get("/option")
    if opt_resp.ok:
        for opt in opt_resp.json():
            nodes.append(_node(f"opt-{opt}", "addon", "config", opt.replace("-", " ").title(), {}))
            edges.append(_edge(root_id, f"opt-{opt}", "option"))


def _ovh_server_map(server: models.Server, config: dict) -> dict:
    root_id = f"server-{server.id}"
    nodes: list = []
    edges: list = []

    app_key = config.get("application_key", "")
    app_secret = config.get("application_secret", "")
    consumer_key = config.get("consumer_key", "")
    endpoint = config.get("endpoint", "ovh-eu")

    base_urls = {
        "ovh-eu": "https://eu.api.ovh.com/1.0",
        "ovh-ca": "https://ca.api.ovh.com/1.0",
        "ovh-us": "https://api.us.ovhcloud.com/1.0",
    }
    base_url = base_urls.get(endpoint, base_urls["ovh-eu"])

    def ovh_get_absolute(path: str):
        return _ovh_signed_get(base_url, app_key, app_secret, consumer_key, path)

    server_name = server.cloud_id or server.name
    is_vps = bool(server.instance_type and "vps" in str(server.instance_type).lower())
    prefix = "/vps" if is_vps else "/dedicated/server"
    resource_path = f"{prefix}/{server_name}"

    def resource_get(suffix: str):
        return ovh_get_absolute(f"{resource_path}{suffix}")

    try:
        resp = resource_get("")
        if not resp.ok:
            return {"nodes": [], "edges": []}

        _ovh_append_ip_nodes(resource_get, root_id, nodes, edges)
        _ovh_append_failover_ips(ovh_get_absolute, root_id, server_name, nodes, edges)

        if is_vps:
            _ovh_append_vps_extras(resource_get, root_id, nodes, edges)
        else:
            _ovh_append_dedicated_extras(ovh_get_absolute, root_id, server_name, nodes, edges)

    except Exception:
        pass
    return {"nodes": nodes, "edges": edges}


# ── Hivelocity ────────────────────────────────────────────────────────────────

def _hivelocity_server_map(server: models.Server, config: dict) -> dict:
    """Build a resource map from stored server data (no topology API available)."""
    nodes: list[dict] = []
    edges: list[dict] = []
    root_id = f"hv-server-{server.id}"

    nodes.append(_node(
        root_id, "server", "compute", server.name,
        {
            "provider": "hivelocity",
            "region": server.region or "",
            "datacenter": server.datacenter or server.region or "",
            "instance_type": server.instance_type or "",
            "status": server.status,
        },
    ))

    if server.public_ip:
        ip_id = f"hv-ip-{server.id}"
        nodes.append(_node(ip_id, "ip", "network", server.public_ip, {"type": "primary"}))
        edges.append(_edge(root_id, ip_id, "primary IP"))

    if server.region:
        dc_id = f"hv-dc-{server.region}"
        nodes.append(_node(dc_id, "datacenter", "infrastructure", server.datacenter or server.region, {"facility": server.region}))
        edges.append(_edge(dc_id, root_id, "hosts"))

    return {"nodes": nodes, "edges": edges}


# ── dispatch ──────────────────────────────────────────────────────────────────

def _append_ip_nodes(server: models.Server, result: dict) -> dict:
    """Add IP address nodes from ssh_info.all_ips for any provider's server map."""
    ssh_info = server.ssh_info or {}
    all_ips: list[str] = []
    if isinstance(ssh_info.get("all_ips"), list):
        all_ips = ssh_info["all_ips"]
    elif server.public_ip:
        all_ips = [server.public_ip]
        if server.private_ip and server.private_ip != server.public_ip:
            all_ips.append(server.private_ip)

    # Collect IPs already in nodes to avoid duplicates
    existing_labels = {n.get("label", "") for n in result.get("nodes", [])}

    # Find the compute/server root node id
    root_id = next(
        (n["id"] for n in result.get("nodes", []) if n.get("category") == "compute"),
        None,
    )
    if root_id is None or not all_ips:
        return result

    nodes = list(result.get("nodes", []))
    edges = list(result.get("edges", []))

    for idx, ip in enumerate(all_ips):
        if ip in existing_labels:
            continue
        ip_node_id = f"ip-{server.id}-{idx}"
        label = ip
        is_primary = ip == server.public_ip
        nodes.append(_node(ip_node_id, "ip", "network", label, {
            "type": "primary" if is_primary else "additional",
        }))
        edges.append(_edge(root_id, ip_node_id, "primary IP" if is_primary else "IP"))
        existing_labels.add(ip)

    return {**result, "nodes": nodes, "edges": edges}


def _build_map(resource_type: str, resource, provider: str, config: dict) -> dict:
    dispatch = {
        ("aws", "server"):     _aws_server_map,
        ("aws", "database"):   _aws_database_map,
        ("aws", "kubernetes"): _aws_kubernetes_map,
        ("gcp", "server"):     _gcp_server_map,
        ("gcp", "database"):   _gcp_database_map,
        ("gcp", "kubernetes"): _gcp_kubernetes_map,
        ("azure", "server"):     _azure_server_map,
        ("azure", "database"):   _azure_database_map,
        ("azure", "kubernetes"): _azure_kubernetes_map,
        ("digitalocean", "server"):     _do_server_map,
        ("digitalocean", "database"):   _do_database_map,
        ("digitalocean", "kubernetes"): _do_kubernetes_map,
        ("linode", "server"):     _linode_server_map,
        ("linode", "database"):   _linode_database_map,
        ("linode", "kubernetes"): _linode_kubernetes_map,
        ("ovh",        "server"):        _ovh_server_map,
        ("hivelocity", "server"):        _hivelocity_server_map,
    }
    fn = dispatch.get((provider, resource_type))
    if fn is None:
        return {"nodes": [], "edges": []}
    result = fn(resource, config)
    if resource_type == "server":
        result = _append_ip_nodes(resource, result)
    return result


# ── endpoints ─────────────────────────────────────────────────────────────────

@router.get("/server/{server_id}", responses={404: {"description": "Not found"}})
def server_resource_map(server_id: int, db: Annotated[Session, Depends(get_db)], _: Annotated[models.User, Depends(get_current_user)]):
    key = f"server:{server_id}"
    if cached := _cache_get(key):
        return cached
    server = db.query(models.Server).filter(models.Server.id == server_id).first()
    if not server:
        raise HTTPException(404, "Server not found")
    cred = _get_cred_for_provider(db, server.provider)
    config = decrypt_config(cred.config or {}) if cred else {}
    result = _build_map("server", server, server.provider, config)
    payload = {"resource": {"id": server.id, "name": server.name, "type": "server", "provider": server.provider, "region": server.region}, **result}
    _cache_set(key, payload)
    return payload


@router.get("/database/{db_id}", responses={404: {"description": "Not found"}})
def database_resource_map(db_id: int, db: Annotated[Session, Depends(get_db)], _: Annotated[models.User, Depends(get_current_user)]):
    key = f"database:{db_id}"
    if cached := _cache_get(key):
        return cached
    db_inst = db.query(models.DatabaseInstance).filter(models.DatabaseInstance.id == db_id).first()
    if not db_inst:
        raise HTTPException(404, "Database not found")
    cred = _get_cred_for_provider(db, db_inst.provider)
    config = decrypt_config(cred.config or {}) if cred else {}
    result = _build_map("database", db_inst, db_inst.provider, config)
    payload = {"resource": {"id": db_inst.id, "name": db_inst.name, "type": "database", "provider": db_inst.provider, "region": db_inst.region}, **result}
    _cache_set(key, payload)
    return payload


@router.get("/kubernetes/{cluster_id}", responses={404: {"description": "Not found"}})
def kubernetes_resource_map(cluster_id: int, db: Annotated[Session, Depends(get_db)], _: Annotated[models.User, Depends(get_current_user)]):
    key = f"kubernetes:{cluster_id}"
    if cached := _cache_get(key):
        return cached
    cluster = db.query(models.KubernetesCluster).filter(models.KubernetesCluster.id == cluster_id).first()
    if not cluster:
        raise HTTPException(404, "Cluster not found")
    cred = _get_cred_for_provider(db, cluster.provider)
    config = decrypt_config(cred.config or {}) if cred else {}
    result = _build_map("kubernetes", cluster, cluster.provider, config)
    payload = {"resource": {"id": cluster.id, "name": cluster.name, "type": "kubernetes", "provider": cluster.provider, "region": cluster.region}, **result}
    _cache_set(key, payload)
    return payload
