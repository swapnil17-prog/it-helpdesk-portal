#!/usr/bin/env bash
# Render's Start Command. Runs on every boot — a redeploy, a manual restart, and
# (on the free tier) whenever the service wakes back up after spinning down.
# The free tier's disk is wiped on each of those, so re-seeding on every boot means
# the demo users/roles/passwords are always there. Seeding itself now happens in
# app.main's lifespan handler (it's idempotent — a no-op once the users table has
# rows), so this script just needs to start the server.
set -e

exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
