#!/usr/bin/env python3
"""Render the PNG versions of the artwork from the SVGs made by draw_art.py.

Needs Playwright with Chromium (pip install playwright; playwright install chromium).

    python3 scripts/render_png.py
    python3 scripts/render_png.py --serif SourceSerif4.woff2 --serif-italic SourceSerif4-Italic.woff2 --sans Inter.woff2

The social card is typeset in the site's own font stack. On a Mac that means
Iowan Old Style with no extra arguments; elsewhere, pass font files so the
card is not set in a fallback serif.

Writes og-image.png (1200 x 630), apple-touch-icon.png (180 x 180),
art/icon-192.png and art/icon-512.png.
"""
import argparse
import asyncio
import tempfile
from pathlib import Path

from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parent.parent

JOBS = [
    ("og-image.svg", "og-image.png", 1200, 630, 1200),
    ("art/app-icon.svg", "apple-touch-icon.png", 64, 64, 180),
    ("art/app-icon.svg", "art/icon-192.png", 64, 64, 192),
    ("art/app-icon.svg", "art/icon-512.png", 64, 64, 512),
]


def font_css(args):
    rules = []
    if args.serif:
        rules.append(f"@font-face{{font-family:'Iowan Old Style';src:url('{Path(args.serif).resolve().as_uri()}');font-weight:200 900;font-style:normal}}")
    if args.serif_italic:
        rules.append(f"@font-face{{font-family:'Iowan Old Style';src:url('{Path(args.serif_italic).resolve().as_uri()}');font-weight:200 900;font-style:italic}}")
    if args.sans:
        rules.append(f"@font-face{{font-family:'Inter';src:url('{Path(args.sans).resolve().as_uri()}');font-weight:100 900}}")
    return "".join(rules)


async def render(args):
    fonts = font_css(args)
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        for source, target, vw, vh, out_w in JOBS:
            scale = out_w / vw
            page = await browser.new_page(viewport={"width": vw, "height": vh}, device_scale_factor=scale)
            svg = (ROOT / source).read_text()
            # Inline the SVG in a local HTML page so the @font-face rules reach its text.
            html = f"<html><head><style>{fonts}html,body{{margin:0}}svg{{display:block;width:{vw}px;height:{vh}px}}</style></head><body>{svg}</body></html>"
            with tempfile.NamedTemporaryFile("w", suffix=".html", delete=False) as handle:
                handle.write(html)
            await page.goto(Path(handle.name).as_uri())
            Path(handle.name).unlink()
            await page.evaluate("document.fonts.ready")
            await page.wait_for_timeout(200)
            await page.screenshot(path=str(ROOT / target), clip={"x": 0, "y": 0, "width": vw, "height": vh})
            await page.close()
            print(target)
        await browser.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--serif", help="upright serif font file standing in for Iowan Old Style")
    parser.add_argument("--serif-italic", help="italic serif font file")
    parser.add_argument("--sans", help="sans font file standing in for Inter")
    asyncio.run(render(parser.parse_args()))
