# JalDrishti Officer Dashboard — Product Requirements Document

**Version:** 1.0  
**Product:** JalDrishti — Urban Flood Intelligence  
**Tagline:** See the risk. Fix the cause.  
**Audience:** Antigravity implementation agent / engineering team  
**Primary users:** Municipal officers, control-room staff, maintenance supervisors  
**Pilot geography:** Nerul and Sanpada, Navi Mumbai  
**Release scope:** Impact-X hackathon MVP

---

## 1. Objective

Build the private JalDrishti officer dashboard using the two supplied dashboard screenshots as visual references. The **light-theme reference is the primary direction**; the dark screenshot is only a secondary reference for information density and map contrast.

The design should retain the reference's core composition:

- Fixed left navigation rail with brand identity.
- A compact top header with pilot area and data freshness.
- A large interactive GIS map as the main focus.
- A selected-hotspot detail panel on the right.
- A priority action queue below the map.
- A compact rainfall/context trend panel beside the queue.

Adapt the content, metrics, buttons, status labels, data and workflows to JalDrishti's actual scope. The supplied images contain the wrong product name and illustrative figures. **Do not copy those literally.** Use the supplied JalDrishti assets from `assets/` and the real project requirements described in this document.

This is an officer tool, not the public homepage and not a citizen reporting website. Citizens report through WhatsApp only. Do not add a public report-submission form or citizen-facing map.

## 2. Product definition and boundaries

JalDrishti organises citizen-submitted waterlogging reports, available environmental and geographic context, and recorded maintenance actions. It gives authorised officers an evidence-backed view of relative zone risk, recurring hotspots, and suggested next actions.

The proposed differentiator is the **incident → recorded maintenance action → recurrence review** workflow. When reports appear again at the same location or zone after a maintenance action has been recorded, the dashboard should link the evidence and flag the location for human review.

JalDrishti is a hackathon prototype. It is not a certified flood-warning service, does not replace official systems, and does not design drainage infrastructure.

### Non-negotiable truthfulness rules

- Do not claim calibrated street-level flood prediction, exact flood depth, or a proven cause of drainage failure.
- Do not present a prototype relative-risk score as a probability that flooding will occur.
- Do not imply official NMMC actions, live rainfall, live sensor readings or citizen submissions unless they are genuinely integrated and sourced.
- Clearly label mock, seeded, simulated, inferred and historical-case-study data.
- A risk band and a confidence/data-coverage level are separate concepts and must never be merged.
- Recommendations support officer decisions. They are not automatic dispatch instructions or engineering designs.

## 3. Reference design and art direction

### Primary reference

Use the **light-theme screenshot** as the main dashboard layout reference. Keep its generous map area, restrained panel borders, compact navigation, readable data table and selected-hotspot inspector. The dark screenshot may inform map contrast only; do not build both themes for the MVP.

### Brand

- Product name: **JalDrishti**
- Descriptor: **Urban Flood Intelligence**
- Tagline: **See the risk. Fix the cause.**
- Use the actual JalDrishti logo asset in `assets/`. Inspect existing filenames and choose the correct symbol or logo-with-text asset.
- Do not reproduce the “JalSaathi” wordmark, “Safer Cities Together” tagline or logo from the reference images.
- Do not redraw, approximate or replace the supplied logo.

### Visual language

- Default light theme: warm near-white and pale icy blue, deep navy text, river-blue actions, muted slate secondary text.
- Use calm, refined contrast; avoid neon colours, heavy glassmorphism, oversized radii, gradients used as decoration, and excessive shadows.
- Use the existing website typography if it is already established: Instrument Serif for page/section headings and Manrope for controls, data, labels and tables. Readable numerals matter more than ornamental styling.
- The dashboard should feel like a carefully designed civic operations product, not a generic admin template.
- Use red only for high-risk/severe status, amber for moderate/attention, and blue for low risk/informational states. Always pair colours with text and/or icons.
- Dense information is acceptable where it supports decisions, but the primary action and the reason behind it must be immediately obvious.

Suggested tokens if no established project tokens exist:

