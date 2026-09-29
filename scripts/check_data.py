#!/usr/bin/env python3
"""Check the flavour data before it goes live.

    python3 scripts/check_data.py            # errors fail the run
    python3 scripts/check_data.py --strict   # also fail if a special still needs its write-up

Errors: anything that would break or mislead the site (missing fields, unknown
families, scores out of range, duplicate ids). Warnings: things worth a look but
safe to publish, such as a partner that has left the cabinet (the site skips it).
"""
import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FAMILIES = {"bright", "tropical", "chocolate", "nut", "custard", "bakery"}
FORMATS = {"gelato", "sorbet", "yoghurt gelato", "sherbet gelato"}
PROFILE_KEYS = ("richness", "brightness", "sweetness", "roast")
REQUIRED = ("id", "name", "kind", "format", "family", "note", "colour", "profile", "tags", "pairs")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--strict", action="store_true", help="treat unfinished write-ups as errors")
    args = parser.parse_args()

    classics = json.loads((ROOT / "data/classics.json").read_text(encoding="utf-8"))
    specials = json.loads((ROOT / "data/specials.json").read_text(encoding="utf-8"))
    flavours = [("classic", item) for item in classics["flavours"]] + [("special", item) for item in specials["flavours"]]
    errors, warnings = [], []
    ids = [item.get("id") for _, item in flavours]
    known = set(ids)

    for duplicate in sorted({i for i in ids if ids.count(i) > 1}):
        errors.append(f"duplicate id: {duplicate}")

    for _, item in flavours:
        label = item.get("name") or item.get("id") or "?"
        for key in REQUIRED:
            if key not in item:
                errors.append(f"{label}: missing {key}")
        if item.get("family") not in FAMILIES:
            errors.append(f"{label}: unknown family {item.get('family')!r}")
        if item.get("format") not in FORMATS:
            errors.append(f"{label}: unknown format {item.get('format')!r}")
        if not re.fullmatch(r"#[0-9a-fA-F]{6}", str(item.get("colour", ""))):
            errors.append(f"{label}: colour should be #rrggbb")
        profile = item.get("profile") or {}
        for key in PROFILE_KEYS:
            value = profile.get(key)
            if not isinstance(value, int) or not 0 <= value <= 5:
                errors.append(f"{label}: profile {key} should be a whole number from 0 to 5")
        tags = item.get("tags")
        if not isinstance(tags, list) or not tags or not all(isinstance(t, str) and t == t.lower() for t in tags):
            errors.append(f"{label}: tags should be a non-empty list of lower-case words")
        note = str(item.get("note", ""))
        if not 10 <= len(note) <= 220:
            errors.append(f"{label}: note should be one sentence (10-220 characters)")
        if "–" in note or "—" in note:
            errors.append(f"{label}: use a hyphen (-), not an en or em dash")
        for pair in item.get("pairs") or []:
            if pair.get("id") == item.get("id"):
                errors.append(f"{label}: pairs with itself")
            elif pair.get("id") not in known:
                # A partner that has left the cabinet is simply skipped by the site.
                warnings.append(f"{label}: partner {pair.get('id')!r} is not in the current cabinet")
            if not str(pair.get("why", "")).strip():
                errors.append(f"{label}: partner {pair.get('id')!r} has no reason")
        if item.get("needsReview"):
            (errors if args.strict else warnings).append(f"{label}: still needs its write-up (placeholder profile)")

    rotation = specials.get("rotation") or {}
    for key in ("label", "from", "to"):
        if not rotation.get(key):
            errors.append(f"specials rotation: missing {key}")

    for line in warnings:
        print(f"warning: {line}")
    for line in errors:
        print(f"error: {line}")
    print(f"{len(flavours)} flavours checked: {len(errors)} errors, {len(warnings)} warnings")
    return 1 if errors else 0


if __name__ == "__main__":
    sys.exit(main())
