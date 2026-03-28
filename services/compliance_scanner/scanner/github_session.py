"""Shim — implementation: ``services.github_oauth.github_session``."""

from services.github_oauth.github_session import (
    COOKIE_NAME,
    PENDING_COOKIE,
    GitHubUserBrief,
    build_authorize_url,
    clear_github_token_cookie,
    clear_pending_oauth,
    exchange_code_for_token,
    get_github_token_from_cookie,
    github_user_login,
    is_oauth_configured,
    list_authenticated_user_repos_brief,
    list_org_repos_brief,
    list_user_orgs,
    new_oauth_state,
    oauth_client_config,
    read_pending_oauth,
    set_github_token_cookie,
    set_pending_oauth,
)

# code_ingest and internal helpers
from services.github_oauth.github_session import _github_client

__all__ = [
    "COOKIE_NAME",
    "PENDING_COOKIE",
    "GitHubUserBrief",
    "build_authorize_url",
    "clear_github_token_cookie",
    "clear_pending_oauth",
    "exchange_code_for_token",
    "get_github_token_from_cookie",
    "github_user_login",
    "is_oauth_configured",
    "list_authenticated_user_repos_brief",
    "list_org_repos_brief",
    "list_user_orgs",
    "new_oauth_state",
    "oauth_client_config",
    "read_pending_oauth",
    "set_github_token_cookie",
    "set_pending_oauth",
    "_github_client",
]
