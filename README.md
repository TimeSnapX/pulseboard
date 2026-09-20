# PulseBoard

Dark personal dashboard for habits, goals, money, IG trading prep, cigarettes & drinks, and karate attendance.

**Live:** https://timesnapx.github.io/pulseboard/  
**Repo:** https://github.com/TimeSnapX/pulseboard

No login. No backend. Everything stays in **localStorage** in this browser.

This is a personal planning tool, not financial, medical, or trading advice.

## Tabs

- **Habits** — daily/weekly habits, 90-day heatmaps, streaks, weekly completions.
- **Goals** — targets with deadlines, on-track / at-risk / done, progress over time.
- **Money** — expenses, income, savings deposits, monthly budgets, spend charts, live savings projection.
- **Trading** — IG readiness checklist, risk rules, paper/live trade log, equity curve.
- **Intake** — cigarettes and alcohol with weekly caps, pack math, and spend.
- **Karate** — Monday-start week, month grid, 3 classes/week target.

The summary strip under the tabs stays visible on every view.

## Run locally

```powershell
.\start.ps1
```

Or:

```bash
python -m http.server 4176 --bind 127.0.0.1
```

Then open http://127.0.0.1:4176

Do not open `index.html` as `file://` — ES modules need a normal origin.

## Data

First load seeds realistic demo data so the charts are not empty. Use **Reset demo data** in the footer to restore that seed. Clearing site data for this origin wipes the board.

Nothing is uploaded.
