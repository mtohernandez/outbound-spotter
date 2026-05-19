# Outbound Spotter

## Overview

Outbound Spotter is a trip-planning web app for property-carrying interstate truck drivers operating under the 70-hour / 8-day Federal HOS schedule. The driver enters current location, pickup, dropoff, and cycle hours already used; the app returns a routed map (with mandatory rest, fueling, pickup, and dropoff stops) and a set of FMCSA-compliant Daily Log Sheets that span the trip, drawn as the driver would log them in §395.8 RODS format.

## Goals

1. Compute a trip plan that respects the FMCSA HOS limits — 14-hour driving window, 11-hour driving limit, 30-minute break after 8 cumulative driving hours, 10 consecutive hours off, and the 70-hour / 8-day cap — for a property-carrying CMV with no adverse conditions.
2. Render a route with mandatory stops: pickup (1 hr on-duty), dropoff (1 hr on-duty), fueling every ≤1,000 miles, and rest / sleeper-berth periods.
3. Produce one fully-drawn Daily Log Sheet per 24-hour period of the trip, with the duty-status grid lines, totals, and Remarks (city/state at each duty change) accurate to the regulation.
4. Persist trips per signed-in user so drivers can revisit, share, and export them.
5. Be hostable for free on Vercel + Fly.io within the assessment review window.

## Core User Flow

1. Driver lands on `app.<host>` (web-app). If signed out, redirected to `auth.<host>` (web-auth — Clerk session).
2. After sign-in, driver sees the trip form and chooses **New trip**.
3. Driver enters: current location, pickup location, dropoff location (all geocoded via OpenRouteService), and cycle hours used (0–70).
4. Driver submits. web-app POSTs `/api/trips/` to web-api.
5. web-api geocodes the three addresses, calls OpenRouteService `driving-hgv` for a route, runs the HOS planner over the route to insert pickup, dropoff, fueling, breaks, and off-duty periods, generates a structured list of log-day events, and returns the trip.
6. web-app displays:
   - A **Leaflet** map with the route polyline and color-coded stop markers (pickup, dropoff, fuel, break, sleeper).
   - A scrollable strip of **Daily Log Sheets** (one SVG per 24-hour period) drawn from the structured events.
7. Driver can **Save**, **Export PDF** (client-side svg2pdf.js over each log SVG), or open a saved trip from history.

## Features

### Trip planning

- Three-address input with autocomplete (ORS geocoding)
- Cycle-hours-used input (0–70, validated)
- Compute route + HOS-compliant timing
- Map view with route polyline and typed stop markers

### ELD daily logs

- SVG renderer that draws the §395.8 24-hour grid: Off Duty, Sleeper Berth, Driving, On Duty (Not Driving)
- Per-status total hours column
- Remarks section auto-filled with city/state at each duty change
- Pickup and dropoff drawn as 1 hr On Duty (Not Driving)
- Fuel stops drawn as On Duty (Not Driving) with the fuel location in Remarks
- Multiple log sheets for multi-day trips, in date order

### Account + history

- Clerk-managed sign-in / sign-up via custom shadcn-blocks pages in web-auth
- Saved trips list (most recent first)
- Open / delete a saved trip

### Export

- One-click PDF export — concatenates every log-sheet SVG into a single PDF, downloaded in-browser

## Scope

### In Scope (v1)

- 70-hour / 8-day schedule only
- Property-carrying CMV only
- No adverse driving conditions
- US interstate routes
- One driver (no team-driver / sleeper-berth pairing)
- Fueling assumed at least every 1,000 miles
- 1 hour for pickup, 1 hour for dropoff
- English UI only

### Out of Scope (v1)

- 60-hour / 7-day schedule (can be added later)
- Hazmat / placarded loads
- Adverse-conditions extensions (§395.1(b))
- Team-driver / split-sleeper berth math (§395.1(g))
- Personal conveyance or yard moves
- Real-time GPS tracking or device integration (this is a planner, not an ELD)
- FMCSA certification (out of legal scope for the assessment)

## Success Criteria

1. A signed-in driver can submit Current + Pickup + Dropoff + Cycle Hours and see a route map plus correct daily log sheets within ~5 s on a normal connection.
2. For a known trip (Richmond VA → Newark NJ, ~350 mi, 0 cycle hours used), the generated logs match the FMCSA John Doe example (`docs/assets/example-complete-grid.png`) in structure: pre-trip on-duty, drive, fuel stop on-duty, drive, lunch off-duty, drive, delivery on-duty, drive, sleeper, drive, post-trip on-duty.
3. A multi-day trip (e.g., Los Angeles → New York) generates one log sheet per 24-hour period; no single day shows more than 11 hours of Driving, 14 hours of driving-window, or 8 cumulative driving hours without a 30-minute break.
4. The 70-hour / 8-day cap is respected: if the driver enters 65 cycle hours used, the planner schedules a 34-hour restart before any new driving past the 70-hour mark.
5. Trips persist per user; a refresh restores the same trip from saved history.
6. Logs can be exported to a single PDF entirely client-side (no Chromium in production).
