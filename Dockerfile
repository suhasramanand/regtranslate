FROM python:3.11-slim

WORKDIR /app

# Install system deps (for sentence-transformers / PyTorch CPU)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ ./app/
COPY VERSION* ./

# Persistent data dirs (mount as volumes)
ENV CHROMA_PERSIST_DIR=/data/chroma_db
ENV AUDIT_LOG_DIR=/data/audit_logs
ENV REGULATION_VERSIONS_DIR=/data/regulation_versions

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
