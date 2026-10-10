# Cloud DNS Failover Demo

A tiny Express‑based web app that shows a simple dashboard for a cloud DNS failover scenario. It is deliberately minimal – one page, no database, no auth – to keep the focus on the concept of region‑aware failover.

## Project structure
```
cloud-dns-failover-demo/
├─ public/
│  ├─ index.html   # Dashboard UI
│  ├─ style.css    # Polished, responsive styling
│  └─ script.js    # Fetches /health and /api/info
├─ server.js       # Express server, routes, env‑var defaults
├─ package.json    # npm manifest (express + dotenv)
├─ .gitignore      # Ignores node_modules & .env
└─ README.md       # You are reading it!
```

## How it works
- **Frontend** – `index.html` loads `script.js`. The script calls the backend endpoints:
  - `GET /health` → shows *SYSTEM HEALTHY* (green) or an error (red).
  - `GET /api/info` → fills Region, Role, Status, Health, Version.
- **Backend** – `server.js` serves static files from `public/` and implements the two JSON endpoints.
  - Environment variables `REGION`, `ROLE`, `VERSION` are read (fallback to `Mumbai`, `PRIMARY`, `1.0`).
  - The server listens on `process.env.PORT || 3000`.

## Why `REGION`, `ROLE`, `VERSION`?
These env vars let the same code run in different Google Cloud regions without code changes:
- Deploy the app in **Mumbai** with `REGION=Mumbai` and `ROLE=PRIMARY` → dashboard shows *Region: Mumbai, Role: PRIMARY*.
- Deploy the app in **Singapore** with `REGION=Singapore` and `ROLE=BACKUP` → the dashboard automatically reflects the new values. This is essential for the later failover demonstration.

## Setup & run locally
```bash
# Navigate to the project folder
cd d:/cloud-dns-failover-demo

# Install dependencies (express + dotenv)
npm install

# Start the server
npm start
```
Open a browser and go to `http://localhost:3000` – you should see the polished dashboard.

## Available endpoints
- `GET /` – Serves the dashboard HTML.
- `GET /health` – Returns `{ "status": "healthy" }` for health checks.
- `GET /api/info` – Returns `{ "region": "...", "role": "...", "version": "...", "status": "online" }`.

Feel free to tweak the CSS or env vars for your demo.
