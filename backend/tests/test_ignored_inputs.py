from app import schemas


def test_server_region_edit_is_accepted():
    assert schemas.ServerUpdate(region="eu").model_dump(exclude_unset=True) == {"region": "eu"}
