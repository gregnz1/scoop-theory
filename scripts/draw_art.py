#!/usr/bin/env python3
"""Draw the Scoop Theory artwork (the "cut paper" set) as SVG.

Standard library only. Output is deterministic, so re-running produces
identical files unless the drawing code below changes.

    python3 scripts/draw_art.py

Writes:
    art/hero.svg                 hero illustration (500 x 500)
    art/mark.svg                 three-scoop tub mark, no background
    art/app-icon.svg             square cream icon used to render the PNG icons
    art/scoop-<family>.svg       one scoop per flavour family, for the UI
    art/tub.svg, art/tub-light.svg   the tub for small cup drawings (cream and dark panels)
    favicon.svg                  mark on a cream rounded tile
    og-image.svg                 1200 x 630 social card source

The PNGs (og-image.png, apple-touch-icon.png, art/icon-192.png,
art/icon-512.png) are rendered from these SVGs with a headless browser;
see scripts/render_png.py.
"""
import math
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

INK = "#2c1e28"
CREAM = "#fff8ea"
PAPER = "#fffdf8"
ROSE = "#d74267"
PIST = "#b9cf8a"
MINT = "#9fd5c1"
LEMON = "#f3d46a"
RIM = "#46313e"
RIM_LIGHT = "#f3e6cf"

FAMILY = {
    "bright": ("#e86d68", "seeds"),
    "tropical": ("#efb04f", "shreds"),
    "chocolate": ("#8b5a49", "chips"),
    "nut": ("#c8ad78", "shards"),
    "custard": ("#dda869", "ribbon"),
    "bakery": ("#c68e6c", "chunks"),
}

SERIF = "'Iowan Old Style', Baskerville, 'Times New Roman', serif"
SANS = "Inter, ui-sans-serif, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"


# ---------------------------------------------------------------- helpers

def n(v):
    s = f"{v:.1f}"
    return s[:-2] if s.endswith(".0") else s


def _rgb(c):
    c = c.lstrip("#")
    return [int(c[i:i + 2], 16) for i in (0, 2, 4)]


def mix(a, b, t):
    x, y = _rgb(a), _rgb(b)
    return "#" + "".join(f"{round(x[i] + (y[i] - x[i]) * t):02x}" for i in range(3))


def shade(c, t):
    return mix(c, INK, t)


def tint(c, t):
    return mix(c, "#ffffff", t)


def spline(pts, closed=True, tension=1.0):
    """Catmull-Rom curve through the points, as cubic Beziers."""
    count = len(pts)
    d = f"M{n(pts[0][0])},{n(pts[0][1])}"
    for i in range(count if closed else count - 1):
        p0 = pts[(i - 1) % count] if closed or i else pts[0]
        p1, p2 = pts[i], pts[(i + 1) % count]
        p3 = pts[(i + 2) % count] if closed or i + 2 < count else pts[-1]
        c1 = (p1[0] + (p2[0] - p0[0]) / 6 * tension, p1[1] + (p2[1] - p0[1]) / 6 * tension)
        c2 = (p2[0] - (p3[0] - p1[0]) / 6 * tension, p2[1] - (p3[1] - p1[1]) / 6 * tension)
        d += f"C{n(c1[0])},{n(c1[1])} {n(c2[0])},{n(c2[1])} {n(p2[0])},{n(p2[1])}"
    return d + ("Z" if closed else "")


def blob(cx, cy, r, seed, count=9, amp=0.06, squash=1.0):
    rnd = random.Random(seed)
    ph = [rnd.uniform(0, 6.283) for _ in range(3)]
    pts = []
    for i in range(count):
        th = 2 * math.pi * i / count
        rr = r * (1 + amp * math.sin(2 * th + ph[0]) + amp * 0.7 * math.sin(3 * th + ph[1]) + amp * 0.4 * math.sin(5 * th + ph[2]))
        pts.append((cx + rr * math.cos(th), cy + rr * math.sin(th) * squash))
    return spline(pts)


