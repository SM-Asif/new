# News Domain Hunter

Find expired, dropped, and available-to-register news/media domains by crawling news websites end-to-end.

## What it does

1. You submit a news website URL (seed domain).
2. The crawler reads sitemaps, RSS/Atom feeds, article pages, subdomains, pagination, and every link across the whole site — unlimited pages, continuous operation while your PC is on.
3. Every outbound link to a *different* domain is collected as a candidate domain (these are the domains the news site linked to from its articles).
4. Each candidate is checked via **WHOIS, DNS (A/MX/NS), and HTTP** to determine if it's expired/dropped/available to register.
5. Domains are **scored** for news-industry relevance, age, authority (referring pages), keyword/brand match, and TLD (.news, .media, .press, .tv, etc.).
6. Results are stored in a local SQLite database and shown in a modern UI with filters, charts, and re-check controls.
7. Jobs run continuously (re-crawl on a schedule) while your PC is turned on.

## Tech stack

- **Server:** Node.js, Express, Socket.IO, SQLite (sql.js), Cheerio, Playwright (optional JS rendering), axios, node-whois, node-cron.
- **Client:** React 18, TypeScript, Vite, Tailwind CSS, Framer Motion-friendly utilities, Lucide icons, Recharts, Zustand.

## Project layout

```
/workspace/app/
├── start.sh              # one-command installer & launcher
├── README.md
├── server/               # Node.js API + crawler + scheduler
│   ├── package.json
│   ├── src/
│   │   ├── index.js      # Express + Socket.IO API
│   │   ├── db/           # SQLite (sql.js) storage + retention
│   │   ├── crawler/      # sitemap/feed/article crawler + link extraction
│   │   ├── domain/       # WHOIS/DNS/HTTP availability + scoring
│   │   └── scheduler/    # continuous per-job crawl loop
│   └── data/             # SQLite database (created on first run)
└── client/               # React + Vite frontend
    ├── package.json
    ├── index.html
    ├── src/
    │   ├── App.tsx       # router
    │   ├── main.tsx
    │   ├── index.css     # Tailwind
    │   ├── store/useStore.ts   # Zustand state
    │   ├── services/api.ts     # API client + Socket.IO
    │   ├── components/         # UI + charts + domain rows
    │   └── pages/              # Dashboard, Domains, Jobs, Settings, Logs
    └── dist/             # production build
```

## Quick start

```bash
cd /workspace/app
chmod +x start.sh
./start.sh
```

This installs dependencies and launches:
- **UI:** http://localhost:5173
- **API:** http://localhost:4000

Then open the UI, create a crawl job with a news website URL, and watch domains get discovered and availability-checked in real time.

## Using the tool

1. **Jobs page** — Create a crawl job: name + seed news URL (e.g. `https://example-news.com`). Set max pages, depth, concurrency, and delay. Jobs run continuously while your PC is on.
2. **Domains page** — Browse discovered candidate domains. Filter by availability (available/taken), min authority score, and keyword. Green = likely available to register. Click "Whois" to verify externally, or "Recheck" to re-run WHOIS/DNS/HTTP.
3. **Dashboard** — Overview: jobs, pages crawled, domains found, available count, authority distribution pie chart.
4. **Settings** — Data retention (auto-clear domains/logs/pages older than N days), "Clear old data" button, crawl delay.
5. **Logs** — Live log stream from crawl jobs.

## How domains are scored

- **Authority score (0-100):** referring pages found during crawl, domain age (years from WHOIS creation), availability bonus, keyword/brand matches.
- **News industry score:** domain/brand keyword match, news/media TLDs (.news, .media, .press, .tv, .radio, .journal), country TLD match.
- **Available:** WHOIS shows no registration + no DNS records + site not live over HTTP/HTTPS.

## Data storage & clearing

All data lives in `server/data/hunter.db` (SQLite). Use **Settings → Clear old data** to remove domains, logs, and pages older than the retention period (default 30 days). You can also clear individual categories.

## Notes

- Playwright (Chromium) is optional and only used if "Render JavaScript" is enabled for a job. To install: `cd server && npm run install:playwright`.
- Crawling is rate-limited (delay between requests) and respects `robots.txt` by default. Use responsibly and only on sites you have permission to crawl.
- Domain availability is a best-effort check (WHOIS + DNS + HTTP). Always verify with a registrar before purchasing.
