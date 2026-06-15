"""Tests for Page[T] pagination schema."""
import pytest
from pydantic import ValidationError


def _get_page():
    from app.schemas import Page, _MAX_PAGE_SIZE, _DEFAULT_PAGE_SIZE
    return Page, _MAX_PAGE_SIZE, _DEFAULT_PAGE_SIZE


class TestPageSchema:
    def test_basic_construction(self):
        Page, _, _ = _get_page()
        p = Page[str](total=100, limit=10, offset=0, items=["a", "b"])
        assert p.total == 100
        assert p.limit == 10
        assert p.offset == 0
        assert p.items == ["a", "b"]

    def test_empty_items(self):
        Page, _, _ = _get_page()
        p = Page[int](total=0, limit=50, offset=0, items=[])
        assert p.items == []
        assert p.total == 0

    def test_serializes_to_dict(self):
        Page, _, _ = _get_page()
        p = Page[str](total=5, limit=5, offset=0, items=["x"])
        d = p.model_dump()
        assert set(d.keys()) == {"total", "limit", "offset", "items"}

    def test_default_page_size_value(self):
        _, _MAX_PAGE_SIZE, _DEFAULT_PAGE_SIZE = _get_page()
        assert _DEFAULT_PAGE_SIZE == 50
        assert _MAX_PAGE_SIZE == 500

    def test_nested_model_items(self):
        from pydantic import BaseModel
        Page, _, _ = _get_page()

        class Item(BaseModel):
            id: int
            name: str

        p = Page[Item](total=1, limit=50, offset=0, items=[Item(id=1, name="srv")])
        assert p.items[0].name == "srv"
