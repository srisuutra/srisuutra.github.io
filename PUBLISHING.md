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
1. Open `local/daily_entry.html` from your repo folder (double-click). On a new computer, click *Load live.json* first and pick `live/live.json`.
2. Enter the day's net P&L for each strategy. Click *Save live.json* (it locks the days).
3. Move the downloaded `live.json` into the `live` folder, replacing the old file.
4. GitHub Desktop → commit `Live P&L <date>` → *Push origin*.
5. Keep your Excel master file **outside** the repo folder (the repo ignores `.xlsx` anyway).

## D. Safety checklist
- Never put a GitHub token, bot token or password in any file. The site and entry page need none.
- Telegram token: typed only into the entry page; never saved to live.json or Excel.
- Everything in the repo is public, including history. Don't commit client data, broker statements or screenshots with account numbers.
- Mistakes: use *Revert* in GitHub Desktop, but remember old versions stay in history.
- Never silently change a past day. Use *correct* in the entry page so the public corrections log shows it.

## E. Optional
- Custom domain: Settings → Pages → *Custom domain*.
- If you add a Telegram link to the entry page's Links, it shows on the site.
