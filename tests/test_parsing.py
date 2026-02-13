import pytest

from app.parsing import parse_llm_payload


def test_parse_dirty_llm_json_with_wrappers() -> None:
    raw = "Model response:\n```json\n{\"order_id\": \"A-12\", \"items\": [{\"sku\": \"X1\", \"qty\": 2, \"price\": 10.5}]}\n```"

    payload = parse_llm_payload(raw)

    assert payload["order_id"] == "A-12"
    assert payload["items"] == [{"sku": "X1", "qty": 2, "price": 10.5}]


def test_parse_incomplete_llm_json_uses_defaults() -> None:
    raw = '{"items": [{"qty": null}, {}]}'

    payload = parse_llm_payload(raw)

    assert payload["order_id"] == "MISSING_ORDER_ID"
    assert payload["items"] == [
        {"sku": "UNKNOWN", "qty": 0, "price": 0.0},
        {"sku": "UNKNOWN", "qty": 0, "price": 0.0},
    ]


def test_parse_llm_json_raises_without_json_body() -> None:
    with pytest.raises(ValueError, match="No JSON object found"):
        parse_llm_payload("totally unstructured output")
