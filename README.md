# Where's My Plane?

`Where's My Plane?` is a React + TypeScript + Vite demo for internal airline operations review.

It reads local flight data from `wheres_my_plane_dataset.csv`, lets the user select from multiple flights, and generates a rule-based AI-style operational assessment with a prominent ops recommendation.

## Features

- flight selector backed by a local CSV dataset
- selected-flight briefing for route, departure, and inbound status
- operational snapshot for aircraft location, turnaround timing, weather, and gate status
- rule-based AI assessment with:
  - `aircraft_status`
  - `turnaround_assessment`
  - `operational_risk_level`
  - `readiness_summary`
  - `passenger_message`
  - `proactive_recommendation`
  - `escalation_needed`

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

## Setup

Prerequisites:

- Node.js 18+ recommended
- npm

Install dependencies:

```bash
npm install
```

## Run Locally

Start the Vite dev server:

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

## Data Source

The app uses the local file:

```text
wheres_my_plane_dataset.csv
```

The CSV is parsed in `src/utils/csv.ts`, validated and converted in `src/utils/flights.ts`, and rendered in the UI through `src/App.tsx`.

## Notes

- The AI assessment is rule-based only. No external API is used.
- Assumptions about dataset shape and risk logic are documented in code comments.
- The app has been verified with `npm run build`.
