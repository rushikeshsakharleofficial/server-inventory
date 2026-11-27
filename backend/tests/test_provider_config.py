"""The credential shapes the UI saves must be the shapes providers read."""
import json

from app.providers.aws import AWSProvider
from app.providers.gcp import GCPProvider


def test_gcp_reads_json_string():
    provider = GCPProvider({"service_account_json": json.dumps({"project_id": "p1"})})
    assert provider._gcp_project_id() == "p1"


def test_aws_region_from_ui_form():
    assert AWSProvider({"region": "eu-west-1"})._aws_regions() == ["eu-west-1"]
    assert AWSProvider({"regions": "a,b", "region": "c"})._aws_regions() == ["a", "b"]
    assert AWSProvider({})._aws_regions() == ["us-east-1"]
