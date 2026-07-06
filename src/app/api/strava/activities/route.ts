import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getValidStravaToken } from "@/lib/stravaAuth";
import { listActivities } from "@/lib/strava";

export const runtime = "nodejs";

// This is a running-route app — only these count as importable.
const RUN_TYPES = new Set(["Run", "TrailRun", "VirtualRun"]);
const PER_PAGE = 30;

export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const token = await getValidStravaToken(user.id);
  if (!token) {
    // Not connected yet — a normal UI state, not an error.
    return NextResponse.json({ connected: false });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  try {
    const raw = await listActivities(token, page, PER_PAGE);
    const activities = raw
      .filter((a) => RUN_TYPES.has(a.sport_type ?? a.type))
      .filter((a) => Boolean(a.map?.summary_polyline))
      .map((a) => ({
        id: a.id,
        name: a.name,
        startDate: a.start_date,
        distanceM: a.distance,
        elevationGainM: a.total_elevation_gain,
        movingTimeS: a.moving_time,
        summaryPolyline: a.map!.summary_polyline as string,
      }));

    return NextResponse.json({
      connected: true,
      activities,
      page,
      hasMore: raw.length === PER_PAGE,
    });
  } catch (err) {
    console.error("Strava list activities failed:", err);
    return NextResponse.json(
      { error: "Couldn't reach Strava. Try again shortly." },
      { status: 502 }
    );
  }
}
