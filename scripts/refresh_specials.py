#!/usr/bin/env python3
"""Refresh current Messina flavour names and derived pairing profiles.

The official page is used only to identify the current rotation and its stated
building blocks. The public output retains names, dates and independent derived
sensory tags; it does not republish official descriptions or imagery.
"""

from __future__ import annotations

import argparse
import datetime as dt
import html as html_module
import json
import re
import sys
import urllib.request
from pathlib import Path
from zoneinfo import ZoneInfo


SOURCE_URL = "https://specials.gelatomessina.com/current-specials"
USER_AGENT = "ScoopTheory/1.0 (+https://scoops.drtarr.com/)"

TAG_RULES = {
    "dark chocolate": ["dark chocolate"],
    "milk chocolate": ["milk chocolate"],
    "white chocolate": ["white chocolate"],
    "chocolate": ["chocolate", "cocoa", "choc"],
    "fudge": ["fudge"],
    "coffee": ["coffee", "espresso", "tiramisu"],
    "roast": ["roast", "toasted", "coffee", "espresso"],
    "caramel": ["caramel", "toffee"],
    "dulce de leche": ["dulce de leche", "dulce"],
    "vanilla": ["vanilla", "fior de latte"],
    "custard": ["custard", "flan"],
    "cheesecake": ["cheesecake", "cream cheese"],
    "cream": ["cream", "fior de latte"],
    "yoghurt": ["yoghurt", "yogurt"],
    "peanut": ["peanut"],
    "hazelnut": ["hazelnut"],
    "pistachio": ["pistachio"],
    "macadamia": ["macadamia"],
    "praline": ["praline"],
    "coconut": ["coconut"],
    "pandan": ["pandan"],
    "mango": ["mango"],
    "passionfruit": ["passionfruit", "passion fruit"],
    "strawberry": ["strawberry"],
    "berry": ["berry", "raspberry", "boysenberry", "blueberry"],
    "citrus": ["orange", "lemon", "lime", "yuzu", "mandarin", "citrus"],
    "fruit": ["mango", "banana", "strawberry", "berry", "orange", "lemon", "lime", "yuzu", "peach", "apple", "pear", "cherry", "passionfruit", "lychee"],
    "tropical": ["mango", "banana", "passionfruit", "lychee", "coconut", "pandan", "pineapple"],
    "biscuit": ["biscuit", "cookie", "shortbread", "wafer", "ladyfinger", "pancake", "cake", "bread", "toast"],
    "cookie": ["cookie"],
    "cake": ["cake", "brownie"],
    "malt": ["malt"],
    "crunch": ["crunch", "praline", "brittle", "chip"],
    "salt": ["salt", "salted"],
    "boozy": ["rum", "marsala", "whisky", "whiskey", "bourbon", "liqueur", "vermouth", "gin"],
}

COLOURS = {
    "bright": "#e86d68",
    "tropical": "#efb04f",
    "chocolate": "#7d4a3d",
    "nut": "#c7a46f",
    "custard": "#d29a5c",
    "bakery": "#c28d6c",
}


