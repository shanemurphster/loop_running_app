import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerSupabase } from "@/lib/supabase/server";
import { HAS_STRAVA, STRAVA_CLIENT_ID } from "@/lib/strava";

// Kicks off the Strava OAuth flow. A real top-level navigation (not a fetch),
// linked to directly from /add/import.
export const runtime = "nodejs";

const STATE_COOKIE = "strava_oauth_state";

export async function GET(request: Request) {
  const { origin } = new URL(request.url);

  if (!HAS_STRAVA) {
    return NextResponse.redirect(`${origin}/add/import?strava=not_configured`);
  }

  // /add/import already gates guests behind the sign-in sheet, but check
  // again here — a Strava connection must always be tied to a real account.
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.is_anonymous) {
    return NextResponse.redirect(`${origin}/`);
  }

  const state = crypto.randomUUID();
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });

  const authorizeUrl = new URL("https://www.strava.com/oauth/authorize");
  authorizeUrl.searchParams.set("client_id", STRAVA_CLIENT_ID);
  authorizeUrl.searchParams.set("redirect_uri", `${origin}/api/strava/callback`);
  authorizeUrl.searchParams.set("response_type", "code");
  authorizeUrl.searchParams.set("approval_prompt", "auto");
  // read_all (not just read): most runners' activities are private/
  // followers-only, and "browse your past runs" needs to see those too.
  authorizeUrl.searchParams.set("scope", "activity:read_all");
  authorizeUrl.searchParams.set("state", state);

  return NextResponse.redirect(authorizeUrl.toString());
}