def arc(cx, cy, r, a0, a1, steps=8):
    return [(cx + r * math.cos(math.radians(a0 + (a1 - a0) * i / steps)),
             cy + r * math.sin(math.radians(a0 + (a1 - a0) * i / steps))) for i in range(steps + 1)]


def scoop_outline(cx, cy, r, seed, lobes=4, frill=0.13, samples=7):
    """Side view of a scooped ball: a domed top over an uneven ruffled lip."""
    rnd = random.Random(seed)
    ph = [rnd.uniform(0, 6.283) for _ in range(2)]
    pts = []
    a0, a1 = math.radians(162), math.radians(378)
    for i in range(21):
        th = a0 + (a1 - a0) * i / 20
        rr = r * (1 + 0.03 * math.sin(3 * th + ph[0]) + 0.021 * math.sin(5 * th + ph[1]))
        rr *= 1 + 0.048 * max(0.0, math.sin(th))
        y = rr * math.sin(th)
        pts.append((cx + rr * math.cos(th), cy + (y * 0.94 if y < 0 else y)))
    xr, yr = pts[-1]
    xl, yl = pts[0]
    widths = [rnd.uniform(0.7, 1.35) for _ in range(lobes)]
    total = sum(widths)
    bounds = [0.0]
    for w in widths:
        bounds.append(bounds[-1] + w / total)
    steps = lobes * samples
    for i in range(1, steps):
        t = i / steps
        k = max(j for j in range(lobes) if bounds[j] <= t)
        local = (t - bounds[k]) / (bounds[k + 1] - bounds[k])
        amp = frill * r * (widths[k] / (total / lobes)) ** 0.8
        y = yr + (yl - yr) * t + 0.07 * r * math.sin(math.pi * t) + amp * math.sin(math.pi * local) ** 0.75
        pts.append((xr + (xl - xr) * t, y))
    return spline(pts, tension=0.85)


class Drawing:
    """Collects <defs> and body markup with ids unique to one file."""

    def __init__(self, prefix):
        self.prefix = prefix
        self.count = 0
        self.defs = []

    def uid(self, kind):
        self.count += 1
        return f"{self.prefix}{kind}{self.count}"

    def svg(self, w, h, body, label=None):
        head = f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {n(w)} {n(h)}" width="{n(w)}" height="{n(h)}"'
        head += f' role="img" aria-label="{label}">' if label else ' aria-hidden="true">'
        defs = f"<defs>{''.join(self.defs)}</defs>" if self.defs else ""
        return head + defs + body + "</svg>\n"


# ---------------------------------------------------------------- pieces

def bits(kind, cx, cy, r, colour, seed):
    """Inclusions that tell flavour families apart without relying on colour."""
    rnd = random.Random(seed)
    spots = [(cx + r * rnd.uniform(-0.6, 0.55), cy + r * rnd.uniform(-0.6, 0.25)) for _ in range(8)]
    out = []
    if kind == "seeds":
        for x, y in spots[:7]:
            out.append(f'<ellipse cx="{n(x)}" cy="{n(y)}" rx="{n(r * 0.035)}" ry="{n(r * 0.055)}" fill="{tint(colour, 0.6)}" transform="rotate({rnd.randint(-40, 40)} {n(x)} {n(y)})"/>')
    elif kind in ("shards", "chips", "chunks"):
        fill = {"shards": shade(colour, 0.35), "chips": shade(colour, 0.5), "chunks": "#4a2f28"}[kind]
        size = r * (0.13 if kind == "chunks" else 0.1)
        for x, y in spots[:4 if kind == "chunks" else 5]:
            pts = [(x + size * math.cos(a) * rnd.uniform(0.6, 1.1), y + size * math.sin(a) * rnd.uniform(0.6, 1.1)) for a in (0.3, 2.2, 3.9, 5.3)]
            out.append(f'<path d="M{" L".join(f"{n(a)},{n(b)}" for a, b in pts)}Z" fill="{fill}"/>')
    elif kind in ("zest", "shreds"):
        fill = "#e59b2e" if kind == "zest" else PAPER
        for x, y in spots[:5]:
            a = rnd.uniform(-0.8, 0.8)
            L = r * 0.2
            out.append(f'<path d="M{n(x)},{n(y)}q{n(L * 0.5)},{n(-L * 0.35)} {n(L * math.cos(a))},{n(L * math.sin(a))}q{n(-L * 0.4)},{n(L * 0.05)} {n(-L * math.cos(a))},{n(-L * math.sin(a))}Z" fill="{fill}"/>')
    elif kind == "ribbon":
        # a caramel ripple running across the scoop
        pts = [(cx + r * (-0.62 + 1.15 * i / 10), cy + r * (0.02 - 0.2 * i / 10 + 0.13 * math.sin(i / 10 * 2 * math.pi))) for i in range(11)]
        out.append(f'<path d="{spline(pts, closed=False)}" fill="none" stroke="#9c5a24" stroke-width="{n(r * 0.13)}" stroke-linecap="round"/>')
    return "".join(out)


