"""Geocoding feature — thin Pelias proxy.

Two endpoints (``/api/geocode/autocomplete/`` and ``/api/geocode/search/``)
forward to the typed client at ``web_api.integrations.openrouteservice``. No
business logic; the API key never reaches the browser (architecture invariant
#3 in ``context/architecture.md``).
"""
