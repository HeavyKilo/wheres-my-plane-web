import type { FlightRecord } from '../types';
import { flightCsvColumns } from '../types';

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function validateFlightCsvColumns(headers: string[]) {
  const missingColumns = flightCsvColumns.filter((column) => !headers.includes(column));
  return {
    isValid: missingColumns.length === 0,
    missingColumns,
  };
}

export function toFlightRecord(entry: Record<string, string>): FlightRecord {
  return {
    flight_number: entry.flight_number,
    origin: entry.origin,
    destination: entry.destination,
    scheduled_departure: entry.scheduled_departure,
    scheduled_arrival: entry.scheduled_arrival,
    inbound_flight_number: entry.inbound_flight_number,
    inbound_origin: entry.inbound_origin,
    inbound_status: entry.inbound_status,
    inbound_estimated_arrival: entry.inbound_estimated_arrival,
    aircraft_latitude: toNumber(entry.aircraft_latitude),
    aircraft_longitude: toNumber(entry.aircraft_longitude),
    turnaround_time_minutes: toNumber(entry.turnaround_time_minutes),
    gate_status: entry.gate_status,
    delay_reason: entry.delay_reason,
    weather_status: entry.weather_status,
    crew_status: entry.crew_status,
    passenger_load_factor: toNumber(entry.passenger_load_factor),
    estimated_boarding_start: entry.estimated_boarding_start,
    estimated_ready_time: entry.estimated_ready_time,
  };
}