def scoop(dr, cx, cy, r, colour, seed, kind, shadow=None, detail=2):
    """A cut-paper scoop: base, darker cut on the shaded side, light cuts, inclusions."""
    sid, cid = dr.uid("s"), dr.uid("c")
    dr.defs.append(f'<path id="{sid}" d="{scoop_outline(cx, cy, r, seed, lobes=4 if detail > 1 else 3)}"/>')
    dr.defs.append(f'<clipPath id="{cid}"><use href="#{sid}"/></clipPath>')
    out = ""
    if shadow:
        out += f'<use href="#{sid}" transform="translate({n(r * 0.05)},{n(r * 0.07)})" fill="{INK}" opacity=".22" filter="url(#{shadow})"/>'
    out += f'<use href="#{sid}" fill="{colour}"/><g clip-path="url(#{cid})">'
    out += f'<path d="{blob(cx + r * 0.55, cy + r * 0.5, r * 0.95, seed + 3)}" fill="{shade(colour, 0.13)}"/>'
    if detail > 1:
        hx, hy = cx - r * 0.42, cy - r * 0.52
        out += f'<path d="{blob(hx, hy, r * 0.2, seed + 5, 7, 0.12, 0.55)}" fill="{tint(colour, 0.5)}" transform="rotate(-32 {n(hx)} {n(hy)})"/>'
        for ox, oy, R, a0, a1, w in [(-0.1, 0.14, 0.72, 272, 332, 0.07), (-0.08, 0.16, 0.48, 280, 322, 0.06)]:
            outer = arc(cx + r * ox, cy + r * oy, r * R, a0, a1)
            inner = arc(cx + r * ox, cy + r * oy + r * w, r * (R - w * 0.4), a1, a0)
            out += f'<path d="{spline(outer, closed=False)}L{n(inner[0][0])},{n(inner[0][1])} {spline(inner, closed=False)[1:]}Z" fill="{tint(colour, 0.32)}"/>'
    return out + bits(kind, cx, cy, r, colour, seed) + "</g>"


