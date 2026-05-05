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
