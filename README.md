# JalDrishti — Urban Flood Intelligence & Action Platform

> **See the risk. Fix the cause.**  
> Real-time flood intelligence, citizen crowdsourced incident triage, and recurring waterlogging prevention for municipal engineering teams.

---

## Overview

JalDrishti connects citizen ground reports with municipal maintenance operations to break the cycle of recurring urban waterlogging. The platform provides:
- **Public Resilience Portal**: Editorial climate-tech landing page with an interactive mascot animation and scroll-story experience.
- **Municipal Officer Dashboard**: Triage crowdsourced waterlogging incidents, prioritize hotspots across pilot zones, log maintenance actions, and detect recurrence patterns.
- **FastAPI Persistence Backend (v1)**: Production-grade REST API with SQLite/PostgreSQL-compatible SQLAlchemy 2.x models, real persistence, automated recurrence analysis, and action queue ranking.

---

## Technology Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS, Lucide Icons, Canvas Scrollytelling, MapLibre GL JS.
- **Backend**: Python 3.11 / 3.12+, FastAPI, Uvicorn, SQLAlchemy 2.0, Pydantic v2.
- **Database**: SQLite (default local development, zero-config), portable to PostgreSQL via `DATABASE_URL`.
- **Testing & Quality**: Pytest, HTTPX test client, Node.js native test runner, Oxlint, TypeScript strict compiler (`tsc`).

---

## Getting Started

### Prerequisites

| Component | Minimum Version | Recommended |
|-----------|-----------------|-------------|
| **Node.js** | `v18.0.0+` | `v20.x` or `v22.x` |
| **npm** | `v9.0.0+` | `v10.x` |
| **Python** | `3.11+` | `3.12.x` |

---

### 1. Backend Setup (FastAPI + SQLite)

#### Install Dependencies
From the repository root:
```bash
pip install -r server/requirements.txt
```

#### Environment Configuration
Copy the example environment configuration:
```bash
# Windows PowerShell
cp backend/.env.example backend/.env

# Linux / macOS
cp backend/.env.example backend/.env
```

Default `backend/.env` configuration:
```env
DATABASE_URL=sqlite:///./backend/jaldrishti.db
RECURRENCE_WINDOW_HOURS=72
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173
ENVIRONMENT=development
```

#### Seed Initial Pilot Dataset
The database seeds deterministically upon first application startup. You can also manually seed or reset the database at any time:
```bash
python -m backend.seed
```
This populates the 5 Nerul & Sanpada pilot zones (`NZ-SAN-01` to `05`), historical incidents, and verified maintenance actions.

#### Start Backend Server (Flask)
From the repository root:
```bash
python -m flask --app backend.app:create_app run --host 127.0.0.1 --port 8000
```
Or directly via the backend entrypoint:
```bash
python -m backend.app
```
- API Base URL: `http://127.0.0.1:8000`
- Health Endpoint: `http://127.0.0.1:8000/health`
- Zones API: `http://127.0.0.1:8000/api/zones`
- Incidents API: `http://127.0.0.1:8000/api/incidents`
- Prioritisation Evaluations: `http://127.0.0.1:8000/api/prioritisation/evaluations`
- Action Queue: `http://127.0.0.1:8000/api/action-queue`
- Numerical Rainfall Model: `http://127.0.0.1:8000/api/rainfall/current`

---

### 2. Frontend Setup (React 19 + MapLibre GL + Vite)

#### Install Dependencies
From the repository root or inside `frontend/`:
```bash
npm install
```

#### Environment Configuration
Inside the `frontend/` directory, copy `.env.example` to `.env.local`:
```bash
cp frontend/.env.example frontend/.env.local
```
Configuration options:
```env
VITE_API_URL=http://127.0.0.1:8000
VITE_DATA_MODE=api

# CARTO Positron Basemap Key (GIS v2)
# Register at https://carto.com/ to obtain a vector tile API key.
# If omitted, the dashboard displays a clear configuration notice and provides
# seamless fallback to the illustrated pilot schematic map.
VITE_CARTO_API_KEY=
```

