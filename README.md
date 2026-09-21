# IT Helpdesk Ticketing Portal

A demo-ready MVP of the IT Helpdesk Ticketing Portal, built from the
`IT_Helpdesk_Ticketing_Portal_Requirements.docx` business/functional requirements. It covers the
full core workflow end to end: employee raises a ticket → IT queue → assign → work → resolve →
close → daily dashboard.

**Stack:** FastAPI (Python) backend, React (Vite) frontend, PostgreSQL (with a zero-config SQLite
fallback for local dev — see `backend/app/database.py`).

## What's included (MVP scope)

- **Login** — organizational-ID based login (JWT). The sign-in screen asks which role you're
  signing in as (Employee / IT Agent / IT Admin / Management) plus Employee ID and password; the
  backend rejects the login if the account isn't actually registered under that role.
- **Employee Home** — prominent "Raise IT Ticket" button + "My Tickets" list. Raising a ticket is
  a single modal: Issue, Description, Priority (with plain-language guidance), optional Category,
  optional attachment, optional preferred contact — submittable in a few clicks.
- **IT Queue** — unassigned/assigned/waiting/resolved/closed views, search, and a one-click
  "Claim" action.
- **IT Workbench** (on the ticket detail page) — instant-apply Status / Priority / Category /
  Assignee dropdowns, resolve (with required resolution summary), close, internal notes (hidden
  from requester) vs. public replies (tabbed), and a unified timeline that interleaves comments
  with every status/priority/category/assignment change. All four dropdowns lock once a ticket is
  Resolved or Closed (server-enforced, not just hidden in the UI) until it's reopened.
- **Reopen** — employees or IT can reopen a Resolved/Closed ticket with a reason.
- **Daily Dashboard** — logged/allocated/closed today, open/unallocated/in-progress counts,
  average resolution time, reopen rate, and breakdowns by priority, department, category, agent
  workload, and aging — auto-refreshes every 30s.
- **Admin** — manage Categories, Priorities and Users (create/disable) without touching code.
- **Role-based access** — Employee (own tickets only), IT Agent, IT Admin, Management
  (read-only dashboard).

**Out of scope for this MVP** (per the requirements doc's "future enhancements"): real SSO/email
notifications, SLA breach automation, auto-routing, knowledge base, satisfaction ratings. The data
model and Admin screen are built so these can be layered on without a redesign.

## Project structure

```
backend/            FastAPI app (SQLAlchemy + Postgres/SQLite), JWT auth, seed script
frontend/           React + Vite + Tailwind CSS SPA
Dockerfile          Multi-stage build: frontend build → baked into the backend image
docker-compose.yml  Local Postgres + app stack, for testing against Postgres before deploying
.env.example        Copy to .env to override DATABASE_URL / JWT_SECRET_KEY / etc. locally
```

## Running it locally

### Backend (SQLite, zero config)

```bash
cd backend
python -m venv venv
venv\Scripts\activate        # Windows
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

No `DATABASE_URL` set → falls back to a local `ticketing.db` file. Schema creation and demo-data
seeding both happen automatically on startup (see the `lifespan` handler in `backend/app/main.py`)
— no separate seed step needed. It's idempotent, so restarting never duplicates data.

API docs: http://127.0.0.1:8000/docs

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App: http://localhost:5173 (Vite proxies `/api` to the backend on port 8000 — the backend serves
all of its routes under `/api`, see `backend/app/main.py`).

### Or run the full stack against a real local Postgres (mirrors production)

```bash
docker compose up --build
```

Starts a `postgres:16` container plus the app (built from the root `Dockerfile`), wired together —
app waits for Postgres's healthcheck before booting. Everything at http://localhost:8000. This is
the setup to use if you want to test something Postgres-specific before deploying.

### Or just the single Docker image, against whatever `DATABASE_URL` you point it at

```bash
docker build -t it-helpdesk-portal .
docker run -p 8000:8000 -e JWT_SECRET_KEY=some-random-value -e DATABASE_URL=... it-helpdesk-portal
```

Omit `DATABASE_URL` and it falls back to SQLite inside the container (fine for a quick check, but
gone when the container stops).

## Demo logins

All seeded users share the password `password123`. Pick the matching role on the sign-in screen
for each one.

| Employee ID | Name | Role |
|---|---|---|
| E1001 | Asha Rao | Employee |
| E1002 | Vikram Singh | Employee |
| E1003 | Meera Nair | Employee |
| A2001 | Rahul Verma | IT Agent |
| A2002 | Sara Khan | IT Agent |
| ADM01 | Priya Sharma | IT Admin |
| MGT01 | Karan Mehta | Management (read-only) |

## Security notes

- **Attachments are not a public folder.** They're served only through
  `GET /tickets/{id}/attachments/{id}/download`, which enforces the same visibility rule as the
  rest of a ticket (owner, assigned agent, admin, or management — nobody else). Uploaded filenames
  are sanitized before touching the filesystem to prevent path traversal.
- **Set real secrets before this leaves your machine.** `backend/app/auth.py` falls back to a fixed
  local-dev JWT secret so `uvicorn` works out of the box; set the `JWT_SECRET_KEY` environment
  variable to a random value for any deployment reachable by anyone else. Likewise set
  `CORS_ORIGINS` (comma-separated) if the frontend won't be on `localhost:5173`.
- **The seeded demo password (`password123`) is intentionally weak.** Fine for a private demo you
  control; if you deploy this somewhere with a shareable URL, change the seeded passwords first.

## Deploying to Render (Docker + managed Postgres)

The root `Dockerfile` is a multi-stage build: it builds the React app, then bakes the built static
files into the same image as the FastAPI backend. One image, one Render **Web Service**, no CORS
and no cross-origin URL wiring to worry about — the frontend and API are served from the same
origin. `backend/app/main.py` serves the built frontend for any path that isn't `/api/...`, falling
back to `index.html` for client-side routes (e.g. a browser refresh on `/tickets/5`). You also need
one Render **PostgreSQL** resource (a separate thing from the Web Service) for `DATABASE_URL` to
point at — Render's disks are wiped on every restart/redeploy/spin-down-wakeup, so a real database
is what makes data actually persist between those (a wake-from-sleep now just no-ops the idempotent
seed instead of losing everything).

**1. New → PostgreSQL** — any name, default region/plan. Note: Render's **free Postgres expires
after 30 days** and is deleted — fine to start with, but upgrade it before then if this needs to
keep running. Once created, copy the **Internal Database URL**.

**2. New → Web Service → connect this repo:**
- Environment / Runtime: **Docker** (Render should auto-detect the root `Dockerfile`; if asked,
  Dockerfile path is `Dockerfile`, context is the repo root)
- Environment variables:
  - `DATABASE_URL` = the Internal Database URL from step 1, pasted exactly as Render gives it
    (it comes back as `postgres://...` — `backend/app/database.py` already normalizes that prefix,
    no manual editing needed)
  - `JWT_SECRET_KEY` (Render can auto-generate a value for this)