```css
--jd-bg: #F5F8FC;
--jd-surface: #FFFFFF;
--jd-surface-muted: #EDF4FA;
--jd-navy: #10243B;
--jd-text-secondary: #526984;
--jd-river-blue: #1769C2;
--jd-sky-blue: #288EE8;
--jd-border: #DCE6EF;
--jd-risk-high: #D94C55;
--jd-risk-moderate: #D9952C;
--jd-risk-low: #2879D8;
--jd-success: #27836E;
```

Use existing design tokens when possible instead of introducing duplicate token systems.

## 4. Primary information architecture

The sidebar should use this navigation, with a visible active state:

1. **Overview**
2. **Incidents**
3. **Risk Map**
4. **Action Queue**
5. **Maintenance**
6. **Analytics**

Add **Data & Layers**, **Zones**, and **Settings** as secondary navigation only if the existing application structure can support them without bloating the MVP. Do not add unrelated modules.

Every navigation item must lead to a real screen or a clearly implemented in-scope view. Do not leave important buttons inert or link every item to the same placeholder screen. If a page is deferred, make that limitation explicit and keep it out of the primary navigation rather than pretending it works.

## 5. Overview screen layout

### 5.1 Top header

Use a practical operational heading rather than a generic greeting.

**Suggested heading:** `Flood operations overview`  
**Suggested supporting text:** `Review incidents, zone risk and recurring hotspots across the Nerul & Sanpada pilot.`

Header controls, left to right after the page title:

- Pilot area selector: `Nerul & Sanpada` (only use zones present in configured data).
- Data/rainfall context pill, showing source status and freshness rather than invented “live” conditions.
- Date/event range selector (e.g. latest records, last 24 hours, historical event replay), based on available data.
- Notifications button that opens the alert/event list.
- Signed-in officer menu if authentication exists; otherwise a clearly labelled demo identity in demo mode.

**Do not hardcode** “18 mm · Last 1 hour”, a current rainfall status, a current date, or any other dynamic metric from the reference screenshot. Render values from the configured data source. If not connected, show `Demo data` or `No live feed connected` and the simulated/historical timestamp.

Display a persistent but visually restrained **DEMO MODE / SIMULATED DATA** indicator when seeded demo data is active. It must remain visible throughout the dashboard, not only inside a tooltip.

### 5.2 Main GIS map

The map is the visual centre of the overview and should occupy approximately 58–63% of the upper content width, with the selected-hotspot inspector at the right.

Map requirements:

- Show 3–5 configured pilot zones around Nerul and Sanpada. Do not imply full Navi Mumbai coverage.
- Use zone polygons or boundaries with relative risk bands: High, Moderate, Low, and Insufficient data.
- Show incident markers or clusters; selection opens the relevant incident/zone detail panel.
- Show named landmarks only if configured from sourced or explicitly simulated data.
- Use a clear, compact map legend with colour and text.
- Support the relevant map controls only: zoom in/out, reset/north orientation if supported, and layer selection.
- Include a scale only if it is valid for the map projection and viewport.
- Provide map attribution for the basemap and any OpenStreetMap-derived data as required by its licence.
- Use MapLibre GL JS and an authorised basemap source if the project already uses the proposed stack. Do not require an unpaid/paid API token without checking existing configuration.
- Make the map work with the deterministic demo dataset even if external map layers or live feeds are unavailable.

Recommended layer controls:

- Relative zone risk (default on)
- Recent incidents
- Rainfall context
- Verified drainage assets (only if available)
- Key locations

Do not show a checked “Drainage Network” layer unless the displayed drainage features actually exist in the configured data. Missing map features do not prove that there is no drainage infrastructure.

Map title/legend should say **Relative zone risk**, not “Flood probability” or “Flood depth”. Only use a “next 6 hours” label if a real or clearly labelled forecast source and a defensible prediction rule support that time horizon.

### 5.3 Selected-hotspot inspector (right panel)

This panel updates when the user selects a zone, incident cluster or priority-queue row.

Required contents:

