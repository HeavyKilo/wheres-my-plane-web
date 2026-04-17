import { fetchOpenSkyPositions } from './_lib/opensky';
import { mergeOpenSkyPositions, normalizeLiveFlightsResponse } from '../src/utils/liveFlights';

function buildProviderUrl(requestUrl: string) {
  const apiKey = process.env.AVIATIONSTACK_API_KEY;
  const providerUrl =
    process.env.AVIATIONSTACK_API_URL ?? 'https://api.aviationstack.com/v1/flights';

  if (!apiKey) {
    throw new Error('Missing AVIATIONSTACK_API_KEY environment variable.');
  }

  const incomingUrl = new URL(requestUrl, 'https://example.vercel.app');
  const upstreamUrl = new URL(providerUrl);

  upstreamUrl.searchParams.set('access_key', apiKey);
  upstreamUrl.searchParams.set('limit', process.env.AVIATIONSTACK_LIMIT ?? '25');

  const flightIata = incomingUrl.searchParams.get('flight_iata');
  const airlineIata =
    incomingUrl.searchParams.get('airline_iata') ?? incomingUrl.searchParams.get('airline_code');
  const airportIata =
    incomingUrl.searchParams.get('airport_iata') ?? incomingUrl.searchParams.get('airport_code');
  const airportScope = incomingUrl.searchParams.get('airport_scope') ?? 'departure';
  const departureIata = incomingUrl.searchParams.get('dep_iata');
  const arrivalIata = incomingUrl.searchParams.get('arr_iata');

  if (flightIata) upstreamUrl.searchParams.set('flight_iata', flightIata);
  if (airlineIata) upstreamUrl.searchParams.set('airline_iata', airlineIata);
  if (departureIata) upstreamUrl.searchParams.set('dep_iata', departureIata);
  if (arrivalIata) upstreamUrl.searchParams.set('arr_iata', arrivalIata);

  // Assumption: when callers provide a generic airport code, default it to a departure-airport
  // filter unless airport_scope=arrival is explicitly requested.
  if (airportIata && !departureIata && !arrivalIata) {
    upstreamUrl.searchParams.set(airportScope === 'arrival' ? 'arr_iata' : 'dep_iata', airportIata);
  }

  return upstreamUrl;
}

export default async function handler(req: any, res: any) {
  try {
    const upstreamUrl = buildProviderUrl(req.url ?? '/api/live-flights');
    const upstreamResponse = await fetch(upstreamUrl.toString());

    if (!upstreamResponse.ok) {
      throw new Error(`Upstream API responded with HTTP ${upstreamResponse.status}.`);
    }

    const payload = await upstreamResponse.json();
    const aviationstackFlights = normalizeLiveFlightsResponse(payload);

    let flights = aviationstackFlights;
    let opensky = { ok: false, message: 'OpenSky enrichment not attempted.' };

    try {
      const icao24Codes = aviationstackFlights
        .map((flight) => flight.aircraft_icao24 ?? '')
        .filter(Boolean);

      if (icao24Codes.length) {
        const openSkyStates = await fetchOpenSkyPositions(icao24Codes);
        flights = mergeOpenSkyPositions(aviationstackFlights, openSkyStates);
        opensky = {
          ok: true,
          message: `Merged OpenSky position data for ${openSkyStates.size} aircraft.`,
        };
      } else {
        opensky = {
          ok: false,
          message: 'Primary provider did not expose reliable ICAO24 values for OpenSky matching.',
        };
      }
    } catch (openSkyError) {
      // Matching can be unreliable or rate-limited; retain the primary provider data.
      opensky = {
        ok: false,
        message: openSkyError instanceof Error ? openSkyError.message : 'Unknown OpenSky error.',
      };
    }

    res.status(200).json({
      ok: true,
      source: 'live',
      flights,
      providers: {
        primary: 'aviationstack',
        position: 'opensky',
      },
      opensky,
    });
  } catch (error) {
    res.status(503).json({
      ok: false,
      source: 'live',
      message: error instanceof Error ? error.message : 'Unknown live data error.',
      flights: [],
    });
  }
}
