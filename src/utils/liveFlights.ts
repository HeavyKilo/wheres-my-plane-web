import type { FlightRecord } from '../types';

function asArray<T>(value: T[] | undefined | null) {
  return Array.isArray(value) ? value : [];
}

function firstString(...values: unknown[]) {
  const match = values.find((value) => typeof value === 'string' && value.trim().length > 0);
  return typeof match === 'string' ? match.trim() : '';
}

function firstNumber(...values: unknown[]) {
  const match = values.find((value) => typeof value === 'number' && Number.isFinite(value));
  return typeof match === 'number' ? match : 0;
}

function formatDateTime(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  const year = parsed.getUTCFullYear();
  const month = `${parsed.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${parsed.getUTCDate()}`.padStart(2, '0');
  const hours = `${parsed.getUTCHours()}`.padStart(2, '0');
  const minutes = `${parsed.getUTCMinutes()}`.padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}`;
}

function minusMinutes(value: string, minutesToSubtract: number) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  parsed.setUTCMinutes(parsed.getUTCMinutes() - minutesToSubtract);
  return formatDateTime(parsed.toISOString());
}

function plusMinutes(value: string, minutesToAdd: number) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return '';
  }

  parsed.setUTCMinutes(parsed.getUTCMinutes() + minutesToAdd);
  return formatDateTime(parsed.toISOString());
}

function normalizeFlightStatus(rawStatus: string) {
  const normalized = rawStatus.toLowerCase();

  if (normalized.includes('land')) return 'Landed';
  if (normalized.includes('taxi')) return 'Taxiing';
  if (normalized.includes('delay')) return 'Delayed';
  if (normalized.includes('active') || normalized.includes('en-route') || normalized.includes('en route'))
    return 'En Route';
  if (normalized.includes('scheduled') || normalized.includes('on-time') || normalized.includes('on time'))
    return 'On Time';

  return rawStatus || 'Unknown';
}

function normalizeGateStatus(rawGate: string, rawTerminal: string) {
  if (rawGate || rawTerminal) {
    return 'Assigned';
  }

  return 'Unassigned';
}

// Assumption: third-party live flight providers usually return the current flight state,
// not turnaround-specific inbound aircraft dependencies. We synthesize the inbound fields
// to preserve compatibility with the existing FlightRecord-based UI until a richer ops feed exists.
function normalizeFlight(rawFlight: Record<string, any>): FlightRecord {
  const flightNumber = firstString(
    rawFlight.flight?.iata,
    rawFlight.flight_iata,
    rawFlight.flight?.number,
    rawFlight.identification?.number?.default,
    'LIVE000',
  );

  const origin = firstString(
    rawFlight.departure?.iata,
    rawFlight.departure?.icao,
    rawFlight.departure?.airport?.iata,
    rawFlight.departure_iata,
    'UNK',
  );

  const destination = firstString(
    rawFlight.arrival?.iata,
    rawFlight.arrival?.icao,
    rawFlight.arrival?.airport?.iata,
    rawFlight.arrival_iata,
    'UNK',
  );

  const scheduledDepartureRaw = firstString(
    rawFlight.departure?.scheduled,
    rawFlight.departure?.scheduledTime?.local,
    rawFlight.departure_scheduled,
  );

  const scheduledArrivalRaw = firstString(
    rawFlight.arrival?.scheduled,
    rawFlight.arrival?.scheduledTime?.local,
    rawFlight.arrival_scheduled,
  );

  const scheduledDeparture = formatDateTime(scheduledDepartureRaw) || '2025-03-15 12:00';
  const scheduledArrival =
    formatDateTime(scheduledArrivalRaw) || plusMinutes(new Date().toISOString(), 120) || '2025-03-15 14:00';

  const inboundStatus = normalizeFlightStatus(
    firstString(
      rawFlight.flight_status,
      rawFlight.status,
      rawFlight.live?.status,
      rawFlight.aircraft?.status,
      'Unknown',
    ),
  );

  const gate = firstString(rawFlight.departure?.gate, rawFlight.gate, rawFlight.departure?.gateNumber);
  const terminal = firstString(rawFlight.departure?.terminal, rawFlight.departure?.terminalNumber);

  return {
    // Live from Aviationstack-style flight identity and airport fields.
    flight_number: flightNumber,
    origin,
    destination,
    // Live flight status from the provider. This is the primary live movement state.
    flight_status: inboundStatus,
    // Live when the provider exposes the transponder hex address used for cross-provider matching.
    aircraft_icao24: firstString(
      rawFlight.aircraft?.icao24,
      rawFlight.aircraft_icao24,
      rawFlight.aircraft?.icao,
    ).toLowerCase(),
    scheduled_departure: scheduledDeparture,
    scheduled_arrival: scheduledArrival,

    // Synthetic for current UI compatibility:
    // this demo expects inbound-aircraft dependencies, but generic live flight feeds
    // usually expose only the current flight rather than the previous inbound leg.
    inbound_flight_number: flightNumber,
    inbound_origin: origin,
    inbound_status: inboundStatus,

    // Live when the provider exposes estimated arrival, otherwise derived from scheduled arrival.
    inbound_estimated_arrival:
      formatDateTime(
        firstString(
          rawFlight.arrival?.estimated,
          rawFlight.arrival?.predicted,
          rawFlight.arrival_estimated,
          scheduledArrivalRaw,
        ),
      ) || scheduledArrival,

    // Live aircraft position when the provider exposes latitude/longitude.
    aircraft_latitude: firstNumber(rawFlight.live?.latitude, rawFlight.geography?.latitude, rawFlight.latitude),
    aircraft_longitude: firstNumber(rawFlight.live?.longitude, rawFlight.geography?.longitude, rawFlight.longitude),

    // Synthetic ops fields preserved to keep the existing assessment and UI working.
    turnaround_time_minutes: 50,
    gate_status: normalizeGateStatus(gate, terminal),
    delay_reason: firstString(rawFlight.departure?.delay ? 'ATC' : '', rawFlight.arrival?.delay ? 'ATC' : '', 'None'),
    weather_status: 'Unknown',
    crew_status: 'Unknown',
    passenger_load_factor: 0.78,
    estimated_boarding_start: minusMinutes(scheduledDepartureRaw || scheduledDeparture, 35) || scheduledDeparture,
    estimated_ready_time: minusMinutes(scheduledDepartureRaw || scheduledDeparture, 10) || scheduledDeparture,
  };
}

export function normalizeLiveFlightsResponse(payload: any) {
  const rawFlights = asArray(payload?.data ?? payload?.flights ?? payload);
  return rawFlights
    .map((rawFlight) => normalizeFlight((rawFlight ?? {}) as Record<string, any>))
    .filter((flight) => flight.flight_number);
}

export function mergeOpenSkyPositions(
  flights: FlightRecord[],
  openSkyStates: Map<string, any>,
): FlightRecord[] {
  return flights.map((flight) => {
    const state = flight.aircraft_icao24
      ? openSkyStates.get(flight.aircraft_icao24.toLowerCase())
      : undefined;

    if (!state) {
      return flight;
    }

    const latitude = typeof state[6] === 'number' ? state[6] : flight.aircraft_latitude;
    const longitude = typeof state[5] === 'number' ? state[5] : flight.aircraft_longitude;

    return {
      ...flight,
      // OpenSky is used only for aircraft state/position enrichment.
      aircraft_latitude: latitude,
      aircraft_longitude: longitude,
    };
  });
}
