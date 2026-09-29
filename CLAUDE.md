# Scoop Theory

Independent, unofficial flavour-pairing guide for Gelato Messina, live at https://scoops.drtarr.com.
Static site on GitHub Pages from `main` of `gregnz1/scoop-theory`; merging to `main` publishes within a few minutes.

- Never use Messina logos, product photos or their description text. Flavour names, dates and stated components are fine; notes and pairing reasons are our own words.
- House style: Australian spelling; a spaced hyphen ( - ) instead of en or em dashes.
- `app.js` holds the pairing engine. Don't change scoring or ranking unless asked.
- Artwork comes from `scripts/draw_art.py` (it also writes the hero into `index.html` between the `hero-art` markers); PNGs from `scripts/render_png.py`.
- Check data with `python3 scripts/check_data.py` (add `--strict` before merging new specials).

## Weekly specials update

1. **Mondays and Thursdays 5:17 am Brisbane - GitHub Actions** (`.github/workflows/refresh-specials.yml`) runs `scripts/refresh_specials.py` against https://specials.gelatomessina.com/current-specials. If the list changed, it commits to a `specials/<start date>` branch and opens a pull request titled like "October 2026 specials". Continuing flavours keep their entries untouched; new ones get rule-based placeholders marked `"needsReview": true`, and their stated components go in `.github/specials-report.json`.
2. **Mondays and Thursdays 7:48 am - Claude scheduled task** ("Scoop Theory specials write-up") writes up the new flavours on that branch (below).
3. **Greg merges** the pull request. Nothing goes live before that.

## Writing up new specials

Do this on the open `specials/*` branch. If the branch exists without a pull request, open one (base `main`, title = the rotation label from `data/specials.json`).

For each entry in `data/specials.json` with `"needsReview": true`, using `.github/specials-report.json` for its components:

- **format**: `gelato`, `sorbet` or `yoghurt gelato`.
- **family**: `bright` (fruit and tang), `tropical`, `chocolate` (chocolate and roast), `nut` (nut and praline), `custard` (custard and caramel) or `bakery` (biscuit and crunch). Pick the flavour's dominant character.
- **colour**: the family colour - bright `#e86d68`, tropical `#efb04f`, chocolate `#8b5a49`, nut `#c8ad78`, custard `#dda869`, bakery `#c68e6c`.
- **note**: one sentence, under 200 characters, saying what it tastes like in our own words. Naming components is fine; paraphrasing Messina's blurb is not. Example: "Fior di latte with Marsala and strawberry puree - creamy berry with a light wine note."
- **profile**: whole numbers 0-5 for richness, brightness (acidity and fresh fruit), sweetness and roast (bitterness and toast). Calibrate against the classics:

  | Flavour | Format | Family | Richness | Brightness | Sweetness | Roast |
  |---|---|---|---|---|---|---|
  | Lemon Sorbet | sorbet | bright | 1 | 5 | 2 | 0 |
  | Blood Orange Sorbet | sorbet | bright | 1 | 5 | 3 | 0 |
  | Mango Sorbet | sorbet | bright | 1 | 3 | 4 | 0 |
  | Boysenberry | yoghurt gelato | bright | 3 | 3 | 3 | 0 |
  | Coconut & Lychee | gelato | tropical | 3 | 1 | 3 | 0 |
  | Vanilla | gelato | custard | 3 | 0 | 3 | 0 |
  | Coffee | gelato | chocolate | 3 | 1 | 2 | 5 |
  | Cookies & Cream | gelato | bakery | 4 | 0 | 4 | 2 |
  | Hokey Pokey | gelato | bakery | 4 | 0 | 5 | 2 |
  | Pistachio Praline | gelato | nut | 4 | 0 | 4 | 3 |
  | Chocolate Fondant | gelato | chocolate | 5 | 0 | 3 | 4 |
  | Salted Caramel and White Chocolate | gelato | custard | 5 | 0 | 5 | 2 |

- **tags**: 4-8 lower-case tags, reusing existing ones. The engine reads these, so include the relevant ones: fruit (`fruit`, `berry`, `strawberry`, `citrus`, `lemon`, `mango`, `passionfruit`, `lychee`, `tropical`, `raisin`, `dried fruit`), chocolate (`chocolate`, `dark chocolate`, `milk chocolate`, `white chocolate`, `cocoa`, `fudge`), nut (`nut`, `hazelnut`, `pistachio`, `macadamia`, `peanut`, `praline`), bakery (`biscuit`, `cookie`, `cake`, `shortbread`, `waffle`, `malt`), caramel (`caramel`, `dulce de leche`, `honey`), cream (`creamy`, `custard`, `vanilla`, `milk`, `mascarpone`, `cheesecake`, `yoghurt`), and `coffee`, `espresso`, `roast`, `coconut`, `pandan`, `mint`, `salt`, `bitter`, `acidic`, `fresh`. Every gelato gets `creamy`; every sorbet gets `fresh`.
- **pairs**: the 4 best partners from the current cabinet (classics plus this rotation's specials), best first, each `{"id": ..., "why": ...}` with a one-line reason under 90 characters in the site's voice. Think anchor + bridge + lift: a rich flavour needs at least one bright or sorbet lift; include at least one shared-note bridge. Only use ids that exist in `data/classics.json` or `data/specials.json`.
- Remove `"needsReview"`.

Then:

1. Where a continuing special's `pairs` name a flavour that has just left the cabinet, replace it with a current partner.
2. Delete `.github/specials-report.json`.
3. Run `python3 scripts/check_data.py --strict`. It must pass with no errors.
4. Commit as "Write up <rotation label>", push to the same branch, and comment on the pull request: one line per new flavour with its family, note and partners.
5. Don't merge; Greg does that.
