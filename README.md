# Where's My Plane?

`Where's My Plane?` is an internal airline operations demo that helps ops teams and leadership quickly understand inbound aircraft status, departure readiness, and the next recommended action for a flight.

It uses a local CSV dataset, a lightweight React + TypeScript UI, and simple rule-based assessment logic to simulate an ops console without any external API dependency.

## Live Demo

Placeholder URL:

```text
https://your-vercel-deployment-url.vercel.app
```

## Product Summary

This demo is designed to answer a simple operational question:

`Is this aircraft on track, and what should ops do next?`

The app combines flight details, inbound tracking, readiness indicators, and a rule-based AI-style recommendation into a single view that is easy to present and easy to scan.

## Screenshots

Add screenshots here before broader internal sharing.

- `[Screenshot Placeholder]` Top alert banner and selected-flight dashboard
- `[Screenshot Placeholder]` Aircraft status and readiness tracking panel
- `[Screenshot Placeholder]` Operations queue table across all flights

## Feature Highlights

- selected-flight operations console with alert banner and risk callout
- inbound aircraft tracking and station readiness timeline
- rule-based AI-style assessment with proactive recommendation
- operations queue table for all loaded flights
- local CSV workflow with fallback sample data for demo resilience
- no external API or backend required

## Demo Scenarios

- Review a low-risk flight and show how the dashboard supports a normal departure decision.
- Switch to a delayed or weather-impacted flight and walk through the proactive recommendation.
- Use the operations queue table to compare multiple flights and jump into the highest-risk item.
- Demonstrate the app’s fallback behavior if the CSV cannot be loaded.

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

## Data Source

The app expects:

```text
wheres_my_plane_dataset.csv
```

The CSV is parsed in `src/utils/csv.ts`, validated and converted in `src/utils/flights.ts`, and rendered through `src/App.tsx`.

If the CSV fails to load, the app falls back to demo-safe sample data so the interface still renders.
