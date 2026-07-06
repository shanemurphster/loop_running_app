import "server-only";

// All direct knowledge of Strava's REST API lives in this one module — route
// handlers stay thin and just call these typed wrappers. Server-only: this
// file (transitively) needs STRAVA_CLIENT_SECRET, which must never reach the
// client bundle.

export const STRAVA_CLIENT_ID = process.env.STRAVA_CLIENT_ID ?? "";
export const STRAVA_CLIENT_SECRET = process.env.STRAVA_CLIENT_SECRET ?? "";
export const HAS_STRAVA = Boolean(STRAVA_CLIENT_ID && STRAVA_CLIENT_SECRET);

const TOKEN_URL = "https://www.strava.com/oauth/token";
const API_BASE = "https://www.strava.com/api/v3";

export interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number; // unix seconds
  athlete?: { id: number };
}

export interface StravaActivitySummary {
  id: number;
  name: string;
  type: string;
  sport_type?: string;
  distance: number; // meters
  total_elevation_gain: number; // meters
  moving_time: number; // seconds
  start_date: string; // ISO
  map?: { summary_polyline?: string; polyline?: string };
}

async function stravaJson<T>(res: Response, what: string): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Strava ${what} failed (${res.status}): ${body.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

export async function exchangeCodeForToken(code: string): Promise<StravaTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      code,
      grant_type: "authorization_code",
    }),
  });
  return stravaJson<StravaTokenResponse>(res, "token exchange");
}

export async function refreshAccessToken(refreshToken: string): Promise<StravaTokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: STRAVA_CLIENT_ID,
      client_secret: STRAVA_CLIENT_SECRET,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  return stravaJson<StravaTokenResponse>(res, "token refresh");
}

export async function listActivities(
  accessToken: string,
  page: number,
  perPage: number
): Promise<StravaActivitySummary[]> {
  const url = `${API_BASE}/athlete/activities?page=${page}&per_page=${perPage}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return stravaJson<StravaActivitySummary[]>(res, "list activities");
}

export async function getActivity(
  accessToken: string,
  id: string
): Promise<StravaActivitySummary> {
  const res = await fetch(`${API_BASE}/activities/${id}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return stravaJson<StravaActivitySummary>(res, "get activity");
}
