from typing import List, Dict, Any
from .base import CloudProvider

STATUS_MAP = {
    "running": "running",
    "stopped": "stopped",
    "terminated": "terminated",
    "pending": "pending",
    "shutting-down": "stopped",
    "stopping": "stopped",
}


class AWSProvider(CloudProvider):
    @property
    def provider_name(self) -> str:
        return "aws"

    def fetch_servers(self) -> List[Dict[str, Any]]:
        try:
            import boto3
        except ImportError:
            raise RuntimeError("boto3 not installed. Run: pip install boto3")

        access_key = self.config.get("access_key_id")
        secret_key = self.config.get("secret_access_key")
        regions = self.config.get("regions", ["us-east-1"])
        if isinstance(regions, str):
            regions = [r.strip() for r in regions.split(",") if r.strip()]

        servers = []
        for region in regions:
            ec2 = boto3.client(
                "ec2",
                region_name=region,
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
            )
            paginator = ec2.get_paginator("describe_instances")
            for page in paginator.paginate():
                for reservation in page["Reservations"]:
                    for instance in reservation["Instances"]:
                        name = ""
                        tags: Dict[str, str] = {}
                        for tag in instance.get("Tags", []):
                            tags[tag["Key"]] = tag["Value"]
                            if tag["Key"] == "Name":
                                name = tag["Value"]

                        state = instance.get("State", {}).get("Name", "unknown")
                        servers.append({
                            "cloud_id": instance["InstanceId"],
                            "name": name or instance["InstanceId"],
                            "provider": "aws",
                            "region": region,
                            "instance_type": instance.get("InstanceType"),
                            "status": STATUS_MAP.get(state, "unknown"),
                            "public_ip": instance.get("PublicIpAddress"),
                            "private_ip": instance.get("PrivateIpAddress"),
                            "os": instance.get("Platform", "linux"),
                            "tags": tags,
                            "extra": {
                                "ami_id": instance.get("ImageId"),
                                "vpc_id": instance.get("VpcId"),
                                "key_name": instance.get("KeyName"),
                                "launch_time": str(instance.get("LaunchTime", "")),
                            },
                        })
        return servers

    def fetch_databases(self) -> List[Dict[str, Any]]:
        import boto3

        access_key = self.config.get("access_key_id")
        secret_key = self.config.get("secret_access_key")
        regions = self.config.get("regions", ["us-east-1"])
        if isinstance(regions, str):
            regions = [r.strip() for r in regions.split(",") if r.strip()]

        result = []
        for region in regions:
            rds = boto3.client(
                "rds",
                region_name=region,
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
            )
            paginator = rds.get_paginator("describe_db_instances")
            for page in paginator.paginate():
                for db in page["DBInstances"]:
                    tags = {}
                    try:
                        tag_resp = rds.list_tags_for_resource(ResourceName=db["DBInstanceArn"])
                        tags = {t["Key"]: t["Value"] for t in tag_resp.get("TagList", [])}
                    except Exception:
                        pass
                    endpoint = db.get("Endpoint", {})
                    status_map = {
                        "available": "running",
                        "stopped": "stopped",
                        "starting": "pending",
                        "stopping": "pending",
                        "deleting": "terminated",
                        "creating": "pending",
                    }
                    result.append({
                        "cloud_id": db["DBInstanceIdentifier"],
                        "name": db["DBInstanceIdentifier"],
                        "provider": "aws",
                        "region": region,
                        "engine": db.get("Engine"),
                        "engine_version": db.get("EngineVersion"),
                        "status": status_map.get(db.get("DBInstanceStatus", ""), "unknown"),
                        "endpoint": endpoint.get("Address"),
                        "port": endpoint.get("Port"),
                        "storage_gb": db.get("AllocatedStorage"),
                        "instance_type": db.get("DBInstanceClass"),
                        "tags": tags,
                        "extra": {
                            "multi_az": db.get("MultiAZ"),
                            "availability_zone": db.get("AvailabilityZone"),
                            "db_name": db.get("DBName"),
                        },
                    })
        return result

    def fetch_kubernetes(self) -> List[Dict[str, Any]]:
        import boto3

        access_key = self.config.get("access_key_id")
        secret_key = self.config.get("secret_access_key")
        regions = self.config.get("regions", ["us-east-1"])
        if isinstance(regions, str):
            regions = [r.strip() for r in regions.split(",") if r.strip()]

        result = []
        for region in regions:
            eks = boto3.client(
                "eks",
                region_name=region,
                aws_access_key_id=access_key,
                aws_secret_access_key=secret_key,
            )
            try:
                cluster_names = eks.list_clusters().get("clusters", [])
            except Exception:
                continue
            for cluster_name in cluster_names:
                try:
                    c = eks.describe_cluster(name=cluster_name)["cluster"]
                except Exception:
                    continue
                status_map = {
                    "ACTIVE": "running",
                    "CREATING": "pending",
                    "DELETING": "terminated",
                    "FAILED": "stopped",
                    "UPDATING": "pending",
                }
                node_count = 0
                try:
                    ng_list = eks.list_nodegroups(clusterName=cluster_name).get("nodegroups", [])
                    for ng_name in ng_list:
                        ng = eks.describe_nodegroup(clusterName=cluster_name, nodegroupName=ng_name)["nodegroup"]
                        node_count += ng.get("scalingConfig", {}).get("desiredSize", 0)
                except Exception:
                    pass
                result.append({
                    "cloud_id": c["arn"],
                    "name": c["name"],
                    "provider": "aws",
                    "region": region,
                    "version": c.get("version"),
                    "status": status_map.get(c.get("status", ""), "unknown"),
                    "node_count": node_count,
                    "endpoint": c.get("endpoint"),
                    "tags": c.get("tags", {}),
                    "extra": {
                        "role_arn": c.get("roleArn"),
                        "kubernetes_network_config": c.get("kubernetesNetworkConfig"),
                    },
                })
        return result
