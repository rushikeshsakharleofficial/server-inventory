import ipaddress
from typing import Any
from .base import CloudProvider

POWER_MAP = {"ON": "running", "OFF": "stopped"}
PAGE = 500


class NutanixProvider(CloudProvider):
    @property
    def provider_name(self) -> str:
        return "nutanix"

    def _conn(self) -> tuple[str, dict[str, Any]]:
        """Return (base_url, requests kwargs for auth/TLS)."""
        base = self.config["prism_url"].rstrip("/")
        if not base.startswith("https://"):
            # Basic auth must never travel in cleartext.
            raise ValueError("Nutanix prism_url must start with https://")
        verify = str(self.config.get("verify_ssl", "true")).lower() != "false"
        if not verify:
            import urllib3
            urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
        return base, {"auth": (self.config["username"], self.config["password"]), "verify": verify, "timeout": 30}

    def fetch_object_storages(self) -> list[dict[str, Any]]:
        import requests

        base, kw = self._conn()
        out: list[dict[str, Any]] = []
        page = 0
        while True:
            resp = requests.get(
                f"{base}/api/objects/v4.0/config/object-stores",
                params={"$page": page, "$limit": 50},
                **kw,
            )
            if resp.status_code == 503:
                # shortcut: a 503 also hides a real Objects outage; upgrade by checking the PC's service list.
                return out  # Objects service not enabled on this Prism Central
            resp.raise_for_status()
            body = resp.json()
            rows = body.get("data") or []
            for o in rows:
                state = o.get("state") or ""
                out.append({
                    "cloud_id": o["extId"],
                    "name": o.get("name") or o["extId"],
                    "provider": "nutanix",
                    "region": None,  # v4.0 returns only the cluster UUID, not its name
                    "status": "running" if state == "OBJECT_STORE_AVAILABLE" else "failed" if "FAILED" in state else "pending",
                    "endpoint": o.get("domain") or None,
                    "tags": {},
                    "extra": {
                        "state": state,
                        "description": o.get("description"),
                        "cluster_uuid": o.get("clusterExtId"),
                        "deployment_version": o.get("deploymentVersion"),
                        "worker_nodes": o.get("numWorkerNodes"),
                        "created": o.get("creationTime"),
                    },
                })
            page += 1
            total = (body.get("metadata") or {}).get("totalAvailableResults", len(out))
            if not rows or len(out) >= total:
                return out

    def _entities(self, kind: str, path: str):
        """Yield every v3 entity of *kind*, following offset pagination."""
        import requests

        base, kw = self._conn()
        offset = 0
        while True:
            resp = requests.post(
                f"{base}/api/nutanix/v3/{path}/list",
                json={"kind": kind, "length": PAGE, "offset": offset},
                **kw,
            )
            resp.raise_for_status()
            data = resp.json()
            yield from data.get("entities", [])
            offset += PAGE
            if offset >= (data.get("metadata") or {}).get("total_matches", 0):
                return

    def fetch_block_storages(self) -> list[dict[str, Any]]:
        out = []
        for ent in self._entities("volume_group", "volume_groups"):
            meta, status = ent.get("metadata") or {}, ent.get("status") or {}
            res = status.get("resources") or {}
            size_mib = res.get("size_mib")
            att = res.get("attachment_list") or []
            vm = (att[0].get("vm_reference") or {}) if att else {}
            out.append({
                "cloud_id": meta["uuid"],
                "name": status.get("name") or meta["uuid"],
                "provider": "nutanix",
                "region": (status.get("cluster_reference") or {}).get("name"),
                "size_gb": round(size_mib / 1024, 1) if size_mib else None,
                "status": "running" if status.get("state") == "COMPLETE" else "pending",
                # VM uuid matches Server.cloud_id; IQN is the fallback for guest-attached (iSCSI) groups
                "attachment": (vm.get("uuid") or att[0].get("iscsi_initiator_name")) if att else None,
                "volume_type": res.get("usage_type"),
                "tags": meta.get("categories") or {},
                "extra": {
                    "iscsi_target": res.get("iscsi_target_name"),
                    "sharing_status": res.get("sharing_status"),
                    "attachments": len(att),
                    "iscsi_initiators": [a.get("iscsi_initiator_name") for a in att if a.get("iscsi_initiator_name")],
                },
            })
        out.extend(self._vm_disks())
        return out

    def _vm_disks(self) -> list[dict[str, Any]]:
        """One row per virtual disk of every VM (CD-ROMs skipped)."""
        out = []
        for ent in self._entities("vm", "vms"):
            meta, status = ent.get("metadata") or {}, ent.get("status") or {}
            res = status.get("resources") or {}
            vm_name = status.get("name") or meta["uuid"]
            for i, d in enumerate(res.get("disk_list") or []):
                props = d.get("device_properties") or {}
                if props.get("device_type") != "DISK":
                    continue
                mib = d.get("disk_size_mib")
                addr = props.get("disk_address") or {}
                bus = f"{(addr.get('adapter_type') or 'disk').lower()}.{addr.get('device_index', i)}"
                out.append({
                    "cloud_id": d.get("uuid") or f"{meta['uuid']}-{i}",
                    "name": f"{vm_name} / {bus}",
                    "provider": "nutanix",
                    "region": (status.get("cluster_reference") or {}).get("name"),
                    "size_gb": round(mib / 1024, 1) if mib else None,
                    "status": "running",
                    "attachment": meta["uuid"],
                    "volume_type": "vm-disk",
                    "tags": {},
                    "extra": {"vm_name": vm_name, "bus": bus, "storage_container": (d.get("storage_config") or {}).get("storage_container_reference", {}).get("name")},
                })
        return out

    def fetch_servers(self) -> list[dict[str, Any]]:
        servers: list[dict[str, Any]] = []
        for ent in self._entities("vm", "vms"):
            meta = ent.get("metadata") or {}
            status = ent.get("status") or {}
            res = status.get("resources") or {}
            ips = [
                ep["ip"]
                for nic in res.get("nic_list") or []
                for ep in nic.get("ip_endpoint_list") or []
                if ep.get("ip")
            ]
            private = next((i for i in ips if ipaddress.ip_address(i).is_private), None)
            public = next((i for i in ips if not ipaddress.ip_address(i).is_private), None)
            vcpu = (res.get("num_sockets") or 0) * (res.get("num_vcpus_per_socket") or 0)
            mem_mib = res.get("memory_size_mib")
            disk_mib = sum(
                d.get("disk_size_mib") or 0
                for d in res.get("disk_list") or []
                if (d.get("device_properties") or {}).get("device_type") == "DISK"
            )
            servers.append({
                "cloud_id": meta["uuid"],
                "name": status.get("name") or meta["uuid"],
                "provider": "nutanix",
                "region": (status.get("cluster_reference") or {}).get("name"),
                "instance_type": None,
                "status": POWER_MAP.get(res.get("power_state", ""), "unknown"),
                "public_ip": public,
                "private_ip": private,
                "vcpu": vcpu or None,
                "memory_gb": round(mem_mib / 1024, 1) if mem_mib else None,
                "storage_gb": round(disk_mib / 1024, 1) if disk_mib else None,
                "os": None,
                "tags": meta.get("categories") or {},
                "extra": {
                    "cluster_uuid": (status.get("cluster_reference") or {}).get("uuid"),
                    "host": (res.get("host_reference") or {}).get("name"),
                    "all_ips": ips,
                },
            })

        return servers
