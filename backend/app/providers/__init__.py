from typing import Any

from .aws import AWSProvider
from .azure import AzureProvider
from .base import CloudProvider
from .cloudflare import CloudflareProvider
from .contabo import ContaboProvider
from .digitalocean import DigitalOceanProvider
from .gcp import GCPProvider
from .generic_dns import GenericDnsProvider
from .linode import LinodeProvider
from .hivelocity import HivelocityProvider
from .ovh import OVHProvider

PROVIDER_MAP: dict[str, type[CloudProvider]] = {
    "aws":          AWSProvider,
    "gcp":          GCPProvider,
    "azure":        AzureProvider,
    "linode":       LinodeProvider,
    "digitalocean": DigitalOceanProvider,
    "ovh":          OVHProvider,
    "hivelocity":   HivelocityProvider,
    "cloudflare":   CloudflareProvider,
    "generic-dns":  GenericDnsProvider,
    "contabo":      ContaboProvider,
}


def get_provider(provider_type: str, config: dict[str, Any]) -> CloudProvider:
    """Return an instantiated CloudProvider for *provider_type*.

    Args:
        provider_type: Lowercase provider slug (e.g. 'aws', 'gcp').
        config: Provider-specific credential/configuration dict.

    Raises:
        ValueError: If *provider_type* is not in PROVIDER_MAP.
    """
    cls = PROVIDER_MAP.get(provider_type)
    if not cls:
        raise ValueError(f"Unknown provider: {provider_type}")
    return cls(config)
