import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { exchangeCodeForToken } from "@/lib/strava";

// Strava's redirect target after the consent screen. Distinct from
// src/app/auth/callback/route.ts, which is Supabase's own magic-link/OAuth
// code exchange and unrelated to this.
export const runtime = "nodejs";

const STATE_COOKIE = "strava_oauth_state";

export async function GET(request: Request) {
  const { origin, searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const deniedError = searchParams.get("error");

  const cookieStore = await cookies();
  const savedState = cookieStore.get(STATE_COOKIE)?.value;
  // Single-use: clear it regardless of outcome.
  cookieStore.set(STATE_COOKIE, "", { maxAge: 0, path: "/" });

  if (deniedError) {
    return NextResponse.redirect(`${origin}/add/import?strava=denied`);
  }
  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(`${origin}/add/import?strava=state_mismatch`);
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) {
    return NextResponse.redirect(`${origin}/`);
  }

  try {
    const token = await exchangeCodeForToken(code);
    const athleteId = token.athlete?.id != null ? String(token.athlete.id) : "";
    const db = createServiceClient();

    await db.from("strava_tokens").upsert(
      {
        user_id: user.id,
        athlete_id: athleteId,
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: new Date(token.expires_at * 1000).toISOString(),
        scope: "activity:read_all",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    if (athleteId) {
      await db
        .from("profiles")
        .update({ strava_athlete_id: athleteId })
        .eq("id", user.id);
    }
  } catch (err) {
    console.error("Strava OAuth callback failed:", err);
    return NextResponse.redirect(`${origin}/add/import?strava=error`);
  }

  return NextResponse.redirect(`${origin}/add/import?strava=connected`);
}
