import os
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.database import Base, engine
from app.routers import auth, config, dashboard, tickets, users
from app.seed import seed


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    seed()  # no-ops on its own once the users table is non-empty
    yield


app = FastAPI(title="IT Helpdesk Ticketing Portal API", version="1.0.0", lifespan=lifespan)

default_origins = "http://localhost:5173,http://127.0.0.1:5173"
cors_origins = os.environ.get("CORS_ORIGINS", default_origins).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Attachments are intentionally NOT served as a public static folder — they're only
# reachable through GET /tickets/{id}/attachments/{id}/download, which enforces the
# same requester/agent/admin visibility rules as the rest of the ticket.

# Every API route lives under /api. This matters beyond style: when the built frontend
# is served from this same app (see FRONTEND_DIR below), a bare path like /tickets/5 is
# ALSO a legitimate frontend route (the ticket detail page) — without a distinct prefix,
# the API route would shadow the page and a browser refresh on it would get JSON instead
# of the app shell.
app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(config.router, prefix="/api")
app.include_router(tickets.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")


@app.get("/health")
def health():
    return {"status": "ok"}


# The Docker image builds the React app and copies it here (see Dockerfile). Locally,
# this directory doesn't exist — the frontend is served separately by `npm run dev`
# instead — so all of this is skipped in local development.
FRONTEND_DIR = Path(__file__).resolve().parent.parent / "static"

if FRONTEND_DIR.is_dir():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIR / "assets"), name="frontend-assets")

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str):
        candidate = FRONTEND_DIR / full_path
        if full_path and candidate.is_file():
            return FileResponse(candidate)
        # Any other path (including client-side routes like /tickets/5) falls back to
        # the SPA shell so React Router can take over.
        return FileResponse(FRONTEND_DIR / "index.html")
