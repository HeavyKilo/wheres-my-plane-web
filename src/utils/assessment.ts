import type { Assessment, FlightRecord } from '../types';

const severeWeather = new Set(['Blizzard', 'Heavy Snow', 'Thunderstorms']);
const cautionWeather = new Set(['Fog', 'Rain', 'Gusty Winds', 'Light Snow', 'Overcast']);
const problematicInbound = new Set(['Delayed', 'Taxiing']);
const positiveInbound = new Set(['Landed', 'On Time']);
const constrainedGate = new Set(['Maintenance', 'Occupied', 'Unassigned']);
const constrainedCrew = new Set(['Rest Period', 'Standby', 'In Transit']);

export function buildAssessment(flight: FlightRecord): Assessment {
  let riskScore = 0;
  const recommendationDrivers: string[] = [];

  // Assumption: this first-pass "AI" score is intentionally heuristic. It treats each
  // operational signal as an additive indicator rather than trying to model causality.
  if (problematicInbound.has(flight.inbound_status)) {
    riskScore += 2;
    recommendationDrivers.push(`inbound is ${flight.inbound_status.toLowerCase()}`);
  }

  if (flight.inbound_status === 'En Route') {
    riskScore += 1;
    recommendationDrivers.push('aircraft is still inbound');
  }

  if (severeWeather.has(flight.weather_status)) {
    riskScore += 3;
    recommendationDrivers.push(`weather is ${flight.weather_status.toLowerCase()}`);
  }

  if (cautionWeather.has(flight.weather_status)) {
    riskScore += 1;
    recommendationDrivers.push(`weather requires monitoring (${flight.weather_status.toLowerCase()})`);
  }

  if (constrainedGate.has(flight.gate_status)) {
    riskScore += 2;
    recommendationDrivers.push(`gate is ${flight.gate_status.toLowerCase()}`);
  }

  if (constrainedCrew.has(flight.crew_status)) {
    riskScore += 2;
    recommendationDrivers.push(`crew is ${flight.crew_status.toLowerCase()}`);
  }

  if (flight.delay_reason !== 'None') riskScore += 1;

  if (flight.turnaround_time_minutes >= 90) {
    riskScore += 2;
    recommendationDrivers.push(`turnaround is stretched (${flight.turnaround_time_minutes} min)`);
  }

  if (flight.turnaround_time_minutes >= 60 && flight.turnaround_time_minutes < 90) {
    riskScore += 1;
    recommendationDrivers.push(`turnaround is tight (${flight.turnaround_time_minutes} min)`);
  }

  if (flight.passenger_load_factor >= 0.9) riskScore += 1;

  const operational_risk_level =
    riskScore >= 8 ? 'High' : riskScore >= 4 ? 'Moderate' : 'Low';

  // Assumption: status copy stays generic enough for leadership review and should not
  // imply certainty beyond the source CSV fields.
  const aircraft_status = positiveInbound.has(flight.inbound_status)
    ? `Aircraft flow is stable. Inbound ${flight.inbound_flight_number} is ${flight.inbound_status.toLowerCase()}.`
    : `Aircraft flow needs attention. Inbound ${flight.inbound_flight_number} is ${flight.inbound_status.toLowerCase()}.`;

  const turnaround_assessment =
    flight.turnaround_time_minutes >= 90
      ? `Turnaround buffer is stretched at ${flight.turnaround_time_minutes} minutes.`
      : flight.turnaround_time_minutes >= 60
        ? `Turnaround is workable but should be watched at ${flight.turnaround_time_minutes} minutes.`
        : `Turnaround is within a normal operating window at ${flight.turnaround_time_minutes} minutes.`;

  const readiness_summary =
    operational_risk_level === 'High'
      ? `Flight ${flight.flight_number} is not fully stabilized for departure readiness. Gate, crew, or inbound constraints are likely to impact execution.`
      : operational_risk_level === 'Moderate'
        ? `Flight ${flight.flight_number} is generally on track, but one or more operational dependencies need active monitoring.`
        : `Flight ${flight.flight_number} is in a healthy operating posture with no major readiness blockers identified.`;

  const passenger_message =
    operational_risk_level === 'High'
      ? 'We are working through an operational issue affecting your flight and will share the next update shortly.'
      : operational_risk_level === 'Moderate'
        ? 'Your flight remains planned, and our team is monitoring a minor operational dependency.'
        : 'Your flight is progressing as planned. Boarding and departure remain on track.';

  const primaryDriver =
    recommendationDrivers[0] ??
    'current operating conditions remain within a normal window';

  // Assumption: the proactive recommendation is the primary operator output and should
  // resolve to one of three clear actions for low, moderate, and high risk flights.
  const proactive_recommendation =
    operational_risk_level === 'High'
      ? `Trigger proactive customer communication and operational escalation. Primary driver: ${primaryDriver}.`
      : operational_risk_level === 'Moderate'
        ? `Alert gate team and monitor. Primary driver: ${primaryDriver}.`
        : `Proceed as planned. Primary driver: ${primaryDriver}.`;

  const escalation_needed = operational_risk_level === 'High' ? 'Yes' : 'No';

  return {
    aircraft_status,
    turnaround_assessment,
    operational_risk_level,
    readiness_summary,
    passenger_message,
    proactive_recommendation,
    escalation_needed,
  };
}
