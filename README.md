# Scoop Theory

An unofficial, independent Gelato Messina two- and three-scoop pairing guide.

Live at [scoops.drtarr.com](https://scoops.drtarr.com/).

## What it does

- Builds two- and three-scoop combinations from the current cabinet.
- Lets you choose every scoop and critiques the result.
- Ranks recommended partners, bridges, and lifts.
- Uses one verdict scale: Exceptional, Excellent, Strong, Good, and Adventurous.

Flavour names and rotation dates are checked against Gelato Messina's official listings. Pairing profiles, scoring, and explanations are original. This project is not affiliated with, sponsored by, or endorsed by Gelato Messina. Do not use it for allergy decisions.

No licence has been granted for reuse beyond the rights automatically provided by GitHub's Terms of Service.

## Artwork

All illustration is drawn in code - no photography and no Messina branding. `scripts/draw_art.py` (Python standard library only) writes the SVGs: the hero, the header mark, `favicon.svg`, one scoop per flavour family for the result and cabinet cards, the small tub pieces and `og-image.svg`. It also writes the animated hero drawing into `index.html` between the `hero-art` markers, so edit the drawing code rather than that block. Re-run it after changing the drawing code.

`hero.js` plays the hero animation when the cup is on screen, replays it when the cup scrolls back into view or is tapped, and leaves it still for anyone who reduces motion.

`scripts/render_png.py` renders `og-image.png`, `apple-touch-icon.png` and the manifest icons from those SVGs with Playwright. On a Mac the social card is set in Iowan Old Style; elsewhere pass `--serif`, `--serif-italic` and `--sans` font files so it is not set in a fallback face.
