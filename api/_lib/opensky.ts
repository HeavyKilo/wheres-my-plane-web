type OpenSkyStateVector = [
  string,
  string | null,
  string | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  boolean | null,
  number | null,
  number | null,
  number | null,
  number[] | null,
  number | null,
  string | null,
  boolean | null,
  number | null,
  number | null,
];

function getOpenSkyAuthHeaders() {
  const username = process.env.OPENSKY_USERNAME;
  const password = process.env.OPENSKY_PASSWORD;

  if (!username || !password) {
    return {};
  }

  const credentials = Buffer.from(`${username}:${password}`).toString('base64');
  return {
    Authorization: `Basic ${credentials}`,
  };
}

export async function fetchOpenSkyPositions(icao24Codes: string[]) {
  const normalizedIcao24 = [...new Set(icao24Codes.map((code) => code.toLowerCase()).filter(Boolean))];
  if (!normalizedIcao24.length) {
    return new Map<string, OpenSkyStateVector>();
  }

  const url = new URL('https://opensky-network.org/api/states/all');
  normalizedIcao24.forEach((icao24) => url.searchParams.append('icao24', icao24));

  const response = await fetch(url.toString(), {
    headers: {
      ...getOpenSkyAuthHeaders(),
    },
  });

  if (!response.ok) {
    throw new Error(`OpenSky responded with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as { states?: OpenSkyStateVector[] };
  const states = Array.isArray(payload.states) ? payload.states : [];

  return new Map(states.map((state) => [state[0]?.toLowerCase(), state]));
}