def tub(dr, cx, top, wt, wb, h, light=False, shadow=None):
    """A short paper tub: body, cut band, shaded side and rolled rim."""
    body_col, band_col, rim_col = (PAPER, ROSE, RIM_LIGHT) if light else (INK, CREAM, RIM)
    L, R = cx - wt / 2, cx + wt / 2
    bl, br = cx - wb / 2, cx + wb / 2
    rr = h * 0.14
    d = (f"M{n(L)},{n(top)}L{n(R)},{n(top)}L{n(br + rr * 0.25)},{n(top + h - rr)}Q{n(br)},{n(top + h)} {n(br - rr)},{n(top + h)}"
         f"L{n(bl + rr)},{n(top + h)}Q{n(bl)},{n(top + h)} {n(bl - rr * 0.25)},{n(top + h - rr)}Z")
    tid, cid = dr.uid("t"), dr.uid("c")
    dr.defs.append(f'<path id="{tid}" d="{d}"/>')
    dr.defs.append(f'<clipPath id="{cid}"><use href="#{tid}"/></clipPath>')
    out = ""
    if shadow:
        out += f'<use href="#{tid}" transform="translate(6,8)" fill="{INK}" opacity=".22" filter="url(#{shadow})"/>'
    by, bh = top + h * 0.42, h * 0.13
    out += (f'<use href="#{tid}" fill="{body_col}"/><g clip-path="url(#{cid})">'
            f'<path d="M{n(L - 10)},{n(by)}Q{n(cx)},{n(by + bh * 0.9)} {n(R + 10)},{n(by)}L{n(R + 10)},{n(by + bh)}Q{n(cx)},{n(by + bh * 1.9)} {n(L - 10)},{n(by + bh)}Z" fill="{band_col}"/>'
            f'<path d="M{n(cx + wt * 0.18)},{n(top)}L{n(R + 5)},{n(top)}L{n(br)},{n(top + h)}L{n(cx + wb * 0.22)},{n(top + h)}Z" fill="{INK}" opacity="{".18" if not light else ".1"}"/></g>')
    out += f'<rect x="{n(L - wt * 0.03)}" y="{n(top - h * 0.05)}" width="{n(wt * 1.06)}" height="{n(h * 0.15)}" rx="{n(h * 0.075)}" fill="{rim_col}"/>'
    return out


def flag(px, py, tx, ty, text, side, fill=PAPER, pick=INK, size=17):
    """A toothpick flag pushed into a scoop at (px, py)."""
    w = len(text) * size * 0.5 + size * 1.3
    h = size * 1.75
    notch = size * 0.45
    x0 = tx if side > 0 else tx - w
    if side > 0:
        d = f"M{n(x0)},{n(ty)}L{n(x0 + w)},{n(ty)}L{n(x0 + w - notch)},{n(ty + h / 2)}L{n(x0 + w)},{n(ty + h)}L{n(x0)},{n(ty + h)}Z"
        mid = x0 + (w - notch) / 2
    else:
        d = f"M{n(x0 + w)},{n(ty)}L{n(x0)},{n(ty)}L{n(x0 + notch)},{n(ty + h / 2)}L{n(x0)},{n(ty + h)}L{n(x0 + w)},{n(ty + h)}Z"
        mid = x0 + notch + (w - notch) / 2
    return (f'<path d="M{n(px)},{n(py)}L{n(tx)},{n(ty - 6)}" stroke="{pick}" stroke-width="2.6" stroke-linecap="round"/>'
            f'<path d="{d}" fill="{INK}" opacity=".25" transform="translate(3,4)"/><path d="{d}" fill="{fill}"/>'
            f'<text x="{n(mid)}" y="{n(ty + h * 0.66)}" text-anchor="middle" font-family="{SERIF}" font-style="italic" font-size="{size}" fill="{INK}">{text}</text>')


def filters(dr):
    dr.defs.append('<filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3.5"/></filter>')
    # fine ink speckle, kept inside the shapes it is applied to
    dr.defs.append('<filter id="grain" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">'
                   '<feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="9" stitchTiles="stitch" result="n"/>'
                   '<feColorMatrix in="n" type="matrix" values="0 0 0 0 0.17 0 0 0 0 0.12 0 0 0 0 0.16 0 0 0 -0.84 0.41" result="s"/>'
                   '<feComposite in="s" in2="SourceAlpha" operator="in" result="sp"/>'
                   '<feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="sp"/></feMerge></filter>')


def cup_of_three(dr, light_tub=False, flags=True):
    """Anchor, bridge and lift in a tub - the hero and social-card drawing (500 x 500 units)."""
    filters(dr)
    scoops = "".join(scoop(dr, cx, cy, r, c, sd, kind, shadow="soft") for cx, cy, r, c, sd, kind in [
        (254, 206, 94, LEMON, 5, "zest"),
        (334, 300, 92, PIST, 8, "shards"),
        (172, 298, 98, ROSE, 3, "seeds"),
    ])
    pot = tub(dr, 252, 348, 318, 250, 128, light=light_tub, shadow="soft")
    out = f'<g filter="url(#grain)">{scoops}{"" if light_tub else pot}</g>' + (pot if light_tub else "")
    if flags:
        fill, pick = (LEMON, CREAM) if light_tub else (PAPER, INK)
        out += flag(270, 140, 296, 48, "lift", 1, fill, pick)
        out += flag(140, 244, 104, 150, "anchor", -1, fill, pick)
        out += flag(372, 244, 404, 160, "bridge", 1, fill, pick)
    return out