#### Start Frontend Dev Server
From the repository root:
```bash
npm run dev
```
(Or navigate into `frontend` with `cd frontend && npm run dev`)

Navigate to:
- Homepage: `http://127.0.0.1:5173/`
- Officer Dashboard: `http://127.0.0.1:5173/dashboard`
- Risk Map (GIS v2): Click **Risk Map** in the dashboard sidebar.

---

## Interactive GIS Map (Milestone v2)

The dedicated **Risk Map** view features a dual-engine architecture:

1. **MapLibre Vector GIS (Default)**:
   - Powered by **MapLibre GL JS** and CARTO Positron vector tiles (`https://basemaps.cartocdn.com/gl/positron-gl-style/style.json?key=...`).
   - Custom styled HTML markers for pilot zones with risk band badges and recurrence indicators.
   - Severity-coded GPS incident markers (High, Moderate, Low) with pulsing halos on selected pins.
   - Interactive hover popups displaying incident ID, category, review status, and quick inspector link.
   - Controls: NavigationControl (pan, zoom, pitch, north orientation), and **"Fit Pilot"** button to auto-frame Nerul & Sanpada bounds.
   - Dynamic layers: Toggle zone pins, recent incidents, high-risk only, or recurring hotspots.
   - Clean WebGL lifecycle management: Automatic ResizeObserver and unmount cleanup prevents memory/context leaks.
2. **Graceful Basemap Fallback**:
   - If `VITE_CARTO_API_KEY` is not configured or network authorization fails, a clear configuration banner explains how to set `VITE_CARTO_API_KEY` in `.env`.
   - The user can instantly switch to the **Illustrated Schematic Map** without page crashes or visual degradation.
3. **Strict Coordinate Truthfulness**:
   - Only records with verified GPS coordinates are mapped to physical coordinates.
   - Approximate or non-georeferenced reports (e.g. WhatsApp photos without live GPS pins) are clearly flagged in the spatial metadata bar (`1 Approximate / Missing GPS`) rather than plotted with false precision.
   - Official municipal cadastral ward boundary GeoJSON is marked as pending municipal GIS import.

---

## Explainable Risk & Resource Prioritisation Engine (Milestone v3)

JalDrishti v3 introduces a transparent, deterministic decision engine for municipal engineers and drainage officers to compare waterlogging locations, understand contributing risk vs. operational priority factors, and simulate what-if staffing/budget allocation scenarios.

### 1. Separation of Risk vs. Priority
- **Environmental Risk (Physical Susceptibility)**: Reflects inherent topography, low-elevation underpass geography, historical catchment vulnerability, and localized rainfall spells. Risk answers: *"How inherently susceptible is this site to water accumulation?"*
- **Operational Priority (Urgency of Municipal Review)**: Reflects unaddressed severity, citizen corroboration velocity, signal recency, and verified recurrence after recorded maintenance. Priority answers: *"Why does this location demand inspection or crew intervention before other sites today?"*

### 2. Transparent Factor Breakdown
Every zone evaluation contains an explicit, explainable score breakdown (0–100) calculated deterministically without black-box predictive ML:
- **Active Incident Severity (0–35 pts)**: Critical (+35), High (+25), Medium (+15), Low (+5).
- **Post-Maintenance Recurrence (0–30 pts)**: Verified recurrence within 72h window (+30) indicates chronic drainage failure or failed interventions.
- **Citizen Corroboration & Velocity (0–20 pts)**: Multiple independent citizen reports within 24h (+5 pts per report up to +20).
- **Signal Recency (0–15 pts)**: High-urgency weight for reports in last 2h (+15), 6h (+10), 24h (+5).
- **Deterministic Tie-Breaking**: `(priority_score DESC, risk_score DESC, active_incident_count DESC, zone_id ASC)` guarantees reproducible queue ordering.
- **Data Provenance**: Rainfall observations explicitly display telemetry provenance and are visibly labeled `SIMULATED: AWS-Nerul 28 mm/h spell`. Missing inputs are tracked as `missing_inputs` rather than substituted with fabricated assumptions.

