# Outbound Spotter

Trip-planning web app for property-carrying interstate truck drivers. Inputs current location, pickup, dropoff, and cycle hours used; outputs a routed map (Leaflet + OpenRouteService `driving-hgv`) and a set of FMCSA §395.8-compliant Daily Log Sheets drawn as the driver would log them.

- Product, scope, success criteria → [`context/project-overview.md`](context/project-overview.md)
- System boundaries, invariants, pinned versions → [`context/architecture.md`](context/architecture.md)
- Entry point for AI agents → [`CLAUDE.md`](CLAUDE.md)
- Contribution flow (gitflow + PR template + commit conventions) → [`CONTRIBUTING.md`](CONTRIBUTING.md)

Hosting plan: Vercel (`web-app`, `web-auth`) + Fly.io (`web-api` + Postgres), free tier.

## License

Source-available under **PolyForm Noncommercial 1.0.0** ([`LICENSE.md`](LICENSE.md), SPDX: `PolyForm-Noncommercial-1.0.0`). You may read, modify, and use the code for non-commercial purposes (personal study, education, charitable / public research / public-safety organizations). **Commercial use, reselling, and hosting as a paid service are not permitted.**
