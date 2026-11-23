# Footprints demo shop

A small fictional shop ("Skyward Optics") with **simulated visitors**, to check
[Footprints](https://github.com/smaff-dt/Footprints-mvp) against numbers we
know. The visitors follow the probabilities in `sim/config.json` and log
everything they really do; `sim/report.mjs` turns the logs into what Footprints
should show. Nothing is for sale.

## What is in it

| Part | Where |
| --- | --- |
| The shop: home, 10 product pages, cart, checkout, order confirmation | `site/` (source), `docs/` (built, served by GitHub Pages) |
| The Dynatrace RUM JavaScript tag, first in every page's `<head>` | `site/rum-tag.html` |
| Simulated visitors (Playwright) | `sim/visit.mjs`, probabilities in `sim/config.json` |
| What Footprints should show | `sim/report.mjs` |
| 35 visits every 20 minutes on GitHub Actions (about 2,500 a day); logs on the `logs` branch | `.github/workflows/visitors.yml` |

Like real shops, it has a sticky header, a cookie banner fixed at the bottom,
product pictures shown late by a script, a layout for desktop, tablet and
phone, and visits arriving from a newsletter (`?utm_source=newsletter`).

### Friction built in on purpose

| Where | What | Footprints metric |
| --- | --- | --- |
| Product pages, Aperture buttons (Large, Pro) | The page takes 450 ms to react | Slow response |
| Checkout, Zip code | 300 ms for every key typed | Slow response |
| Cart, Apply coupon | The coupon service is missing: the request fails (404) and the page throws an error | Errors after click |
| Product pages, "Which size is right for me?" | Looks like a link, does nothing; half the visitors who click it click 4 times | Rage clicks |

### Visitors

- 70% desktop (1920, 1536, 1440, 1366 and 1280 px wide windows), 30% phones
  (390, 412 and 360 px).
- 80% land on the home page (15% of them from the newsletter), 20% on a
  product page.
- They scroll to a chosen depth, click at a random spot inside elements, and
  follow home → product → cart → checkout → order confirmed, each step with
  its own probability.

## Use

```bash
npm install
npm run build                 # site/ → docs/
npm run serve                 # http://localhost:8300/
node sim/visit.mjs --site http://localhost:8300/ --visits 10 --log logs/local.jsonl
node sim/report.mjs logs      # → report.md
```

To check Footprints: take snapshots of the shop's pages in Footprints (app:
the shop's frontend on the Dynatrace environment), set the period to the
days the visitors ran, and compare with `report.md`, built from the `logs`
branch for the same days (`--since 2026-11-24`). Compare shares rather than
counts: Dynatrace may drop or still be closing a few sessions.
