from typing import Any
from .base import CloudProvider

STATUS_MAP = {
    "running": "running",
    "stopped": "stopped",
    "terminated": "terminated",
    "pending": "pending",
    "shutting-down": "stopped",
    "stopping": "stopped",
}

VOLUME_STATUS_MAP = {
    "in-use": "running",
    "available": "available",
    "creating": "pending",
    "deleting": "terminated",
    "error": "stopped",
}


def _aws_tags_and_name(tag_list: list[dict[str, str]]) -> tuple[dict[str, str], str]:
    """Flatten an AWS Tags list into a dict, also returning the 'Name' tag value (or "")."""
    name = ""
    tags: dict[str, str] = {}
    for tag in tag_list:
        tags[tag["Key"]] = tag["Value"]
        if tag["Key"] == "Name":
            name = tag["Value"]
    return tags, name


class AWSProvider(CloudProvider):
    @property
    def provider_name(self) -> str:
        return "aws"

    def _aws_regions(self) -> list[str]:
        regions = self.config.get("regions", ["us-east-1"])
        if isinstance(regions, str):
            regions = [r.strip() for r in regions.split(",") if r.strip()]
        return regions

    def _aws_client(self, service_name: str, region: str):
        import boto3

        return boto3.client(
            service_name,
            region_name=region,
            aws_access_key_id=self.config.get("access_key_id"),
            aws_secret_access_key=self.config.get("secret_access_key"),
        )

    @staticmethod
    def _aws_os_from_image(image: dict | None) -> str:
        if not image:
            return "unknown"
        # AMI 'Platform' only ever appears for Windows; 'PlatformDetails' is
        # always populated but coarse (e.g. "Linux/UNIX") — Name/Description
        # carry the actual distro/version, AWS exposes no structured field for it.
        return image.get("Name") or image.get("Description") or image.get("PlatformDetails") or "unknown"

    @staticmethod
    def _aws_instance_to_server(instance: dict, region: str, images_by_id: dict[str, dict]) -> dict[str, Any]:
        tags, name = _aws_tags_and_name(instance.get("Tags", []))
        state = instance.get("State", {}).get("Name", "unknown")
        return {
            "cloud_id": instance["InstanceId"],
            "name": name or instance["InstanceId"],
            "provider": "aws",
            "region": region,
            "instance_type": instance.get("InstanceType"),
            "status": STATUS_MAP.get(state, "unknown"),
            "public_ip": instance.get("PublicIpAddress"),
            "private_ip": instance.get("PrivateIpAddress"),
            "os": AWSProvider._aws_os_from_image(images_by_id.get(instance.get("ImageId"))),
            "tags": tags,
            "extra": {
                "ami_id": instance.get("ImageId"),
                "vpc_id": instance.get("VpcId"),
                "key_name": instance.get("KeyName"),
                "launch_time": str(instance.get("LaunchTime", "")),
            },
        }

    @staticmethod
    def _aws_describe_images(ec2, image_ids: set[str]) -> dict[str, dict]:
        if not image_ids:
            return {}
        try:
            resp = ec2.describe_images(ImageIds=list(image_ids))
        except Exception:
            return {}
        return {img["ImageId"]: img for img in resp.get("Images", [])}

    def _aws_fetch_region_servers(self, ec2, region: str) -> list[dict[str, Any]]:
        instances = []
        paginator = ec2.get_paginator("describe_instances")
        for page in paginator.paginate():
            for reservation in page["Reservations"]:
                instances.extend(reservation["Instances"])

        image_ids = {i["ImageId"] for i in instances if i.get("ImageId")}
        images_by_id = self._aws_describe_images(ec2, image_ids)

        return [self._aws_instance_to_server(i, region, images_by_id) for i in instances]

    def fetch_servers(self) -> list[dict[str, Any]]:
        try:
            import boto3  # noqa: F401
        except ImportError:
            raise RuntimeError("boto3 not installed. Run: pip install boto3")

        servers = []
        for region in self._aws_regions():
            ec2 = self._aws_client("ec2", region)
            servers.extend(self._aws_fetch_region_servers(ec2, region))
        return servers

    def fetch_databases(self) -> list[dict[str, Any]]:
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

    def fetch_kubernetes(self) -> list[dict[str, Any]]:
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

    @staticmethod
    def _aws_volume_to_dict(vol: dict, region: str) -> dict[str, Any]:
        tags, name = _aws_tags_and_name(vol.get("Tags", []))
        attachments = vol.get("Attachments", [])
        attachment = attachments[0].get("InstanceId") if attachments else None
        return {
            "cloud_id": vol["VolumeId"],
            "name": name or vol["VolumeId"],
            "provider": "aws",
            "region": region,
            "size_gb": float(vol.get("Size", 0)),
            "status": VOLUME_STATUS_MAP.get(vol.get("State", ""), "unknown"),
            "attachment": attachment,
            "volume_type": vol.get("VolumeType"),
            "tags": tags,
            "extra": {
                "availability_zone": vol.get("AvailabilityZone"),
                "created_at": str(vol.get("CreateTime", "")),
                "encrypted": vol.get("Encrypted"),
                "iops": vol.get("Iops"),
                "throughput": vol.get("Throughput"),
            },
        }

    def _aws_fetch_region_volumes(self, ec2, region: str) -> list[dict[str, Any]]:
        volumes = []
        paginator = ec2.get_paginator("describe_volumes")
        for page in paginator.paginate():
            for vol in page.get("Volumes", []):
                volumes.append(self._aws_volume_to_dict(vol, region))
        return volumes

    def fetch_block_storages(self) -> list[dict[str, Any]]:
        result = []
        for region in self._aws_regions():
            ec2 = self._aws_client("ec2", region)
            try:
                result.extend(self._aws_fetch_region_volumes(ec2, region))
            except Exception:
                continue
        return result