- Location/zone name and stable ID where configured.
- Risk band with text and icon.
- Separate confidence/data-coverage indicator.
- Source freshness and data status (observed, forecast, historical report, inferred, or simulated).
- Incident photo thumbnails if available, with secure access and a clear demo/illustrative label where applicable.
- Tabs: **Overview**, **Incidents**, **Maintenance**.
- A concise recurrence banner when the recurrence rule has been triggered.
- “Why this is flagged” explanation with the exact evidence/rule: dates, report cluster, earlier action, newer cluster and corroboration.
- Suggested next action, such as Inspect, Clean / Review, Monitor, or Escalate for Engineering Assessment.
- Primary action button appropriate to the record's state.

Do not put unverified “average water depth” such as `25–40 cm` into a standard risk card. Photographs do not establish reliable depth. If a measured depth is actually available, show its source, time, unit and measurement status; otherwise omit it.

Do not put invented counts like `12 incidents` or `3 maintenance actions` into the production view. In demo mode they may be shown only when seeded data supports them and the global simulation indicator is present.

#### Inspector tab behaviour

- **Overview:** current incident/zone summary, relative risk, contributing factors, source freshness and recommended next step.
- **Incidents:** all linked reports with time, category, review state, source/data status and media preview.
- **Maintenance:** recorded actions with actor, action type, status, date/time, notes and whether completion was verified.

### 5.4 Priority Action Queue

Place the action queue below the map/inspector row, taking most of the available width. It is a core operational feature, not a decorative table.

Columns:

1. Rank
2. Location / zone
3. Risk band
4. Issue type
5. Evidence count / corroboration
6. Latest report time
7. Suggested next action
8. Status
9. Row action/open-detail control

Supported status filters: New, Needs Review, Assigned, In Progress, Escalated, Closed / Dismissed. Keep the visible filter set compact.

Each queue entry must:

- Be clickable and select the matching incident or hotspot.
- Show a clear, concise “Why ranked here” explanation in the row detail or inspector.
- Use a deterministic documented priority heuristic for identical inputs.
- Distinguish observed evidence from AI inference and simulated fixture data.
- Support filtering/sorting and pagination or a compact “View all” route where data size warrants it.

Use verb-based actions:

- **Inspect**
- **Clean / Review**
- **Monitor**
- **Escalate for Engineering Assessment**
- **Close / Dismiss**

Do not show generic buttons such as “Investigate” without the corresponding workflow, and do not include CTA buttons that have no implemented action.

For the hackathon, the queue should be seeded with a deterministic demo scenario, including at least one recurrence-after-action example. Label simulated actions and reports. Do not claim that NMMC actually performed an action unless it is sourced and authorised.

### 5.5 Rainfall and context trend panel

Place a compact panel alongside the action queue where desktop width permits. It should answer an operational question, not exist as decoration.

Recommended content:

- Rainfall observations or forecast series for the selected zone/time window.
- Optional relative-risk snapshots on a separate chart or clearly explained scale.
- Period selector: Last 24 hours, historical event, or selected time range—only those backed by available data.
- Source, timestamp, units and `Observed`, `Forecast` or `Simulated` label.
- Link/control to open the historical event replay or analytics view.

Avoid an ambiguous dual-axis chart mixing rainfall and risk without clear explanation. Do not draw trend lines using invented values while presenting them as live. If demo values are used, show a visible `SIMULATED` label on the panel and include their provenance in the details.

## 6. Required dashboard workflows

### 6.1 Incident review

1. Officer selects a report from the map or Incidents screen.
2. Inspector shows photo/media, location or zone, timestamp, source, category, severity estimate, confidence/uncertainty and review state.
3. Officer can set the review state to New, Needs Review, Confirmed/Verified, Duplicate, Unclear, or Closed.
4. State changes are persisted and include actor/time when authentication/audit logging is available.
5. The report is not described as verified unless an authorised reviewer confirms it.

### 6.2 Maintenance action and recurrence review

