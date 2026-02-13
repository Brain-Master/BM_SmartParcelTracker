import json
import re
from typing import Any


JSON_OBJECT_RE = re.compile(r"\{.*\}", re.DOTALL)


def parse_llm_payload(raw_payload: str) -> dict[str, Any]:
    """Parse potentially dirty LLM JSON and fill required defaults.

    Expected structure:
    {
      "order_id": str,
      "items": [{"sku": str, "qty": int, "price": float}]
    }
    """
    match = JSON_OBJECT_RE.search(raw_payload)
    if not match:
        raise ValueError("No JSON object found in LLM payload")

    parsed = json.loads(match.group(0))

    normalized_items = []
    for item in parsed.get("items", []):
        normalized_items.append(
            {
                "sku": item.get("sku", "UNKNOWN"),
                "qty": int(item.get("qty", 0) or 0),
                "price": float(item.get("price", 0) or 0),
            }
        )

    return {
        "order_id": parsed.get("order_id", "MISSING_ORDER_ID"),
        "items": normalized_items,
    }