### 3. What-If Resource Allocation Simulator
A deterministic scenario engine empowers officers to test hypothetical resource constraints:
- **Constraints**: Available budget (₹), number of crews, available staff-hours.
- **Greedy Allocation**: Evaluates candidate interventions in descending priority order against remaining budget, hours, and crew limits.
- **Explainability**: Returns both selected interventions and unselected interventions with explicit shortfall reasons (e.g. `Budget shortfall (requires ₹30,000, remaining ₹5,000)`).
- **Decision Support Caveats**: Explicit disclaimers state that the tool is an operational planning aid, not an engineering-validated flood-reduction or financial savings model.

---

## Real Weather Data Integration (Milestone v4)

JalDrishti v4 integrates real numerical weather prediction (NWP) precipitation data from Open-Meteo into the municipal dashboard, replacing the simulated-only rainfall display with source-attributed atmospheric context while preserving offline demo mode.

### 1. Provider & Data Provenance
- **Provider**: Open-Meteo Forecast API (`ECMWF/GFS numerical weather prediction blend`).
- **Data Provenance**: Clearly labeled `WEATHER MODEL: Open-Meteo ECMWF/GFS Numerical Weather Prediction (Not rain-gauge observed)`. It is never misrepresented as physical rain gauge telemetry.
- **Timezone**: All observations and forecast windows are localized to Indian Standard Time (`Asia/Kolkata` / UTC+05:30).
- **Temporal Partitioning**: Past model hours (last 6–12h) and forward forecast hours (next 12–24h) are strictly classified (`is_forecast: true/false`) and visually distinguished in the trend chart with `FCST` indicators.

### 2. Resilience, Caching & Database Persistence
- **In-Memory Cache (15m TTL)**: Cached by geographical coordinates to prevent redundant provider requests on dashboard reloads or component renders.
- **SQLite Persistence**: Fresh observations are stored in the `rainfall_observations` table so telemetry history survives backend restarts.
- **Graceful Degradation**: If the external provider times out or fails, the engine serves the last stored observation marked with `is_stale: true` and explicit age (`STALE (Xm ago)`), rather than crashing or silently replacing data with seeded rainfall.
- **Manual Refresh Control**: Debounced refresh button on the panel triggers immediate provider queries, updates persistence, and clears cache with duplicate-click protection.

### 3. Spatial Resolution & Cluster Disclosure
- **Regional Atmospheric Grid (~11 km)**: Open-Meteo models operate on a ~0.1° grid cell. All 5 Navi Mumbai pilot zones (Nerul & Sanpada, spanning 4.8 km) fall within the same regional atmospheric cell; regional rainfall projections are identical across this pilot cluster.
- **Physical vs. Model Distinction**: Regional weather forecasts provide convective rainband context; physical street ponding is verified through citizen ground reports.

---

## Operating Modes: API Mode vs. Local Demo Mode

JalDrishti supports two distinct, isolated operating modes to ensure seamless offline demonstrations as well as reliable database persistence:

| Feature | API Persistence Mode (Default) | Offline Demo Mode |
|---------|--------------------------------|-------------------|
| **Data Source** | FastAPI backend (`server/jaldrishti.db`) | Browser `localStorage` |
| **Persistence** | Survives backend, frontend & browser restarts | Survives browser refresh in local browser |
| **Recurrence Engine** | Server-side evaluation (72h sliding window) | Client-side rule simulation |
| **Prioritisation & Scenarios** | Backend endpoints (`/api/prioritisation/*`) | Client-side deterministic utility (`scenarioUtils.ts`) |
| **Weather Telemetry** | Open-Meteo NWP model with SQLite caching | Seeded historical fixture (`AWS-Nerul`) |
| **Weather Badge** | Blue: `WEATHER MODEL (ECMWF/GFS)` | Amber: `SIMULATED FEED` |
| **Indicator Badge** | Green: `API Persistence Active (SQLite)` | Amber: `DEMO MODE (Local Storage)` |
| **Connection Errors** | Explicit error banner with **Retry** and **Switch to Demo** options. Never silently corrupts local data. | N/A (Fully offline) |

