from abc import ABC, abstractmethod
from typing import Any


class CloudProvider(ABC):
    """Abstract base class for all cloud provider integrations."""

    def __init__(self, config: dict[str, Any]) -> None:
        self.config: dict[str, Any] = config

    @abstractmethod
    def fetch_servers(self) -> list[dict[str, Any]]:
        """Fetch all compute servers/instances from the provider."""
        ...

    @property
    @abstractmethod
    def provider_name(self) -> str:
        """Return the canonical lowercase provider slug (e.g. 'aws')."""
        ...

    def fetch_databases(self) -> list[dict[str, Any]]:
        """Fetch managed database instances. Returns empty list if unsupported."""
        return []

    def fetch_kubernetes(self) -> list[dict[str, Any]]:
        """Fetch Kubernetes clusters. Returns empty list if unsupported."""
        return []

    def fetch_block_storages(self) -> list[dict[str, Any]]:
        """Fetch block storage volumes. Returns empty list if unsupported."""
        return []

