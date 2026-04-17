import { useEffect, useMemo, useState } from 'react';
import csvUrl from '../wheres_my_plane_dataset.csv?url';
import { flightCsvColumns, type FlightRecord } from './types';
import { buildAssessment } from './utils/assessment';
import { parseCsv } from './utils/csv';
import { demoFlights } from './utils/demoData';
import { toFlightRecord, validateFlightCsvColumns } from './utils/flights';

function formatLoadFactor(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatDateTime(value: string) {
  const parsed = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-CA', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
}

function formatTime(value: string) {
  const parsed = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-CA', {
    hour: 'numeric',
    minute: '2-digit',
  }).format(parsed);
}

function parseOpsDate(value: string) {
  const parsed = new Date(value.replace(' ', 'T'));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatCoordinates(latitude: number, longitude: number) {
  return `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
}

function formatCoordinateLabel(value: number, positiveLabel: string, negativeLabel: string) {
  const direction = value >= 0 ? positiveLabel : negativeLabel;
  return `${Math.abs(value).toFixed(2)} deg ${direction}`;
}

function FieldOriginTag({
  tone,
  label,
}: {
  tone: 'live' | 'estimated' | 'simulated';
  label: string;
}) {
  return <span className={`field-origin field-origin-${tone}`}>{label}</span>;
}

function getInboundTrackingSteps(flight: FlightRecord) {
  const inboundStatus = flight.flight_status || flight.inbound_status;
  const landedStatuses = new Set(['Landed']);
  const approachingStatuses = new Set(['Taxiing']);
  const gateReadyStatuses = new Set(['Assigned', 'Open']);
  const crewReadyStatuses = new Set(['Ready', 'On Duty']);

  return [
    {
      label: 'Inbound airborne',
      state:
        inboundStatus === 'En Route' || inboundStatus === 'On Time' || inboundStatus === 'Delayed'
          ? 'active'
          : landedStatuses.has(inboundStatus) || approachingStatuses.has(inboundStatus)
            ? 'complete'
            : 'pending',
    },
    {
      label: 'Landed',
      state:
        landedStatuses.has(inboundStatus) || approachingStatuses.has(inboundStatus)
          ? 'complete'
          : 'pending',
    },
    {
      label: 'At gate',
      state:
        landedStatuses.has(inboundStatus) && gateReadyStatuses.has(flight.gate_status)
          ? 'complete'
          : flight.gate_status === 'Maintenance' || flight.gate_status === 'Unassigned'
            ? 'blocked'
            : approachingStatuses.has(inboundStatus) || landedStatuses.has(inboundStatus)
              ? 'active'
              : 'pending',
    },
    {
      label: 'Boarding readiness',
      state:
        gateReadyStatuses.has(flight.gate_status) && crewReadyStatuses.has(flight.crew_status)
          ? 'complete'
          : flight.crew_status === 'Rest Period' || flight.gate_status === 'Maintenance'
            ? 'blocked'
            : 'active',
    },
  ] as const;
}

function buildStatusChips(flight: FlightRecord) {
  const chips: Array<{ label: string; tone: 'neutral' | 'warn' | 'alert' | 'good'; icon: string }> = [];
  const scheduledDeparture = parseOpsDate(flight.scheduled_departure);
  const estimatedReady = parseOpsDate(flight.estimated_ready_time);
  const readyBufferMinutes =
    scheduledDeparture && estimatedReady
      ? Math.round((scheduledDeparture.getTime() - estimatedReady.getTime()) / 60000)
      : null;

  if (flight.flight_status === 'On Time') {
    chips.push({ label: 'On Time', tone: 'good', icon: 'OK' });
  }

  if (flight.flight_status === 'Landed') {
    chips.push({ label: 'Inbound Landed', tone: 'good', icon: 'LD' });
  }

  // Threshold assumption:
  // - <= 0 min means the aircraft is not projected ready by scheduled departure
  // - <= 15 min means ops has very little recovery margin before departure
  if (readyBufferMinutes !== null && readyBufferMinutes <= 15) {
    chips.push({
      label: 'Tight Turnaround',
      tone: readyBufferMinutes <= 0 ? 'alert' : 'warn',
      icon: 'TT',
    });
  }

  // Threshold assumption:
  // - Blizzard, heavy snow, and thunderstorms are treated as severe operating conditions
  // - Fog, rain, gusty winds, light snow, and overcast stay in monitoring/watch mode
  if (['Blizzard', 'Heavy Snow', 'Thunderstorms'].includes(flight.weather_status)) {
    chips.push({
      label: 'Severe Weather',
      tone: 'alert',
      icon: 'WX',
    });
  }

  if (['Fog', 'Rain', 'Gusty Winds', 'Light Snow', 'Overcast'].includes(flight.weather_status)) {
    chips.push({ label: 'Weather Watch', tone: 'warn', icon: 'WX' });
  }

  // Threshold assumption:
  // - Maintenance is an immediate blocking gate issue
  // - Unassigned or occupied gates are cautionary constraints that still need active coordination
  if (flight.gate_status === 'Maintenance') {
    chips.push({ label: 'Gate Maintenance', tone: 'alert', icon: 'GT' });
  } else if (flight.gate_status === 'Unassigned') {
    chips.push({ label: 'Gate Pending', tone: 'warn', icon: 'GT' });
  } else if (flight.gate_status === 'Occupied') {
    chips.push({ label: 'Gate Occupied', tone: 'warn', icon: 'GT' });
  }

  // Threshold assumption:
  // - Rest Period is a harder constraint because the operating crew is not yet legal/available
  // - Standby and In Transit indicate recoverable but active crew coordination is still required
  if (flight.crew_status === 'Rest Period') {
    chips.push({ label: 'Crew Rest Constraint', tone: 'alert', icon: 'CR' });
  } else if (flight.crew_status === 'Standby') {
    chips.push({ label: 'Crew Standby', tone: 'warn', icon: 'CR' });
  } else if (flight.crew_status === 'In Transit') {
    chips.push({ label: 'Crew Positioning', tone: 'warn', icon: 'CR' });
  }

  return chips;
}

function getRequestedFlightFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('flight') ?? '';
}

function setFlightInUrl(flightNumber: string) {
  const url = new URL(window.location.href);
  if (flightNumber) {
    url.searchParams.set('flight', flightNumber);
  } else {
    url.searchParams.delete('flight');
  }

  window.history.replaceState({}, '', url);
}

function selectInitialFlight(flights: FlightRecord[], requestedFlightNumber: string) {
  if (!flights.length) {
    return '';
  }

  return (
    flights.find((flight) => flight.flight_number === requestedFlightNumber)?.flight_number ??
    flights[0].flight_number
  );
}

function getRiskPriority(level: 'Low' | 'Moderate' | 'High') {
  if (level === 'High') return 0;
  if (level === 'Moderate') return 1;
  return 2;
}

type AppMode = 'demo' | 'live';
type DataSource = 'csv' | 'fallback' | 'live';

function App() {
  const [flights, setFlights] = useState<FlightRecord[]>([]);
  const [selectedFlightNumber, setSelectedFlightNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');
  const [dataSource, setDataSource] = useState<DataSource>('csv');
  const [mode, setMode] = useState<AppMode>('demo');
  const [modeMessage, setModeMessage] = useState('');

  function markUpdatedNow() {
    setLastUpdated(
      new Intl.DateTimeFormat('en-CA', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(new Date()),
    );
  }

  useEffect(() => {
    async function loadDemoFlights(preferredFlightNumber = '') {
      try {
        const response = await fetch(csvUrl);
        if (!response.ok) {
          throw new Error(`Received HTTP ${response.status} while loading the dataset.`);
        }

        const text = await response.text();
        const parsedCsv = parseCsv(text);
        const headers = Object.keys(parsedCsv[0] ?? {});
        const columnValidation = validateFlightCsvColumns(headers);

        if (!columnValidation.isValid) {
          throw new Error(
            `Missing required columns: ${columnValidation.missingColumns.join(', ')}.`,
          );
        }

        const parsed = parsedCsv.map(toFlightRecord);
        if (parsed.length === 0) {
          throw new Error('The dataset loaded but did not contain any flight rows.');
        }

        setFlights(parsed);
        setSelectedFlightNumber(selectInitialFlight(parsed, preferredFlightNumber));
        setDataSource('csv');
        setError('');
        setModeMessage('Demo Mode active. Using local CSV data.');
        markUpdatedNow();
      } catch (loadError) {
        setFlights(demoFlights);
        setSelectedFlightNumber(selectInitialFlight(demoFlights, preferredFlightNumber));
        setDataSource('fallback');
        setError(
          [
            'Unable to load local flight data from wheres_my_plane_dataset.csv.',
            loadError instanceof Error ? loadError.message : 'Unknown load error.',
          ].join(' '),
        );
        setModeMessage('Demo Mode active. CSV unavailable, using fallback sample data.');
        markUpdatedNow();
      }
    }

    async function loadFlights() {
      const requestedFlightNumber = getRequestedFlightFromUrl();
      await loadDemoFlights(requestedFlightNumber);
      setLoading(false);
    }

    void loadFlights();
  }, []);

  async function switchMode(nextMode: AppMode) {
    if (nextMode === mode && flights.length > 0) {
      return;
    }

    setLoading(true);
    setModeMessage('');
    const requestedFlightNumber = selectedFlightNumber || getRequestedFlightFromUrl();

    async function loadDemoMode() {
      await (async () => {
        try {
          const response = await fetch(csvUrl);
          if (!response.ok) {
            throw new Error(`Received HTTP ${response.status} while loading the dataset.`);
          }

          const text = await response.text();
          const parsedCsv = parseCsv(text);
          const headers = Object.keys(parsedCsv[0] ?? {});
          const columnValidation = validateFlightCsvColumns(headers);

          if (!columnValidation.isValid) {
            throw new Error(
              `Missing required columns: ${columnValidation.missingColumns.join(', ')}.`,
            );
          }

          const parsed = parsedCsv.map(toFlightRecord);
          if (parsed.length === 0) {
            throw new Error('The dataset loaded but did not contain any flight rows.');
          }

          setFlights(parsed);
          setSelectedFlightNumber(selectInitialFlight(parsed, requestedFlightNumber));
          setDataSource('csv');
          setError('');
          setMode('demo');
          setModeMessage('Demo Mode active. Using local CSV data.');
          markUpdatedNow();
        } catch (loadError) {
          setFlights(demoFlights);
          setSelectedFlightNumber(selectInitialFlight(demoFlights, requestedFlightNumber));
          setDataSource('fallback');
          setError(
            [
              'Unable to load local flight data from wheres_my_plane_dataset.csv.',
              loadError instanceof Error ? loadError.message : 'Unknown load error.',
            ].join(' '),
          );
          setMode('demo');
          setModeMessage('Demo Mode active. CSV unavailable, using fallback sample data.');
          markUpdatedNow();
        }
      })();
    }

    async function loadLiveMode() {
      try {
        const response = await fetch('/api/live-flights');
        if (!response.ok) {
          throw new Error(`Live data endpoint returned HTTP ${response.status}.`);
        }

        const payload = await response.json();
        if (!payload.ok || !Array.isArray(payload.flights) || payload.flights.length === 0) {
          throw new Error(payload.message || 'Live data endpoint did not return any flights.');
        }

        const liveFlights = payload.flights as FlightRecord[];
        setFlights(liveFlights);
        setSelectedFlightNumber(selectInitialFlight(liveFlights, requestedFlightNumber));
        setDataSource('live');
        setError('');
        setMode('live');
        setModeMessage('Live Mode active. Using Aviationstack-backed API data.');
        markUpdatedNow();
      } catch (loadError) {
        await loadDemoMode();
        setError(
          [
            'Live Mode could not be enabled.',
            loadError instanceof Error ? loadError.message : 'Unknown live data error.',
          ].join(' '),
        );
        setModeMessage('Live Mode unavailable. Reverted to Demo Mode.');
      } finally {
        setLoading(false);
      }
    }

    if (nextMode === 'live') {
      await loadLiveMode();
      return;
    }

    await loadDemoMode();
    setLoading(false);
  }

  useEffect(() => {
    setFlightInUrl(selectedFlightNumber);
  }, [selectedFlightNumber]);

  const selectedFlight =
    flights.find((flight) => flight.flight_number === selectedFlightNumber) ?? flights[0];

  const assessment = useMemo(
    () => (selectedFlight ? buildAssessment(selectedFlight) : null),
    [selectedFlight],
  );

  const summary = useMemo(() => {
    const delayedInboundCount = flights.filter((flight) =>
      ['Delayed', 'Taxiing'].includes(flight.inbound_status),
    ).length;

    const highRiskCount = flights.filter((flight) => {
      const flightAssessment = buildAssessment(flight);
      return flightAssessment.operational_risk_level === 'High';
    }).length;

    return {
      totalFlights: flights.length,
      delayedInboundCount,
      highRiskCount,
    };
  }, [flights]);

  const statusChips = selectedFlight ? buildStatusChips(selectedFlight) : [];
  const trackingSteps = selectedFlight ? getInboundTrackingSteps(selectedFlight) : [];
  const flightQueue = useMemo(
    () =>
      flights.map((flight) => ({
        flight,
        assessment: buildAssessment(flight),
      })).sort((left, right) => {
        const riskComparison =
          getRiskPriority(left.assessment.operational_risk_level) -
          getRiskPriority(right.assessment.operational_risk_level);

        if (riskComparison !== 0) {
          return riskComparison;
        }

        const leftDeparture = parseOpsDate(left.flight.scheduled_departure)?.getTime() ?? Number.MAX_SAFE_INTEGER;
        const rightDeparture =
          parseOpsDate(right.flight.scheduled_departure)?.getTime() ?? Number.MAX_SAFE_INTEGER;

        return leftDeparture - rightDeparture;
      }),
    [flights],
  );

  const requiredColumnsText = flightCsvColumns.join(', ');

  return (
    <div className="app-shell">
      <header className="header-bar">
        <div className="header-copy">
          <p className="eyebrow">Internal airline operations demo</p>
          <div className="header-title-row">
            <h1>Where&apos;s My Plane?</h1>
            <span className="header-badge">Ops Control</span>
          </div>
          <p className="subtitle">
            Flight readiness and aircraft visibility for ops teams and leadership, built from a
            local CSV and rule-based AI assessment.
          </p>
        </div>

        <section className="summary-strip" aria-label="Operational summary">
          <article className="summary-card">
            <span className="summary-label">Flights in dataset</span>
            <strong>{summary.totalFlights}</strong>
          </article>
          <article className="summary-card">
            <span className="summary-label">Inbound constraints</span>
            <strong>{summary.delayedInboundCount}</strong>
          </article>
          <article className="summary-card">
            <span className="summary-label">High-risk flights</span>
            <strong>{summary.highRiskCount}</strong>
          </article>
        </section>
      </header>

      <main className="content-grid">
        {loading && (
          <section className="panel loading-panel" aria-live="polite">
            <div className="loading-copy">
              <span className="loading-badge">Loading operations view</span>
              <h2>Preparing flight readiness dashboard</h2>
              <p>
                Loading flight records, calculating risk signals, and preparing the ops queue.
              </p>
            </div>
            <div className="loading-grid" aria-hidden="true">
              <div className="loading-block loading-block-wide" />
              <div className="loading-block" />
              <div className="loading-block" />
              <div className="loading-block" />
            </div>
          </section>
        )}

        <section className="panel controls-panel">
          <div className="control-row">
            <div>
              <label className="field-label" htmlFor="flight-selector">
                Select flight
              </label>
              <p className="field-help">
                Choose a flight from the local dataset to review readiness, aircraft flow, and the
                recommended ops action.
              </p>
            </div>
            <span className="badge">{mode === 'live' ? 'Live Mode' : 'Demo Mode'}</span>
          </div>

          <div className="mode-toggle" role="tablist" aria-label="Data mode">
            <button
              type="button"
              className={mode === 'demo' ? 'mode-button active-mode' : 'mode-button'}
              onClick={() => void switchMode('demo')}
            >
              Demo Mode
            </button>
            <button
              type="button"
              className={mode === 'live' ? 'mode-button active-mode' : 'mode-button'}
              onClick={() => void switchMode('live')}
            >
              Live Mode
            </button>
          </div>

          {!loading && modeMessage && <p className="mode-message">{modeMessage}</p>}

          <select
            id="flight-selector"
            className="flight-select"
            value={selectedFlightNumber}
            onChange={(event) => setSelectedFlightNumber(event.target.value)}
            disabled={loading || flights.length === 0}
          >
            {flights.map((flight) => (
              <option key={flight.flight_number} value={flight.flight_number}>
                {flight.flight_number} | {flight.origin} to {flight.destination}
              </option>
            ))}
          </select>

          <div className="dataset-meta">
            <span>{flights.length} flights loaded</span>
            <span>{flightCsvColumns.length} mapped CSV columns</span>
            <span>
              Active mode: {mode === 'live' ? 'Live Mode' : 'Demo Mode'}
            </span>
            <span>
              Source:{' '}
              {dataSource === 'live'
                ? 'Live flights API'
                : dataSource === 'csv'
                  ? 'Local CSV'
                  : 'Fallback sample data'}
            </span>
          </div>

          {!loading && dataSource === 'fallback' && (
            <section className="load-issue-panel" aria-live="polite">
              <h3>CSV load issue</h3>
              <p>{error}</p>
              <p>
                Expected file:
                <code> wheres_my_plane_dataset.csv</code>
              </p>
              <p>
                Required columns:
                <code> {requiredColumnsText}</code>
              </p>
              <p>Fallback demo data is active so the app still renders for review.</p>
            </section>
          )}

          {!loading && mode === 'demo' && dataSource === 'csv' && !error && (
            <section className="mode-info-panel">
              <p>
                Demo Mode is active. The app is using local CSV data to preserve a stable demo
                experience.
              </p>
            </section>
          )}
        </section>

        {!loading && !selectedFlight && (
          <section className="panel empty-state-panel">
            <span className="empty-state-badge">No flight selected</span>
            <h2>No flight is available to display</h2>
            <p>
              The dashboard needs at least one flight record to render the ops console. Confirm the
              expected dataset file is present or use the fallback demo data.
            </p>
          </section>
        )}

        {!loading && selectedFlight && assessment && (
          <>
            <section className="alert-banner">
              <div className="alert-main">
                <span className="alert-label">Ops alert</span>
                <div className="alert-title-row">
                  <strong>{selectedFlight.flight_number}</strong>
                  <span
                    className={`risk-pill risk-${assessment.operational_risk_level.toLowerCase()}`}
                  >
                    <span className="risk-dot" />
                    {assessment.operational_risk_level} risk
                  </span>
                </div>
                <p className="alert-recommendation">{assessment.proactive_recommendation}</p>
              </div>

              <div className="alert-side">
                <span
                  className={`escalation-flag escalation-${assessment.escalation_needed.toLowerCase()}`}
                >
                  {assessment.escalation_needed === 'Yes' ? 'Escalation required' : 'No escalation'}
                </span>
              </div>
            </section>

            <section className="panel top-summary-bar">
              <div className="summary-bar-main">
                <div className="summary-item summary-primary">
                  <span className="summary-key">Flight</span>
                  <strong>{selectedFlight.flight_number}</strong>
                </div>
                <div className="summary-item">
                  <span className="summary-key">Route</span>
                  <strong>
                    {selectedFlight.origin} to {selectedFlight.destination}
                  </strong>
                </div>
                <div className="summary-item">
                  <span className="summary-key">Scheduled departure</span>
                  <strong>{formatDateTime(selectedFlight.scheduled_departure)}</strong>
                </div>
                <div className="summary-item">
                  <span className="summary-key">Flight status</span>
                  <strong>{selectedFlight.flight_status}</strong>
                </div>
              </div>

              <div className="summary-bar-side">
                <span className={`risk-pill risk-${assessment.operational_risk_level.toLowerCase()}`}>
                  <span className="risk-dot" />
                  {assessment.operational_risk_level} risk
                </span>
                <span className="last-updated">Updated {lastUpdated}</span>
              </div>
            </section>

            <section className="chips-row" aria-label="Operational status chips">
              {statusChips.map((chip) => (
                <span key={chip.label} className={`status-chip chip-${chip.tone}`}>
                  <span className="chip-icon">{chip.icon}</span>
                  {chip.label}
                </span>
              ))}
            </section>

            <section className="product-layout">
              <section className="panel panel-column details-column">
                <div className="panel-heading">
                  <h2>Flight Details</h2>
                  <span className="badge">Station view</span>
                </div>

                <article className="detail-card">
                  <h3>Gate and Turnaround</h3>
                  <div className="field-origin-row">
                    <FieldOriginTag tone="simulated" label="Simulated ops fields" />
                  </div>
                  <dl className="info-list">
                    <div>
                      <dt>Gate status</dt>
                      <dd>{selectedFlight.gate_status}</dd>
                    </div>
                    <div>
                      <dt>Turnaround time</dt>
                      <dd>{selectedFlight.turnaround_time_minutes} min</dd>
                    </div>
                    <div>
                      <dt>Boarding start</dt>
                      <dd>{formatTime(selectedFlight.estimated_boarding_start)}</dd>
                    </div>
                    <div>
                      <dt>Estimated ready</dt>
                      <dd>{formatTime(selectedFlight.estimated_ready_time)}</dd>
                    </div>
                  </dl>
                </article>

                <article className="detail-card">
                  <h3>Weather and Crew</h3>
                  <div className="field-origin-row">
                    <FieldOriginTag tone="simulated" label="Simulated ops fields" />
                  </div>
                  <dl className="info-list">
                    <div>
                      <dt>Weather</dt>
                      <dd>{selectedFlight.weather_status}</dd>
                    </div>
                    <div>
                      <dt>Crew status</dt>
                      <dd>{selectedFlight.crew_status}</dd>
                    </div>
                    <div>
                      <dt>Delay reason</dt>
                      <dd>{selectedFlight.delay_reason}</dd>
                    </div>
                    <div>
                      <dt>Load factor</dt>
                      <dd>{formatLoadFactor(selectedFlight.passenger_load_factor)}</dd>
                    </div>
                  </dl>
                </article>
              </section>

              <section className="panel panel-column status-column">
                <div className="panel-heading">
                  <h2>Aircraft Status</h2>
                  <span className="badge">Inbound tracking</span>
                </div>

                <article className="tracking-hero">
                  <div className="tracking-primary">
                    <div>
                      <div className="labeled-heading">
                        <p className="recommendation-label">Inbound ETA</p>
                        <FieldOriginTag tone="estimated" label="Estimated" />
                      </div>
                      <h3>{formatDateTime(selectedFlight.inbound_estimated_arrival)}</h3>
                    </div>
                    <div>
                      <div className="labeled-heading">
                        <p className="recommendation-label">Ready at station</p>
                        <FieldOriginTag tone="simulated" label="Simulated" />
                      </div>
                      <h3>{formatDateTime(selectedFlight.estimated_ready_time)}</h3>
                    </div>
                  </div>
                  <p className="tracking-summary">{assessment.aircraft_status}</p>
                  <p className="tracking-route">
                    Inbound {selectedFlight.inbound_flight_number} from {selectedFlight.inbound_origin}
                  </p>
                </article>

                <article className="tracking-panel">
                  <div className="panel-heading panel-heading-tight">
                    <div>
                      <p className="recommendation-label">Inbound readiness</p>
                      <h3>Aircraft movement timeline</h3>
                    </div>
                    <FieldOriginTag tone="live" label="Live flight state" />
                  </div>

                  <ol className="tracking-steps">
                    {trackingSteps.map((step) => (
                      <li key={step.label} className={`tracking-step step-${step.state}`}>
                        <span className="step-dot" aria-hidden="true" />
                        <div className="step-copy">
                          <strong>{step.label}</strong>
                          <span className="step-state">{step.state}</span>
                        </div>
                      </li>
                    ))}
                  </ol>

                  <div className="route-strip">
                    <div className="route-stop">
                      <span className="route-code">{selectedFlight.inbound_origin}</span>
                      <span className="route-role">Inbound origin</span>
                    </div>
                    <div className="route-path" aria-hidden="true">
                      <span className="route-line" />
                      <span className="route-plane">&#9992;</span>
                    </div>
                    <div className="route-stop route-stop-arrival">
                      <span className="route-code">{selectedFlight.origin}</span>
                      <span className="route-role">Departure station</span>
                    </div>
                  </div>

                  <dl className="location-stats support-stats">
                    <div>
                      <dt>Latitude</dt>
                      <dd>
                        {formatCoordinateLabel(selectedFlight.aircraft_latitude, 'N', 'S')}
                      </dd>
                    </div>
                    <div>
                      <dt>Longitude</dt>
                      <dd>
                        {formatCoordinateLabel(selectedFlight.aircraft_longitude, 'E', 'W')}
                      </dd>
                    </div>
                    <div>
                      <dt>Inbound flight</dt>
                      <dd>{selectedFlight.inbound_flight_number}</dd>
                    </div>
                    <div>
                      <dt>Inbound ETA</dt>
                      <dd>{formatTime(selectedFlight.inbound_estimated_arrival)}</dd>
                    </div>
                  </dl>
                </article>
              </section>

              <section className="panel panel-column assessment-panel">
                <div className="panel-heading">
                  <h2>AI Assessment</h2>
                  <span className="badge">Decision support</span>
                </div>

                <article
                  className={`recommendation-banner recommendation-${assessment.operational_risk_level.toLowerCase()}`}
                >
                  <div className="recommendation-head">
                    <div className="labeled-heading">
                      <p className="recommendation-label">Proactive recommendation</p>
                      <FieldOriginTag tone="simulated" label="Derived" />
                    </div>
                    <span className="recommendation-icon">!</span>
                  </div>
                  <h3>{assessment.proactive_recommendation}</h3>
                  <p className="recommendation-support">
                    Action this first for {selectedFlight.flight_number} before the next ops
                    checkpoint.
                  </p>
                </article>

                <article className="risk-highlight">
                  <div className="labeled-heading">
                    <p className="recommendation-label">Operational risk</p>
                    <FieldOriginTag tone="simulated" label="Derived" />
                  </div>
                  <strong>{assessment.operational_risk_level}</strong>
                  <p>{assessment.readiness_summary}</p>
                </article>

                <article className="assessment-card">
                  <p className="recommendation-label">Readiness summary</p>
                  <p className="assessment-emphasis">{assessment.readiness_summary}</p>
                </article>

                <article className="assessment-card compact-card">
                  <h3>Escalation Needed</h3>
                  <p>{assessment.escalation_needed}</p>
                </article>

                <article className="assessment-card compact-card">
                  <h3>Passenger Message</h3>
                  <p>{assessment.passenger_message}</p>
                </article>

                <article className="assessment-card compact-card">
                  <h3>Turnaround Assessment</h3>
                  <p>{assessment.turnaround_assessment}</p>
                </article>
              </section>
            </section>

            <section className="panel queue-panel">
              <div className="panel-heading">
                <h2>Operations Queue</h2>
                <span className="badge">All loaded flights</span>
              </div>

              <div className="queue-table-wrap">
                <table className="queue-table">
                  <thead>
                    <tr>
                      <th>Flight number</th>
                      <th>Route</th>
                      <th>Flight status</th>
                      <th>Operational risk</th>
                      <th>Turnaround assessment</th>
                      <th>Proactive recommendation</th>
                      <th>Escalation needed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {flightQueue.map(({ flight, assessment: queueAssessment }) => {
                      const isSelected = flight.flight_number === selectedFlight.flight_number;

                      return (
                        <tr
                          key={flight.flight_number}
                          className={isSelected ? 'queue-row selected-row' : 'queue-row'}
                          onClick={() => setSelectedFlightNumber(flight.flight_number)}
                        >
                          <td>
                            <button
                              type="button"
                              className="queue-select"
                              onClick={() => setSelectedFlightNumber(flight.flight_number)}
                            >
                              {flight.flight_number}
                            </button>
                          </td>
                          <td>
                            {flight.origin} to {flight.destination}
                          </td>
                          <td>{flight.flight_status}</td>
                          <td>
                            <span
                              className={`risk-pill risk-${queueAssessment.operational_risk_level.toLowerCase()}`}
                            >
                              <span className="risk-dot" />
                              {queueAssessment.operational_risk_level}
                            </span>
                          </td>
                          <td>{queueAssessment.turnaround_assessment}</td>
                          <td className="queue-recommendation">
                            {queueAssessment.proactive_recommendation}
                          </td>
                          <td>
                            <span
                              className={`queue-escalation escalation-${queueAssessment.escalation_needed.toLowerCase()}`}
                            >
                              {queueAssessment.escalation_needed}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