1. Officer opens a hotspot.
2. Officer records an action such as Inspect, Clean / Review, Repair Recorded, Monitor, or Escalate for Engineering Assessment.
3. Form fields: action type, status, time, notes, optional assignee, and verification status. Include a data-status choice: Real / Sourced, Demonstration, or Simulated.
4. A later report cluster in the same zone/event rule can trigger a **Possible recurrence** flag.
5. The recurrence detail links the earlier incident cluster, the recorded action, and the later cluster. It explains the rule that triggered it.
6. Officer can Confirm, Dismiss, or leave for review; the outcome and rationale should be saved.

A recurrence flag is not proof that maintenance failed or that a specific drain caused the issue. Use wording such as “Possible recurrence after recorded action — review recommended.”

### 6.3 Early-warning preview

Provide a small in-scope flow for a threshold-triggered internal alert:

- Display the zone, source/time, risk rationale and configured threshold.
- Create an alert preview for a reviewed WhatsApp template.
- Require authorised approval/consent checks before any real outbound send.
- Store provider send status; never indicate delivery before the provider confirms it.
- Prevent accidental messages to real residents in demo mode.
- If live messaging isn't configured, use a deterministic alert event clearly labelled `Demo`.

The system must not present its own messages as official emergency warnings unless formally authorised.

### 6.4 Historical event replay and evaluation

Provide a dedicated Analytics/replay view, not just an ornamental line chart.

- Use the curated early-July 2026 Navi Mumbai waterlogging case study, with the source and date attached to each record where available.
- Show the event timeline, reported locations and the priority shortlist produced by the chosen risk/priority rules.
- Show hotspot shortlist coverage against the curated source-linked reports, with unmatched records and limitations visible.
- Clearly label it a case-study replay, not comprehensive ground truth or proof of general prediction accuracy.
- Support reset/replay to return to a deterministic demo starting state.

## 7. Risk and action-priority semantics

Keep these three concepts separate:

### Zone risk
A relative indicator derived from available rainfall, terrain/context, historical recurrence and current incident evidence. It is not a calibrated probability, a precise flood depth, or a guarantee of flooding.

### Confidence/data coverage
Indicates how much reliable, relevant input data is available and how uncertain the interpretation remains. Show missing signals explicitly. Do not silently replace missing inputs with zero or label the score high-confidence when required data is missing.

### Action priority
A work-triage ordering for officers, not a scientific hazard probability or autonomous dispatch decision. Each entry must explain why it is ranked where it is.

The master PRD defines initial illustrative weights (subject to configuration and data availability):

- Zone-risk hypothesis: rainfall 30%, historical recurrence 25%, terrain 20%, current incident evidence 15%, infrastructure/context 10%.
- Action-priority heuristic: severity/immediate hazard evidence 30%, recurrence after prior action 25%, recency 20%, independent corroboration 15%, context/exposure 10%.

Treat these as **prototype starting assumptions, not scientifically calibrated weights**. Implement only if the corresponding signals and normalisation are documented. Store the score version and contributing factors. If there is insufficient data, display `Insufficient data` instead of a misleading risk band.

## 8. Data requirements and demo fixtures

### 8.1 Core data entities

Use the project's established database/schema where possible. The conceptual entities are:

- **Zone:** `zone_id`, `name`, geometry, source, boundary confidence, active flag.
- **Incident:** `incident_id`, provider message ID, zone ID, coordinate if shared, created time, type, visual-severity estimate, model confidence/uncertainty, review state, duplicate group, event ID, private media reference, data status.
- **Reporter contact:** contact ID, encrypted phone, consent state, language preference, last interaction. Keep this separate from regular analytics and never show raw phone numbers in the overview.
- **Rainfall observation:** zone/geometry, valid time, ingestion time, rainfall amount, interval, source, kind (`observed`, `forecast`, `simulated`) and quality status.
- **Context feature:** type, geometry, source, last verification time, confidence, licence note. Examples: underpass, critical route, verified drainage asset.
- **Risk snapshot:** zone, calculated time, score/band, score version, data coverage, contributing factors, missing factors and provenance.
- **Maintenance action:** zone/incident, action type, status, created/completed time, actor, notes, verification status and data status.
- **Rain event:** event ID, name, start/end, source notes, data status and replay configuration.
- **Alert log:** zone, rule, template, language, approval actor, created time, provider status and data status.
- **Evaluation run:** dataset version, model name, run time, class metrics, confusion matrix, replay metrics and notes.
- **Audit event:** actor/system, entity, action, timestamp and a minimal before/after summary.

