from abc import ABC, abstractmethod
from typing import List, Dict, Any


class CloudProvider(ABC):
    def __init__(self, config: Dict[str, Any]):
        self.config = config

    @abstractmethod
    def fetch_servers(self) -> List[Dict[str, Any]]:
        pass

    @property
    @abstractmethod
    def provider_name(self) -> str:
        pass

    def fetch_databases(self) -> List[Dict[str, Any]]:
        return []

    def fetch_kubernetes(self) -> List[Dict[str, Any]]:
        return []

    def fetch_block_storages(self) -> List[Dict[str, Any]]:
        return []