def mark_body(dr):
    """The three-scoop tub at 64 x 64 units."""
    out = "".join(scoop(dr, cx, cy, r, c, sd, "none", detail=1) for cx, cy, r, c, sd in [
        (32, 22.5, 13, LEMON, 5), (43, 31.5, 13, MINT, 8), (21, 31.5, 13.5, ROSE, 3)])
    return out + tub(dr, 32, 38, 48, 37, 18)


# ---------------------------------------------------------------- files

def hero():
    dr = Drawing("h")
    return dr.svg(500, 500, cup_of_three(dr))


def mark():
    dr = Drawing("m")
    return dr.svg(64, 64, mark_body(dr))


def favicon():
    dr = Drawing("f")
    return dr.svg(64, 64, f'<rect width="64" height="64" rx="16" fill="{CREAM}"/>' + mark_body(dr), "Scoop Theory")


def app_icon():
    dr = Drawing("i")
    return dr.svg(64, 64, f'<rect width="64" height="64" fill="{CREAM}"/><g transform="translate(6.4 7.4) scale(.8)">{mark_body(dr)}</g>', "Scoop Theory")


def family_scoop(family):
    colour, kind = FAMILY[family]
    dr = Drawing(family[:2])
    return dr.svg(100, 100, scoop(dr, 50, 50, 42, colour, 13, kind))


def small_tub(light):
    dr = Drawing("t")
    return dr.svg(90, 30, tub(dr, 45, 3, 82, 64, 25, light=light))


def og_card():
    dr = Drawing("o")
    body = f'<rect width="1200" height="630" fill="{INK}"/>'
    body += f'<text x="84" y="138" font-family="{SANS}" font-weight="800" font-size="22" letter-spacing="4.5" fill="{LEMON}">UNOFFICIAL FLAVOUR PAIRING GUIDE</text>'
    body += f'<text x="78" y="282" font-family="{SERIF}" font-weight="600" font-size="126" letter-spacing="-5" fill="{CREAM}">Scoop</text>'
    body += f'<text x="78" y="398" font-family="{SERIF}" font-weight="600" font-style="italic" font-size="126" letter-spacing="-5" fill="{ROSE}">Theory.</text>'
    body += f'<text x="84" y="462" font-family="{SANS}" font-size="30" fill="#d9c9cf">Build a better two- or three-scoop cup.</text>'
    body += (f'<g transform="translate(84 510)"><rect width="252" height="52" rx="26" fill="{LEMON}"/>'
             f'<text x="126" y="34" text-anchor="middle" font-family="{SANS}" font-weight="800" font-size="20" fill="{INK}">scoops.drtarr.com</text></g>')
    body += f'<g transform="translate(676 70) scale(1.08)">{cup_of_three(dr, light_tub=True)}</g>'
    return dr.svg(1200, 630, body, "Scoop Theory - an unofficial gelato pairing guide")


def main():
    art = ROOT / "art"
    art.mkdir(exist_ok=True)
    files = {
        art / "hero.svg": hero(),
        art / "mark.svg": mark(),
        art / "app-icon.svg": app_icon(),
        art / "tub.svg": small_tub(False),
        art / "tub-light.svg": small_tub(True),
        ROOT / "favicon.svg": favicon(),
        ROOT / "og-image.svg": og_card(),
    }
    for family in FAMILY:
        files[art / f"scoop-{family}.svg"] = family_scoop(family)
    for path, text in files.items():
        path.write_text(text)
        print(f"{path.relative_to(ROOT)}  {len(text.encode()) / 1024:.1f} KB")


if __name__ == "__main__":
    main()
