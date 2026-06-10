# syntax=docker/dockerfile:1
# ---------------------------------------------------------------------------
# Production image for the Python prediction service (FastAPI + scikit-learn).
# This is the always-on, server-side process that Vercel/serverless could not
# host. Build from the REPO ROOT:
#   docker build -f services/predict/Dockerfile -t op-predict .
# ---------------------------------------------------------------------------
FROM python:3.12-slim AS base
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1
WORKDIR /app

# ---- dependencies (cached on requirements) ----
FROM base AS deps
COPY services/predict/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# ---- runtime ----
FROM base AS runtime
# Bring in installed site-packages + console scripts.
COPY --from=deps /usr/local/lib/python3.12/site-packages /usr/local/lib/python3.12/site-packages
COPY --from=deps /usr/local/bin /usr/local/bin
# App code + the trained model artifact (committed under services/predict/model/).
COPY services/predict/ ./
# Run as a non-root user.
RUN useradd --create-home --uid 10001 appuser && chown -R appuser:appuser /app
USER appuser
ENV PORT=3005
EXPOSE 3005
# The trained model artifact is committed to the repo; fail fast if it is absent.
RUN test -f model/model.joblib || (echo "ERROR: services/predict/model/model.joblib missing — run 'python train.py' before building" && exit 1)
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
