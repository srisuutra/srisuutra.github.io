# SRISUUTRA ALGO TRADING: public site + local daily-entry page

Static site for **GitHub Pages**. No server, no login, no build step, **no GitHub token anywhere**.

| Path | What |
|---|---|
| `index.html`, `css/`, `js/`, `assets/` | The public website (Live / Backtest / Method & costs) |
| `reports/index.json`, `reports/<id>/report.json` | Backtest reports written by the GANITHAYYANTRA zip |
| `live/live.json` | Live results, written by `local/daily_entry.html` |
| `local/daily_entry.html` | Open **on your own computer** to enter each day's net P&L (replaces the old `srisuutra_algo_trading.html`) |
| `tests/parity.test.js` | Proves the site's numbers equal the zip's file at default settings |
| `tools/vendor.sh` | Optional: download export libraries locally and print SRI hashes |

## One-time setup
1. Create a GitHub repo, copy this folder's contents in, push with GitHub Desktop.
2. Settings → Pages → deploy from branch `main`, folder `/ (root)`. The site is public.
3. The repo ships with no reports and no live data (`reports/index.json` is `[]`). The site shows an empty state until you add them.
4. Optional but recommended: run `sh tools/vendor.sh` once and commit `vendor/` (PNG/PDF/Excel export then needs no CDN).

## Backtest workflow
Zip → **GitHub reports** tab → download `report.json` → put in `reports/<id>/` → add its entry to `reports/index.json` (the zip writes this) → push.

## Live workflow
1. Open `local/daily_entry.html` (keep it inside the repo folder; it uses `../js`). If you work on another computer, first **Load live.json** from the repo.
2. Enter the day's net P&L per strategy (as your broker shows it, charges deducted). **Save live.json**. This locks the days up to the as-of date.
3. Put `live.json` into `live/`, push. Past days cannot change silently: a change needs a reason and appears in the public **corrections log**.
4. Migrating: **Import old tool's Excel**, map the old columns to the two groups.
5. Telegram (optional): token and chat ids stay in that browser only. They are not in Excel or live.json.

## Rules built in
Backtest and live are never drawn together and are labelled on every chart/table; disclaimer gate on first visit; cost assumptions on the Method tab; no subscribe/buy buttons. Capital slider = `floor(capital ÷ deployed)`, ROI and drawdown are a % of the chosen capital; cost sliders apply to backtests only. Share links encode selection and slider state in the URL.

## Check the numbers
`node tests/parity.test.js reports/<id>/report.json`. Do this for each real report you publish.

## Things to know
- `js/engine.js` `price()` is ported from the rules in the handover, **not** from `ganitha/ghexport.py` (it was not in the files provided). Run the parity test against your real `report.json`, and compare a few moved-slider outputs against `ghexport.price` (within ₹1) before publishing. Where a brokerage setting is left at "actual", brokerage scales with the order multiplier.
- SEBI: whether an individual may publish past returns of an algo strategy was not verified. Get qualified advice before making the site public.
