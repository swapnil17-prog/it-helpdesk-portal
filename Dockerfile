# ---- Frontend build ----
FROM node:20-alpine AS frontend-build
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install
COPY frontend/ .
RUN npm run build

# ---- Backend runtime (also serves the built frontend) ----
FROM python:3.12-slim
WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
COPY --from=frontend-build /frontend/dist ./static

ENV PORT=8000
# Otherwise Python buffers stdout in a non-TTY container, so startup logs (e.g. seed
# confirmation) silently sit in a buffer instead of reaching `docker logs`/Render logs.
ENV PYTHONUNBUFFERED=1
EXPOSE 8000

CMD ["bash", "start.sh"]
