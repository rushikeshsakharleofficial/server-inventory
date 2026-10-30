FROM python:3.11-slim

LABEL org.opencontainers.image.source="https://github.com/rushikeshsakharleofficial/server-inventory"
LABEL org.opencontainers.image.description="ServerInventory backend — self-hosted multi-cloud server inventory API"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/

RUN useradd --system --create-home --shell /usr/sbin/nologin appuser \
    && mkdir -p /home/appuser/.ssh \
    && touch /home/appuser/.ssh/known_hosts \
    && chown -R appuser:appuser /app /home/appuser/.ssh \
    && chmod 700 /home/appuser/.ssh \
    && chmod 600 /home/appuser/.ssh/known_hosts
USER appuser

EXPOSE 8000
# ponytail: 1 worker so slowapi's in-memory rate limiter counts correctly —
# 2 workers each keep their own counter, so a 10/hour limit silently became
# 10/hour-per-worker (never trips). Redis-backed storage fixes this at N
# workers; not worth running Redis for a single-box app. Revisit if traffic
# needs >1 worker's throughput.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
