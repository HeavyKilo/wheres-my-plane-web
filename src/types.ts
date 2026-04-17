export type FlightRecord = {
  flight_number: string;
  origin: string;
  destination: string;
  flight_status: string;
  aircraft_icao24?: string;
  scheduled_departure: string;
  scheduled_arrival: string;
  inbound_flight_number: string;
  inbound_origin: string;
  inbound_status: string;
  inbound_estimated_arrival: string;
  aircraft_latitude: number;
  aircraft_longitude: number;
  turnaround_time_minutes: number;
  gate_status: string;
  delay_reason: string;
  weather_status: string;
  crew_status: string;
  passenger_load_factor: number;
  estimated_boarding_start: string;
  estimated_ready_time: string;
};

export const flightCsvColumns = [
  'flight_number',
  'origin',
  'destination',
  'scheduled_departure',
  'scheduled_arrival',
  'inbound_flight_number',
  'inbound_origin',
  'inbound_status',
  'inbound_estimated_arrival',
  'aircraft_latitude',
  'aircraft_longitude',
  'turnaround_time_minutes',
  'gate_status',
  'delay_reason',
  'weather_status',
  'crew_status',
  'passenger_load_factor',
  'estimated_boarding_start',
  'estimated_ready_time',
] as const;

export type FlightCsvColumn = (typeof flightCsvColumns)[number];

export type Assessment = {
  aircraft_status: string;
  turnaround_assessment: string;
  operational_risk_level: 'Low' | 'Moderate' | 'High';
  readiness_summary: string;
  passenger_message: string;
  proactive_recommendation: string;
  escalation_needed: 'Yes' | 'No';
};
