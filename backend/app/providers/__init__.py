from .aws import AWSProvider
from .gcp import GCPProvider
from .azure import AzureProvider
from .linode import LinodeProvider
from .digitalocean import DigitalOceanProvider
from .ovh import OVHProvider

PROVIDER_MAP = {
    "aws":          AWSProvider,
    "gcp":          GCPProvider,
    "azure":        AzureProvider,
    "linode":       LinodeProvider,
    "digitalocean": DigitalOceanProvider,
    "ovh":          OVHProvider,
}


def get_provider(provider_type: str, config: dict):
    cls = PROVIDER_MAP.get(provider_type)
    if not cls:
        raise ValueError(f"Unknown provider: {provider_type}")
    return cls(config)
