import { useEffect, useMemo, useState } from 'react';
import csvUrl from '../wheres_my_plane_dataset.csv?url';
import { flightCsvColumns, type FlightRecord } from './types';
import { buildAssessment } from './utils/assessment';
import { parseCsv } from './utils/csv';
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

function formatCoordinates(latitude: number, longitude: number) {
  return `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
}

function buildStatusChips(flight: FlightRecord) {
  const chips: Array<{ label: string; tone: 'neutral' | 'warn' | 'alert' | 'good' }> = [];

  if (flight.inbound_status === 'On Time' || flight.inbound_status === 'Landed') {
    chips.push({ label: 'On Time', tone: 'good' });
  }

  if (flight.turnaround_time_minutes >= 60) {
    chips.push({ label: 'Tight Turnaround', tone: flight.turnaround_time_minutes >= 90 ? 'alert' : 'warn' });
  }

  if (['Fog', 'Rain', 'Gusty Winds', 'Light Snow', 'Overcast', 'Blizzard', 'Heavy Snow', 'Thunderstorms'].includes(flight.weather_status)) {
    chips.push({
      label: 'Weather Watch',
      tone: ['Blizzard', 'Heavy Snow', 'Thunderstorms'].includes(flight.weather_status) ? 'alert' : 'warn',
    });
  }

  if (['Maintenance', 'Occupied', 'Unassigned'].includes(flight.gate_status)) {
    chips.push({ label: 'Gate Conflict', tone: flight.gate_status === 'Maintenance' ? 'alert' : 'warn' });
  }

  if (['Rest Period', 'Standby', 'In Transit'].includes(flight.crew_status)) {
    chips.push({ label: 'Crew Risk', tone: flight.crew_status === 'Rest Period' ? 'alert' : 'warn' });
  }

  return chips;
}

function App() {
  const [flights, setFlights] = useState<FlightRecord[]>([]);
  const [selectedFlightNumber, setSelectedFlightNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState('');

  useEffect(() => {
    async function loadFlights() {
      try {
        const response = await fetch(csvUrl);
        const text = await response.text();
        const parsedCsv = parseCsv(text);
        const headers = Object.keys(parsedCsv[0] ?? {});
        const columnValidation = validateFlightCsvColumns(headers);

        if (!columnValidation.isValid) {
          throw new Error(`Missing CSV columns: ${columnValidation.missingColumns.join(', ')}`);
        }

        const parsed = parsedCsv.map(toFlightRecord);
        setFlights(parsed);
        setSelectedFlightNumber(parsed[0]?.flight_number ?? '');

        // Assumption: "last updated" reflects when the local CSV was loaded into the app,
        // not a separate operational telemetry timestamp from the dataset.
        setLastUpdated(
          new Intl.DateTimeFormat('en-CA', {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          }).format(new Date()),
        );
      } catch {
        setError('Unable to load local flight data.');
      } finally {
        setLoading(false);
      }
    }

    void loadFlights();
  }, []);

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

  return (
    <div className="app-shell">
      <header className="page-header">
        <div className="header-copy">
          <p className="eyebrow">Internal airline operations demo</p>
          <h1>Where&apos;s My Plane?</h1>
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
            <span className="badge">Rule-based AI mock</span>
          </div>

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
            <span>Source: wheres_my_plane_dataset.csv</span>
          </div>

          {loading && <p className="status-message">Loading flight data...</p>}
          {error && <p className="status-message error">{error}</p>}
        </section>

        {selectedFlight && assessment && (
          <>
            <section className="panel top-summary-bar">
              <div className="summary-bar-main">
                <div className="summary-item summary-primary">
                  <span className="summary-key">Flight number</span>
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
                  <span className="summary-key">Inbound status</span>
                  <strong>{selectedFlight.inbound_status}</strong>
                </div>
              </div>

              <div className="summary-bar-side">
                <span className={`risk-pill risk-${assessment.operational_risk_level.toLowerCase()}`}>
                  {assessment.operational_risk_level} risk
                </span>
                <span className="last-updated">Last updated {lastUpdated}</span>
              </div>
            </section>

            <section className="chips-row" aria-label="Operational status chips">
              {statusChips.map((chip) => (
                <span key={chip.label} className={`status-chip chip-${chip.tone}`}>
                  {chip.label}
                </span>
              ))}
            </section>

            <section className="product-layout">
              <section className="panel panel-column details-column">
                <div className="panel-heading">
                  <h2>Flight Details</h2>
                  <span className="badge">Ops detail</span>
                </div>

                <article className="detail-card">
                  <h3>Gate and Turnaround</h3>
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
                  <span className="badge">Location</span>
                </div>

                <article className="aircraft-hero">
                  <p className="recommendation-label">Aircraft flow</p>
                  <h3>{assessment.aircraft_status}</h3>
                  <p>
                    Inbound {selectedFlight.inbound_flight_number} from {selectedFlight.inbound_origin}
                  </p>
                  <p>Inbound ETA {formatDateTime(selectedFlight.inbound_estimated_arrival)}</p>
                </article>

                <article className="map-card">
                  <div className="map-header">
                    <div>
                      <p className="recommendation-label">Aircraft location</p>
                      <strong>{formatCoordinates(selectedFlight.aircraft_latitude, selectedFlight.aircraft_longitude)}</strong>
                    </div>
                    <span className="map-caption">Inbound tracking</span>
                  </div>
                  <div className="map-surface" aria-hidden="true">
                    <div className="map-grid" />
                    <div className="map-ring" />
                    <div className="plane-marker">
                      <span>&#9992;</span>
                    </div>
                  </div>
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
                  <p className="recommendation-label">Proactive recommendation</p>
                  <h3>{assessment.proactive_recommendation}</h3>
                </article>

                <article className="risk-highlight">
                  <p className="recommendation-label">Operational risk</p>
                  <strong>{assessment.operational_risk_level}</strong>
                  <p>{assessment.readiness_summary}</p>
                </article>

                <article className="assessment-card">
                  <h3>Escalation Needed</h3>
                  <p>{assessment.escalation_needed}</p>
                </article>

                <article className="assessment-card">
                  <h3>Passenger Message</h3>
                  <p>{assessment.passenger_message}</p>
                </article>

                <article className="assessment-card">
                  <h3>Turnaround Assessment</h3>
                  <p>{assessment.turnaround_assessment}</p>
                </article>
              </section>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
