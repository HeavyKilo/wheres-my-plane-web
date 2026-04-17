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

function formatCoordinates(latitude: number, longitude: number) {
  return `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
}

function App() {
  const [flights, setFlights] = useState<FlightRecord[]>([]);
  const [selectedFlightNumber, setSelectedFlightNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  return (
    <div className="app-shell">
      <header className="page-header">
        <div className="header-copy">
          <p className="eyebrow">Internal airline operations demo</p>
          <h1>Where&apos;s My Plane?</h1>
          <p className="subtitle">
            A simple operations view for flight readiness, inbound aircraft status, and a mock
            AI-style assessment built from local CSV signals.
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
                Choose a record from the local CSV to inspect aircraft readiness and next actions.
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
            <section className="panel flight-briefing">
              <div className="panel-heading">
                <h2>Selected Flight Briefing</h2>
                <span className={`risk-pill risk-${assessment.operational_risk_level.toLowerCase()}`}>
                  {assessment.operational_risk_level} risk
                </span>
              </div>

              <div className="briefing-grid">
                <article className="briefing-hero">
                  <p className="overview-label">Selected flight</p>
                  <h3>{selectedFlight.flight_number}</h3>
                  <p className="route">
                    {selectedFlight.origin} to {selectedFlight.destination}
                  </p>
                </article>

                <article className="briefing-metric">
                  <p className="overview-label">Scheduled departure</p>
                  <strong>{formatDateTime(selectedFlight.scheduled_departure)}</strong>
                </article>

                <article className="briefing-metric">
                  <p className="overview-label">Inbound status</p>
                  <strong>{selectedFlight.inbound_status}</strong>
                  <span>ETA {formatDateTime(selectedFlight.inbound_estimated_arrival)}</span>
                </article>
              </div>
            </section>

            <section className="dashboard-layout">
              <section className="panel ops-panel">
                <div className="panel-heading">
                  <h2>Operational Snapshot</h2>
                  <span className="badge">Live from local CSV</span>
                </div>

                <div className="ops-grid">
                  <article className="detail-card">
                    <h3>Aircraft Location</h3>
                    <p>Coordinates: {formatCoordinates(selectedFlight.aircraft_latitude, selectedFlight.aircraft_longitude)}</p>
                    <p>Inbound flight: {selectedFlight.inbound_flight_number}</p>
                    <p>Inbound origin: {selectedFlight.inbound_origin}</p>
                  </article>

                  <article className="detail-card">
                    <h3>Turnaround Timing</h3>
                    <p>Turnaround time: {selectedFlight.turnaround_time_minutes} min</p>
                    <p>Boarding start: {formatDateTime(selectedFlight.estimated_boarding_start)}</p>
                    <p>Estimated ready: {formatDateTime(selectedFlight.estimated_ready_time)}</p>
                  </article>

                  <article className="detail-card">
                    <h3>Weather</h3>
                    <p>Condition: {selectedFlight.weather_status}</p>
                    <p>Delay reason: {selectedFlight.delay_reason}</p>
                    <p>Load factor: {formatLoadFactor(selectedFlight.passenger_load_factor)}</p>
                  </article>

                  <article className="detail-card">
                    <h3>Gate Status</h3>
                    <p>Gate: {selectedFlight.gate_status}</p>
                    <p>Crew: {selectedFlight.crew_status}</p>
                    <p>Scheduled arrival: {formatDateTime(selectedFlight.scheduled_arrival)}</p>
                  </article>
                </div>
              </section>

              <section className="panel assessment-panel">
                <div className="panel-heading">
                  <h2>AI Assessment</h2>
                  <span className="badge">Local rules only</span>
                </div>

                <article
                  className={`recommendation-banner recommendation-${assessment.operational_risk_level.toLowerCase()}`}
                >
                  <div>
                    <p className="recommendation-label">Primary ops recommendation</p>
                    <h3>{assessment.proactive_recommendation}</h3>
                  </div>
                  <span
                    className={`risk-pill risk-${assessment.operational_risk_level.toLowerCase()}`}
                  >
                    {assessment.operational_risk_level} risk
                  </span>
                </article>

                <article className="risk-highlight">
                  <p className="recommendation-label">Operational risk level</p>
                  <strong>{assessment.operational_risk_level}</strong>
                  <p>{assessment.readiness_summary}</p>
                </article>

                <div className="assessment-grid">
                  <article className="assessment-card">
                    <h3>Aircraft Status</h3>
                    <p>{assessment.aircraft_status}</p>
                  </article>
                  <article className="assessment-card">
                    <h3>Turnaround Assessment</h3>
                    <p>{assessment.turnaround_assessment}</p>
                  </article>
                  <article className="assessment-card">
                    <h3>Passenger Message</h3>
                    <p>{assessment.passenger_message}</p>
                  </article>
                  <article className="assessment-card">
                    <h3>Escalation Needed</h3>
                    <p>{assessment.escalation_needed}</p>
                  </article>
                </div>
              </section>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

export default App;
