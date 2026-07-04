FROM python:3.11-slim

LABEL org.opencontainers.image.source="https://github.com/rushikeshsakharleofficial/server-inventory"
LABEL org.opencontainers.image.description="ServerInventory backend — self-hosted multi-cloud server inventory API"
LABEL org.opencontainers.image.licenses="MIT"

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd --system --create-home --shell /usr/sbin/nologin appuser \
    && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000
# Production: no --reload, 2 workers. Use docker-compose.dev.yml override for hot-reload.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]