def fetch_html(path: str | None) -> str:
    if path:
        return Path(path).read_text(encoding="utf-8")
    request = urllib.request.Request(SOURCE_URL, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        return response.read().decode("utf-8")


def decode_flight_text(page: str) -> str:
    chunks: list[str] = []
    pattern = re.compile(r"<script[^>]*>self\.__next_f\.push\((.*?)\)</script>", re.S)
    for match in pattern.finditer(page):
        try:
            payload = json.loads(match.group(1))
        except json.JSONDecodeError:
            continue
        if len(payload) > 1 and isinstance(payload[1], str):
            chunks.append(payload[1])
    return "\n".join(chunks)


def balanced_json(text: str, start: int, opener: str, closer: str):
    begin = text.find(opener, start)
    if begin < 0:
        raise ValueError(f"Could not find {opener!r} after offset {start}")
    depth = 0
    in_string = False
    escaped = False
    for index in range(begin, len(text)):
        character = text[index]
        if in_string:
            if escaped:
                escaped = False
            elif character == "\\":
                escaped = True
            elif character == '"':
                in_string = False
            continue
        if character == '"':
            in_string = True
        elif character == opener:
            depth += 1
        elif character == closer:
            depth -= 1
            if depth == 0:
                return json.loads(text[begin:index + 1])
    raise ValueError(f"Unbalanced {opener}{closer} data")


def extract_specials(page: str) -> list[dict]:
    flight = decode_flight_text(page)
    out_marker = flight.find('"outSlugs":')
    if out_marker < 0:
        raise ValueError("Current rotation slug list was not found")
    out_slugs = balanced_json(flight, out_marker, "[", "]")

    found: dict[str, dict] = {}
    marker = '"special":'
    cursor = 0
    while True:
        cursor = flight.find(marker, cursor)
        if cursor < 0:
            break
        item = balanced_json(flight, cursor + len(marker), "{", "}")
        if item.get("slug"):
            found[item["slug"]] = item
        cursor += len(marker)

    missing = [slug for slug in out_slugs if slug not in found]
    if missing:
        raise ValueError(f"Current specials were missing from page data: {missing}")
    selected = [found[slug] for slug in out_slugs]
    if len(selected) != 10:
        raise ValueError(f"Expected 10 current specials, found {len(selected)}")
    return selected


def strip_tags(value: str) -> str:
    return html_module.unescape(re.sub(r"<[^>]+>", "", value)).strip()


def extract_rotation(page: str, now: dt.datetime) -> dict:
    match = re.search(
        r"Available from\s*<span[^>]*>(.*?)</span>\s*til(?:<!--\s*-->)?\s*<span[^>]*>(.*?)</span>",
        page,
        re.S | re.I,
    )
    if not match:
        raise ValueError("Current rotation dates were not found")
    start_text, end_text = map(strip_tags, match.groups())
    start = parse_partial_date(start_text, now.year)
    end = parse_partial_date(end_text, now.year)
    if end < start:
        end = end.replace(year=end.year + 1)
    return {
        "label": f"{start.strftime('%B')} {start.year} specials",
        "from": start.isoformat(),
        "to": end.isoformat(),
    }


def parse_partial_date(value: str, year: int) -> dt.date:
    cleaned = re.sub(r"\s+", " ", value.strip())
    return dt.datetime.strptime(f"{cleaned} {year}", "%d %B %Y").date()


def smart_title(value: str) -> str:
    titled = value.title().replace("'S", "'s")
    return re.sub(r"\bAnd\b", "and", titled)


def derive_tags(item: dict) -> list[str]:
    material = " ".join([
        item.get("displayName", ""),
        item.get("description", ""),
        " ".join(item.get("bases") or []),
        " ".join(item.get("additions") or []),
        " ".join(item.get("themes") or []),
    ]).lower()
    tags = [tag for tag, words in TAG_RULES.items() if any(word in material for word in words)]
    if any(tag in tags for tag in ("peanut", "hazelnut", "pistachio", "macadamia")):
        tags.append("nut")
    if "sorbet" in material:
        tags.append("fresh")
    else:
        tags.append("creamy")
    return list(dict.fromkeys(tags))


def derive_family(tags: list[str]) -> str:
    tag_set = set(tags)
    if tag_set & {"mango", "passionfruit", "coconut", "pandan", "tropical"}:
        return "tropical"
    if tag_set & {"citrus", "strawberry", "berry", "fruit"} and not tag_set & {"chocolate", "nut", "caramel"}:
        return "bright"
    if tag_set & {"peanut", "hazelnut", "pistachio", "macadamia", "praline", "nut"}:
        return "nut"
    if tag_set & {"dark chocolate", "milk chocolate", "chocolate", "cocoa", "fudge"}:
        return "chocolate"
    if tag_set & {"cookie", "biscuit", "cake", "malt"}:
        return "bakery"
    return "custard"


def derive_profile(tags: list[str], format_name: str) -> dict:
    tag_set = set(tags)
    sorbet = format_name == "sorbet"
    richness = 1 if sorbet else 3
    richness += sum(tag in tag_set for tag in ("cheesecake", "fudge", "caramel", "dulce de leche", "praline"))
    if tag_set & {"dark chocolate", "milk chocolate", "white chocolate", "peanut", "macadamia"}:
        richness += 1
    brightness = 0
    if tag_set & {"citrus", "passionfruit"}:
        brightness = 5
    elif tag_set & {"berry", "strawberry"}:
        brightness = 4
    elif tag_set & {"mango", "fruit", "tropical"}:
        brightness = 3
    sweetness = 3
    sweetness += sum(tag in tag_set for tag in ("caramel", "dulce de leche", "white chocolate", "fudge"))
    if "dark chocolate" in tag_set or "coffee" in tag_set:
        sweetness -= 1
    roast = 0
    if "coffee" in tag_set:
        roast = 5
    elif "dark chocolate" in tag_set:
        roast = 4
    elif tag_set & {"chocolate", "nut", "praline", "malt", "roast"}:
        roast = 3
    return {
        "richness": max(1, min(5, richness)),
        "brightness": brightness,
        "sweetness": max(1, min(5, sweetness)),
        "roast": roast,
    }


def format_name(item: dict) -> str:
    material = " ".join((item.get("bases") or []) + [item.get("description", "")]).lower()
    if "sherbet" in material:
        return "sherbet gelato"
    if "sorbet" in material:
        return "sorbet"
    return "gelato"


def derived_note(tags: list[str], format_value: str) -> str:
    preferred = [
        tag for tag in tags
        if tag not in {"creamy", "fresh", "fruit", "nut", "chocolate", "roast", "biscuit"}
    ][:3]
    if not preferred:
        preferred = tags[:2]
    notes = ", ".join(preferred[:-1]) + (" and " if len(preferred) > 1 else "") + (preferred[-1] if preferred else "contrast")
    return f"A current {format_value} profiled around {notes}."


def build_entry(item: dict, old: dict | None, used_ids: set[str]) -> dict:
    source_slug = item["slug"]
    if old:
        entry = dict(old)
        entry["name"] = smart_title(item["displayName"])
        entry["sourceSlug"] = source_slug
        return entry

    identifier = source_slug
    if identifier in used_ids:
        identifier = f"{identifier}-special"
    tags = derive_tags(item)
    format_value = format_name(item)
    family = derive_family(tags)
    return {
        "id": identifier,
        "sourceSlug": source_slug,
        "name": smart_title(item["displayName"]),
        "kind": "special",
        "format": format_value,
        "family": family,
        "note": derived_note(tags, format_value),
        "colour": COLOURS[family],
        "profile": derive_profile(tags, format_value),
        "tags": tags,
        "pairs": [],
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", help="Read an already-downloaded HTML page")
    parser.add_argument("--output", default="data/specials.json")
    parser.add_argument("--classics", default="data/classics.json")
    parser.add_argument("--check-only", action="store_true")
    args = parser.parse_args()

    page = fetch_html(args.source)
    raw_specials = extract_specials(page)
    now = dt.datetime.now(ZoneInfo("Australia/Sydney"))
    rotation = extract_rotation(page, now)

    output_path = Path(args.output)
    previous = json.loads(output_path.read_text(encoding="utf-8")) if output_path.exists() else {"flavours": []}
    previous_by_slug = {item.get("sourceSlug"): item for item in previous.get("flavours", [])}
    classics = json.loads(Path(args.classics).read_text(encoding="utf-8"))
    used_ids = {item["id"] for item in classics["flavours"]}

    entries = []
    for item in raw_specials:
        entry = build_entry(item, previous_by_slug.get(item["slug"]), used_ids)
        if entry["id"] in used_ids:
            raise ValueError(f"Duplicate flavour id: {entry['id']}")
        used_ids.add(entry["id"])
        entries.append(entry)

    result = {
        "source": {
            "label": "Gelato Messina current specials",
            "url": SOURCE_URL,
            "checkedAt": now.date().isoformat(),
        },
        "rotation": rotation,
        "flavours": entries,
    }
    encoded = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    json.loads(encoded)
    if args.check_only:
        print(f"Validated {len(entries)} specials for {rotation['label']}")
        return 0
    output_path.write_text(encoded, encoding="utf-8")
    print(f"Wrote {len(entries)} specials for {rotation['label']} to {output_path}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"Refresh failed: {error}", file=sys.stderr)
        raise
