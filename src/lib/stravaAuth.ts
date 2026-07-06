import "server-only";
import { createServiceClient } from "./supabase/service";
import { refreshAccessToken } from "./strava";

// Refresh a bit before actual expiry so a request never races the deadline.
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

/**
 * Returns a usable Strava access token for this user, refreshing it first if
 * it's expired (or close to it). Returns null if the user has never
 * connected Strava, or if the refresh itself fails (e.g. they revoked access
 * on Strava's side) — callers should treat null uniformly as "not connected".
 */
export async function getValidStravaToken(userId: string): Promise<string | null> {
  const db = createServiceClient();
  const { data: row } = await db
    .from("strava_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (!row) return null;

  const expiresAt = new Date(row.expires_at as string).getTime();
  if (expiresAt - Date.now() > REFRESH_BUFFER_MS) {
    return row.access_token as string;
  }

  try {
    const fresh = await refreshAccessToken(row.refresh_token as string);
    await db
      .from("strava_tokens")
      .update({
        access_token: fresh.access_token,
        // Strava may rotate the refresh token too — always persist whatever
        // comes back, not just the access token.
        refresh_token: fresh.refresh_token,
        expires_at: new Date(fresh.expires_at * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    return fresh.access_token;
  } catch (err) {
    console.error("Strava token refresh failed:", err);
    return null;
  }
}
