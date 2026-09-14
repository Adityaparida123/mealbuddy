"""Convert the provided canteen Excel dataset into src/data/menu.json.

Usage:
    python scripts/convert_menu.py [path/to/canteen_chatbot_dataset.xlsx]
"""
import json
import os
import re
import sys

import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_SRC = os.path.join(ROOT, "canteen_chatbot_dataset (2).xlsx")
DEST = os.path.join(ROOT, "src", "data", "menu.json")

SPICY_WORDS = {"spicy", "chilli", "chili", "spices", "pepper", "hot", "masala"}


def parse_tags(v):
    if v is None:
        return []
    s = str(v).strip()
    if s.lower() in ("null", "none", "nan", "na", "-", ""):
        return []
    return [t.strip().lower() for t in s.split(",") if t.strip()]


def parse_int(v):
    if v is None:
        return None
    s = str(v).strip()
    if s.lower() in ("null", "none", "nan", "na", "-", ""):
        return None
    m = re.search(r"\d+", s)
    return int(m.group()) if m else None


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_SRC
    if not os.path.exists(src):
        print(f"ERROR: dataset not found at {src}")
        sys.exit(1)

    wb = openpyxl.load_workbook(src, data_only=True)
    ws = wb["Menu_Items"]
    rows = list(ws.iter_rows(values_only=True))
    header = rows[0]
    items = []

    for row in rows[1:]:
        raw = dict(zip(header, row))
        if not raw.get("item_name"):
            continue
        ingredients = parse_tags(raw.get("ingredients"))
        dietary_tags = parse_tags(raw.get("dietary_tags"))
        mood = parse_tags(raw.get("mood_tag"))
        allergens = parse_tags(raw.get("allergens"))
        price = raw.get("price")
        if isinstance(price, str):
            price = parse_int(price)

        diet_type = None
        if "non-veg" in dietary_tags:
            diet_type = "non-veg"
        elif "vegan" in dietary_tags:
            diet_type = "vegan"
        elif "veg" in dietary_tags:
            diet_type = "veg"
        gluten_free = "gluten-free" in dietary_tags

        spice_hint = any(w in mood for w in ("spicy",)) or any(
            w in " ".join(ingredients).lower() for w in SPICY_WORDS
        )

        tags = list(dietary_tags) + mood
        if raw.get("category"):
            tags.append(str(raw["category"]).strip().lower())
        if gluten_free:
            tags.append("gluten-free")

        items.append({
            "id": str(raw["item_id"]).strip(),
            "name": str(raw["item_name"]).strip(),
            "price": price,
            "category": str(raw.get("category") or "").strip(),
            "ingredients": ingredients,
            "allergens": allergens,
            "diet": dietary_tags,
            "dietType": diet_type,
            "glutenFree": gluten_free,
            "spiceLevel": "spicy" if spice_hint else ("mild" if mood else None),
            "prepTime": parse_int(raw.get("prep_time_min")),
            "available": str(raw.get("availability") or "").strip().lower() == "available",
            "calories": parse_int(raw.get("calories")),
            "mood": mood,
            "tags": tags,
        })

    os.makedirs(os.path.dirname(DEST), exist_ok=True)
    with open(DEST, "w", encoding="utf-8") as f:
        json.dump(items, f, ensure_ascii=False, indent=2)
    print(f"Wrote {len(items)} menu items -> {DEST}")


if __name__ == "__main__":
    main()