- Render injects `PORT` automatically and `start.sh` already binds to it

I built and ran this image locally (`docker build` + `docker run`, and the full stack via `docker
compose up` against a real Postgres container) before writing these instructions, including the
exact scenario that would otherwise break — a direct browser refresh on a ticket detail page
(`/tickets/5`) returning the app shell rather than raw JSON, and the dashboard's average-resolution
calculation, which would throw on Postgres if a datetime column were misconfigured — so this path
is verified, not just plausible.

Double-check Render's current dashboard field names before you start (labels move between
versions); the Docker runtime choice and the two env vars above are the parts that actually matter.

<details>
<summary>Alternative: frontend and backend as two separate Render services</summary>

If you'd rather not use Docker, the same code also supports deploying the backend as a native
Python Web Service and the frontend as a separate Static Site:

- **Backend** — Root Directory `backend`, Build Command `pip install -r requirements.txt`, Start
  Command `bash start.sh`, env vars `DATABASE_URL` (a Render Postgres Internal URL), `JWT_SECRET_KEY`,
  and `CORS_ORIGINS` (set to the frontend's URL once you know it).
- **Frontend** — Root Directory `frontend`, Build Command `npm install && npm run build`, Publish
  Directory `dist`, env var `VITE_API_URL` = the backend's bare URL (no `/api` suffix — the app
  appends that itself), plus a rewrite rule `/*` → `/index.html` so client-side routes don't 404 on
  refresh.

This needs two services instead of one and a bit of URL wiring between them, but avoids Docker
entirely if that's a constraint.

</details>

### Keeping the free-tier service warm

`.github/workflows/keep-alive.yml` pings `/health` every 10 minutes so the Render free-tier
service never sits idle long enough to spin down (avoiding the ~30–60s "cold start" delay the
next visitor would otherwise hit). It hardcodes the deployed URL — update the `APP_URL` env var in
that file if the service is ever recreated under a different URL. GitHub disables scheduled
workflows after 60 days without a commit to the repo; pushing anything re-enables it.

## Making it configurable later

- **Categories & Priorities** — already stored in DB tables and editable from Admin → Categories /
  Priorities (no code change, no restart).
- **Users & roles** — Admin → Users. Swapping in real corporate SSO later means replacing the
  `/auth/login` handler in `backend/app/routers/auth.py`; the rest of the app only depends on the
  JWT + `User` model, so no other endpoint needs to change.
- **Assignment rules** — currently manual claim/assign, matching the requirement that automatic
  routing is a later phase. `assign_ticket` in `backend/app/routers/tickets.py` is the single place
  to add round-robin/category-based auto-assignment later.
- **Notifications** — the activity history + status model already captures every event needed to
  drive email/Teams notifications later; hook into the same endpoints in `tickets.py`.
- **Remove the demo-only bits before production**: the seeded demo password, and the role dropdown
  on the login screen (a real SSO integration determines the role server-side, not the user).
