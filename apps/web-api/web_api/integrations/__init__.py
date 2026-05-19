"""External-service clients (OpenRouteService, Clerk JWKS).

Each integration is a single module exposing a small typed surface so the rest
of the codebase never touches `requests` / `httpx` / Clerk JWKS internals
directly. See `context/architecture.md#External integrations`.
"""
