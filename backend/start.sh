#!/usr/bin/env bash
# Render's Start Command. Runs on every boot — a redeploy, a manual restart, and
# (on the free tier) whenever the service wakes back up after spinning down.
# The free tier's disk is wiped on each of those, so re-seeding here means the
# demo users/roles/passwords are always there — seed.py is idempotent, so this
# is also harmless on the rare boot where the disk did survive.
set -e

python -m app.seed
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