To switch modes in the UI:
- Click **"Switch to Local Demo"** or **"Switch to API Mode"** in the sidebar navigation card.
- Or use the alert banner action if the backend connection is interrupted.

---

## API Endpoints Reference

All endpoints return standard JSON responses with ISO 8601 timestamps:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Service health, database status, and uptime timestamp. |
| `GET` | `/api/zones` | List all pilot zones with current risk band, coordinates, and recurrence status. |
| `GET` | `/api/zones/{zone_id}` | Retrieve details for a specific pilot zone. |
| `GET` | `/api/zones/{zone_id}/history` | Comprehensive audit trail: incidents, maintenance actions, and recurrence flags for a zone. |
| `GET` | `/api/incidents` | List crowdsourced incidents (supports `zone_id`, `status`, `severity` filtering). |
| `GET` | `/api/incidents/{incident_id}` | Retrieve a single incident by ID. |
| `POST` | `/api/incidents` | Create a new crowdsourced incident report (auto-triggers recurrence check). |
| `PATCH` | `/api/incidents/{incident_id}` | Update incident review status, notes, or recurrence decision. |
| `GET` | `/api/maintenance` | List verified municipal maintenance and inspection logs (supports `zone_id` filter). |
| `POST` | `/api/maintenance` | Record a new maintenance action (validates foreign keys and updates zone history). |
| `GET` | `/api/action-queue` | Dynamic hotspot priority ranking based on v3 prioritisation engine. |
| `GET` | `/api/prioritisation/evaluations` | List explainable evaluations (score, factors, provenance, suggested action) for all zones. |
| `GET` | `/api/prioritisation/evaluations/{zone_id}` | Retrieve single zone priority evaluation and factor breakdown. |
| `POST` | `/api/prioritisation/scenario` | Run what-if resource allocation simulation against specified budget, hours, and crews. |
| `GET` | `/api/rainfall/current` | Retrieve current precipitation and numerical weather model estimates for pilot cluster. |
| `GET` | `/api/rainfall/history` | Retrieve recent hourly precipitation and forward forecast window from numerical weather model. |
| `POST` | `/api/rainfall/refresh` | Force an immediate live refresh from Open-Meteo API, updating SQLite persistence. |
| `POST` | `/api/demo/reset` | Re-seed initial demonstration dataset (development/demo mode only). |

---

## Running Automated Tests & Code Quality

### 1. Backend Pytest Suite
Runs 36 automated unit and integration tests against an isolated in-memory SQLite database:
```bash
python -m pytest server/tests -v
```

### 2. Frontend Unit Tests (Node Native Test Runner)
Runs 27 unit tests covering spatial coordinates, scenario greedy allocation, and weather display utilities:
```bash
npm test
```

### 3. Frontend Linting
```bash
npm run lint
```

### 4. Frontend TypeScript Check & Production Build
```bash
npm run build
```

---

## Current Scope & Limitations

- **Weather Integration (Milestone v4 Complete)**: Open-Meteo numerical weather prediction model with caching, persistence, forecast separation, and grid disclosures. Model outputs are regional projections, not physical rain gauges or calibrated street-level flood depth forecasts.
- **Prioritisation & Scenario Engine (Milestone v3 Complete)**: Rule-based explainable scoring with clear factor weights, deterministic greedy allocation, and transparent caveats.
- **GIS (Milestone v2 Complete)**: MapLibre GL JS is integrated for the Risk Map view with CARTO Positron vector tiles, custom markers, and graceful schematic fallback. Real GPS points are mapped without inventing fake polygon boundaries.
- **Database**: SQLite default is optimal for pilot testing and local development. Database configuration is modular via `DATABASE_URL` for future PostgreSQL migration.
- **Vision AI**: Incident photo previews use seeded WhatsApp crowdsourced submissions. Live automated Gemini Vision multimodal ingestion pipelines are planned for a subsequent milestone.

---

## License & Attribution

JalDrishti — Built for Resilient Cities. Curious by Design.  
Developed for Navi Mumbai Municipal Corporation (NMMC) pilot study.