### 8.2 Data-status labels

Use explicit, consistent badges:

- `Observed` — measured source data.
- `Forecast` — forecast source data.
- `Published report` — historical claim taken from a cited publication.
- `AI estimate` — model-generated interpretation.
- `Inferred` — derived by a documented rule.
- `Simulated` — generated for demo/replay.
- `Demo action` — maintenance action created for the demonstration.

The dashboard must not silently blend data statuses.

### 8.3 Seed data

Create deterministic fixtures for the full demo scenario so the dashboard works without live WhatsApp, weather or sensor services. Suggested named pilot locations may include Sanpada Underpass, Nerul MIDC and nearby Nerul/Sanpada zones only where source-supported or explicitly identified as demo fixtures.

Seed data should demonstrate:

- Several reports in distinct zones with different review states.
- A report with missing/uncertain location.
- One possible duplicate group.
- One high-priority location with a previous recorded maintenance action and a later report cluster.
- Rainfall/context records with timestamps and source/data-status labels.
- At least one alert preview event.
- A historical event replay with source references and incomplete coverage stated.

Demo fixtures must be resettable and labelled consistently. Never imply that fixture counts, maintenance actions, rainfall, water depth or user reports are live official data.

## 9. Functional acceptance criteria

The overview MVP is acceptable when:

1. The correct JalDrishti asset and product wording are shown.
2. The light theme matches the supplied reference's information hierarchy without copying incorrect JalSaathi branding or unsupported metrics.
3. The main map displays configured pilot zones, incidents and a legible legend; selecting a marker updates the hotspot inspector.
4. The selected-hotspot panel displays risk, confidence/coverage, source freshness and the evidence behind the recommendation as separate concepts.
5. Clicking an action-queue row opens the matching detail.
6. An officer can change an incident state and the result persists.
7. An officer can record a maintenance action, then view it in the selected-zone maintenance timeline.
8. A deterministic later incident can trigger a possible-recurrence flag with linked evidence and an explicit rule explanation.
9. Suggested actions use clear verb labels and each action button performs its advertised function.
10. The rainfall/trend panel shows unit, source/time and observed/forecast/simulated status, or clearly states that a feed is unavailable.
11. Demo mode is globally visible when fixtures are being shown.
12. The historical replay and evaluation view shows its input scope, source-linked reports, coverage and limitations.
13. No card shows fabricated metrics as if they are live.
14. No unverified exact water-depth estimate is displayed.
15. Map attribution is visible and licensed data is used appropriately.
16. Demo reset restores the same expected state.
17. No critical button is inert, no broken asset paths exist, and the application has no obvious console/runtime errors.

## 10. Interaction details and button copy

Use precise action language:

- `Review report`
- `Mark verified`
- `Mark duplicate`
- `Request clearer location` (only if that WhatsApp flow is implemented)
- `Record maintenance action`
- `Escalate for engineering assessment`
- `Monitor hotspot`
- `Preview WhatsApp update`
- `Approve and send` (only for authorised/consented live sends)
- `Open event replay`
- `Reset demo`

Avoid generic or misleading buttons such as `Fix now`, `Predict flood`, `Build drain`, or `Send emergency alert` unless the relevant authorised capability truly exists.

Every menu, tab, filter, map toggle, row and CTA must either work or be explicitly presented as unavailable. Do not fake success to make the demo appear functional.

## 11. Security, privacy and access

- The dashboard is private and requires officer authentication; role support should distinguish Officer and Admin where implemented.
- Unauthenticated users must not access incident photos, precise report locations, contact details, maintenance logs or internal alerts.
- Store media privately; do not expose provider media URLs or public buckets.
- Remove photo EXIF metadata where possible.
- Keep personal contact data separate from incident analytics. Do not display raw phone numbers by default.
- Collect only necessary report data and implement a clear consent/opt-out message in the WhatsApp flow before real participant testing.
- Never use face recognition or identify vehicle owners.
- Keep secrets and provider tokens in environment variables; never hardcode or commit them.
- Demo mode must not accidentally send messages to real residents.

