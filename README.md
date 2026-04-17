# Where's My Plane?

`Where's My Plane?` is an internal airline operations demo for reviewing inbound aircraft status, departure readiness, operational risk, and the next recommended ops action for a flight.

It uses a local CSV dataset, a lightweight React + TypeScript UI, and simple rule-based logic to simulate an operations console without any external API dependency.

## Live Demo

```text
https://wheres-my-plane-web.vercel.app/
```

## Product Summary

This demo is designed to answer a practical ops question:

`Is this aircraft on track, and what should the ops team do next?`

The app combines:

- a selected-flight operations console
- inbound tracking and readiness timing
- a rule-based AI-style assessment
- an operations queue across all loaded flights

The result is a demo-friendly view for ops teams and leadership that is easy to scan and explain.

## Screenshots

Add screenshots here before broader internal sharing.

- `[Screenshot Placeholder]` Alert banner and selected-flight operations console
- `[Screenshot Placeholder]` Aircraft status and inbound readiness tracking panel
- `[Screenshot Placeholder]` Multi-flight operations queue table

## Feature Highlights

- selected-flight alert banner with operational risk and proactive recommendation
- Canadian-style airline ops dashboard layout with three main panels
- inbound aircraft readiness tracker with ETA, station readiness, and timeline
- rule-based AI-style assessment with:
  - `aircraft_status`
  - `turnaround_assessment`
  - `operational_risk_level`
  - `readiness_summary`
  - `passenger_message`
  - `proactive_recommendation`
  - `escalation_needed`
- operations queue table for all loaded flights
- local CSV workflow with fallback sample data for demo resilience
- polished loading, error, and empty states
- no backend and no external API required

## Demo Scenarios

- Review a lower-risk flight and show how the dashboard supports a normal departure decision.
- Switch to a delayed or weather-impacted flight and walk through the proactive recommendation.
- Use the operations queue to compare flights and jump directly into a higher-risk item.
- Demonstrate fallback demo mode if the CSV cannot be loaded.

## Known Limitations

- The AI assessment is rule-based and not predictive.
- Aircraft location is based only on dataset latitude and longitude fields.
- Timing logic is simplified for demo use and does not model full airline operational dependencies.
- The current version is single-user and local-data only.

## Future Enhancements

- connect to live operational data feeds instead of a local CSV
- replace rule-based logic with a stronger AI decision-support layer
- add richer filtering and sorting in the operations queue
- add airport or route-level views for broader disruption monitoring
- support scenario comparison and what-if planning for ops teams

## Tech Stack

- React 18
- TypeScript
- Vite

## Project Structure

```text
.
|-- index.html
|-- package.json
|-- package-lock.json
|-- README.md
|-- tsconfig.json
|-- vite.config.ts
|-- wheres_my_plane_dataset.csv
`-- src
    |-- App.tsx
    |-- main.tsx
    |-- styles.css
    |-- types.ts
    |-- vite-env.d.ts
    `-- utils
        |-- assessment.ts
        |-- csv.ts
        |-- demoData.ts
        `-- flights.ts
```

## Install

Prerequisites:

- Node.js 18+ recommended
- npm

Install dependencies:

```bash
npm install
```

## Run Locally

Start the Vite development server:

```bash
npm run dev
```

Then open the local URL shown in the terminal, typically:

```text
http://localhost:5173
```

## Build

Create a production build:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Deployment Notes For Vercel

Recommended Vercel settings:

- Framework Preset: `Vite`
- Build Command: `npm run build`
- Output Directory: `dist`
- Install Command: `npm install`

Notes:

- The app uses Vite asset handling for `wheres_my_plane_dataset.csv`, so the CSV is bundled into the production build and served from production asset paths correctly.
- No custom server is required.
- No environment variables are required for the current local-only version.

## Data Source And Resilience

The app expects:

```text
wheres_my_plane_dataset.csv
```

The CSV is parsed in `src/utils/csv.ts`, validated and converted in `src/utils/flights.ts`, and rendered through `src/App.tsx`.

If the CSV fails to load, the app:

- shows a clear load issue message
- explains the expected file and required columns
- falls back to demo-safe sample data from `src/utils/demoData.ts`

This keeps the interface usable for demos even when the source CSV is missing or malformed.

## Current Status

- live on Vercel
- builds cleanly with `npm run build`
- ready for internal sharing and walkthroughs
