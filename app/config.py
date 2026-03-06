"""Environment and application configuration."""

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()

# Chunking: 1000–1500 tokens with 200 token overlap (~4 chars/token)
CHUNK_SIZE_TOKENS = int(os.getenv("CHUNK_SIZE_TOKENS", "1200"))
CHUNK_OVERLAP_TOKENS = int(os.getenv("CHUNK_OVERLAP_TOKENS", "200"))
_CHARS_PER_TOKEN = 4
CHUNK_SIZE_CHARS = int(os.getenv("CHUNK_SIZE_CHARS") or str(CHUNK_SIZE_TOKENS * _CHARS_PER_TOKEN))
CHUNK_OVERLAP_CHARS = int(os.getenv("CHUNK_OVERLAP_CHARS") or str(CHUNK_OVERLAP_TOKENS * _CHARS_PER_TOKEN))

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY", "")

JIRA_URL = os.getenv("JIRA_URL", "").rstrip("/")
JIRA_EMAIL = os.getenv("JIRA_EMAIL", "")
JIRA_API_TOKEN = os.getenv("JIRA_API_TOKEN", "")

# Role → JIRA assignee (accountId for Cloud). Maps responsible_role to engineer.
JIRA_ASSIGNEE_BACKEND = os.getenv("JIRA_ASSIGNEE_BACKEND_ENGINEER", "").strip() or os.getenv("JIRA_ASSIGNEE_BACKEND", "")
JIRA_ASSIGNEE_FRONTEND = os.getenv("JIRA_ASSIGNEE_FRONTEND_ENGINEER", "").strip() or os.getenv("JIRA_ASSIGNEE_FRONTEND", "")
JIRA_ASSIGNEE_DEVOPS = os.getenv("JIRA_ASSIGNEE_DEVOPS", "").strip()
JIRA_ASSIGNEE_SECURITY = os.getenv("JIRA_ASSIGNEE_SECURITY", "").strip()

# Sprint: field ID (e.g. customfield_10020 for JIRA Cloud) and sprint ID for board visibility
JIRA_SPRINT_FIELD_ID = os.getenv("JIRA_SPRINT_FIELD_ID", "customfield_10020").strip()

# GitHub (optional; for prepopulating export UI)
GITHUB_REPO = os.getenv("GITHUB_REPO", "").strip()
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "").strip()

CHROMA_PERSIST_DIR = Path(os.getenv("CHROMA_PERSIST_DIR", "./chroma_db"))
CHROMA_PERSIST_DIR.mkdir(parents=True, exist_ok=True)

EMBEDDING_MODEL = "all-MiniLM-L6-v2"
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
GROQ_TEMPERATURE = 0.1
GROQ_MAX_TOKENS = 4096

# § 2.2.1 Audit logging: tamper-evident, 6-year retention; § 2.2.2 = review procedures
AUDIT_LOG_DIR = Path(os.getenv("AUDIT_LOG_DIR", "./audit_logs"))
AUDIT_LOG_DIR.mkdir(parents=True, exist_ok=True)
AUDIT_RETENTION_YEARS = int(os.getenv("AUDIT_RETENTION_YEARS", "6"))

# CORS: comma-separated origins, or * for allow all
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*").strip()
if CORS_ORIGINS == "*":
    CORS_ORIGINS_LIST = ["*"]
else:
    CORS_ORIGINS_LIST = [o.strip() for o in CORS_ORIGINS.split(",") if o.strip()]