## 12. Accessibility and responsive behaviour

- Do not use colour alone to communicate risk or state; combine colour with text/icon and accessible labels.
- Keep table labels, numeric values, map controls and buttons readable at common desktop sizes.
- Provide visible keyboard focus states and semantic controls.
- Make panel tabs, row selection, filters and action forms keyboard-accessible.
- Use responsive layout: on smaller screens, stack map, inspector, queue and trend panel in a usable order. Avoid forcing a desktop table beyond the viewport; use horizontal scrolling or responsive row details.
- The light theme is the release baseline. Dark mode is deferred until the core light UI passes functional and contrast checks.

## 13. Technical implementation guidance

Respect the existing project stack. If implementing from the planned baseline, use:

- Frontend: React + Vite + TypeScript.
- Map: MapLibre GL JS using an authorised tile source and required attribution.
- Backend: FastAPI + Python.
- Database: PostgreSQL + PostGIS.
- Vision: a selected vision API, with constrained JSON output and human-review state.
- Analytics: transparent Python scoring/replay rules.

Do not re-platform the existing homepage or add unnecessary frameworks. If the dashboard frontend/backend already exists, inspect and extend it rather than generating a duplicate project.

API shape should follow the master PRD where present. Relevant routes include:

- `GET /api/zones`
- `GET /api/zones/{zone_id}/risk`
- `GET /api/incidents`
- `GET /api/incidents/{incident_id}`
- `PATCH /api/incidents/{incident_id}/state`
- `GET /api/action-queue`
- `POST /api/incidents/{incident_id}/actions`
- `GET /api/zones/{zone_id}/history`
- `POST /api/alerts/preview`
- `POST /api/alerts/{alert_id}/approve-send`
- `GET /api/analytics/replay/{event_id}`
- `POST /api/demo/replay/reset`

Adapt route names to the existing codebase if routes already exist, but preserve the underlying requirements: pagination/filtering, authenticated access, visible provenance, idempotent operations, and honest provider status.

## 14. Build priority

### MUST for the demo

- Light-theme overview with correct JalDrishti branding.
- Working GIS map and selected-hotspot inspector.
- Incident list/detail and status updates.
- Priority action queue with reasons.
- Maintenance log and recurrence-after-action flow.
- Relative zone-risk and source/data-status labels.
- Deterministic demo mode/reset.
- Historical replay and basic reproducible metrics.
- No fake live values or false success states.

### SHOULD if the core is stable

- Live WhatsApp webhook and real report intake.
- Risk-triggered alert preview and approved test send.
- Marathi/Hindi/English reviewed templates.
- Duplicate grouping, richer data freshness indicators and CSV/evidence export.

### COULD / defer

- Advanced resource-allocation what-if tool.
- Voice notes.
- Dark theme.
- Expanded city coverage.
- Advanced map layers that depend on unavailable data.

## 15. Implementation instructions for Antigravity

1. Inspect the current repository before editing.
2. Inspect the supplied light and dark dashboard references and the existing JalDrishti master PRD, if present in the repository.
3. Use the light reference for layout and the actual JalDrishti logo asset for branding.
4. Reconcile UI labels, buttons, numbers and features with this document. Do not copy unsupported “live” metrics from the screenshots.
5. Build a functioning application, not a static screenshot.
6. Reuse existing code, dependencies, components and design tokens where sensible.
7. Keep the public homepage and its hero/storytelling animations untouched.
8. Implement deterministic demo data and persistent `DEMO MODE` labelling wherever fixture data appears.
9. Run the app, exercise the main workflows and fix runtime/layout errors.
10. At completion, report the files changed, working routes/views, implemented workflows, which integrations are live versus simulated, and any remaining blockers.

**Definition of done:** an officer can open an incident, understand why it is prioritised, record a maintenance action, observe a subsequent recurrence flag in a controlled scenario, and inspect the supporting evidence—all in a professional light-theme dashboard consistent with JalDrishti's brand.
