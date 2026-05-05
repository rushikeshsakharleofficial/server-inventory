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
