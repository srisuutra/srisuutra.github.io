# Updating the site when you get a new zip

1. Unzip the new `srisuutra-site.zip` to your Desktop.
2. Open your cloned `srisuutra.github.io` folder (GitHub Desktop: Repository -> Show in Explorer).
3. Select everything inside the unzipped folder, copy, paste into the cloned folder, choose **Replace the files in the destination**.
4. **Do not overwrite your own data.** If Windows asks about `reports/index.json` or anything inside `reports/` or `live/`, choose **Skip** (or **Don't copy**) so your published reports and `live/data.json` stay. Also keep your `config.json` if you edited it.
5. GitHub Desktop lists only the files that really changed. Summary `Update site` -> **Commit to main** -> **Push origin**. Live in about a minute (Ctrl+F5).

Telegram button: it appears by itself when your `data.json` has a link named Telegram. Or put the link in `config.json` as `{"telegram": "https://t.me/yourchannel"}`.

# Daily update (about 2 minutes)

1. Open `local/daily_entry.html` in Chrome (double-click; it works from your computer, needs internet once for the export libraries).
2. Pick today's date under "Daily P/L at 1X", type each strategy's net P&L, set "As of" to today.
3. Click **Export website data (data.json)**. Also click **Save Excel (database)** and keep that file as your master copy.
4. Copy the downloaded `data.json` into the `live` folder of the cloned `srisuutra.github.io` folder, replacing the old one.
5. GitHub Desktop: summary `Update 2026-11-02` -> **Commit to main** -> **Push origin**.
6. About a minute later https://srisuutra.github.io/ shows the new numbers (press Ctrl+F5 if you still see old ones).

Links (Telegram etc.), notes, strategy names, exchange (NFO/MCX) and share codes are set in the same page and go out inside `data.json`. Only ticked links and notes are published.

# Publishing on GitHub, step by step (GitHub Desktop, no command line)

## A. One-time setup (you already have the account and repos)
Use the repo **srisuutra.github.io**. A repo with exactly this name is your personal GitHub Pages site, so it is published at **https://srisuutra.github.io/** with no extra settings. (The other repo, SRISUUTRAALGOTRADING, can be left empty or deleted.)
1. Install **GitHub Desktop** (desktop.github.com) and sign in as srisuutra.
2. File → *Clone repository* → pick **srisuutra/srisuutra.github.io** → choose a folder on your computer → *Clone*.
3. Unzip `srisuutra-site.zip` into the cloned folder (select all files from the zip and paste). `index.html` must sit directly in the cloned folder, not in a sub-folder. The sample report is already removed.
5. GitHub Desktop shows the new files on the left. Summary: `First version` → *Commit to main* → *Push origin*.
6. Check the repo is **public** (github.com → the repo → Settings → bottom, *Change visibility*).
7. Settings → *Pages* → Source: *Deploy from a branch* → Branch `main`, folder `/ (root)` → *Save*. After 1-2 minutes open https://srisuutra.github.io/ .

## B. Adding a backtest report (each time)
1. In the zip's *GitHub reports* tab, export the report. You get `reports/<id>/report.json` and an updated `reports/index.json`.
2. Copy them into your repo folder (replace `index.json`).
3. Run `node tests/parity.test.js reports/<id>/report.json` if you have Node installed (it should say ALL CHECKS PASSED).
4. GitHub Desktop → review the changed files → summary `Add report <id>` → *Commit to main* → *Push origin*. The site updates in about a minute.

## C. Adding live results (each trading day)
See **Daily update** at the top of this file.

- Keep your Excel master file **outside** the repo folder (the repo ignores `.xlsx` anyway).

## D. Safety checklist
- Never put a GitHub token, bot token or password in any file. The site and entry page need none.
- Everything in the repo is public, including history. Don't commit client data, broker statements or screenshots with account numbers.
- Mistakes: use *Revert* in GitHub Desktop, but remember old versions stay in history.
- Never silently change a past day. Use *correct* in the entry page so the public corrections log shows it.

## E. Optional
- Custom domain: Settings → Pages → *Custom domain*.
- If you add a Telegram link to the entry page's Links, it shows on the site.

## F. Share codes and Telegram
- The **Strategies** tab reads `share-codes.json` in the top folder of the repo. It lists your strategies; a blank code shows "Not published yet".
- To add or change codes: open `local/strategies_editor.html` (double-click), type the codes, add new strategies with **+ Add strategy**, click **Download share-codes.json**, then on GitHub use **Add file -> Upload files** to replace `share-codes.json` and commit. Or edit `share-codes.json` directly on GitHub with the pencil icon.
- The **Join Telegram** button is on the Strategies tab only. Its link is `config.json` -> `"telegram"`.
- Daily Telegram post: in the daily tool (`local/daily_entry.html`), section 5, enter the bot token and channel once, then click "Send summary picture to Telegram".


## Only the parallel book is published
`local/prepare_report.html` keeps ONLY the parallel-book legs of the Directional group (sold, strangle/core and hedge legs are dropped) and recomputes daily P&L, totals and drawdown from what remains. Non-directional is published as is. Never upload a raw backtest report.


## One-click publishing
The three pages in `local/` (daily_entry, strategies_editor, prepare_report) can publish straight to this repository through the GitHub API. Create a fine-grained token (only this repository, Contents: Read and write), paste it in the page's GitHub connection box once. It stays in that browser only. See docs/SRISUUTRA_Website_Update_Guide.pdf.

The backtest is published as two strategies only: Nifty Non Directional Intraday and Nifty Intraday Option Buying (Pyramid L1-L3). Deployed capital: non-directional 5L, directional 2L, both together 5L.
