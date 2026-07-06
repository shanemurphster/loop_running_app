import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { getValidStravaToken } from "@/lib/stravaAuth";
import { getActivity } from "@/lib/strava";
import { decodePolyline } from "@/lib/polyline";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const token = await getValidStravaToken(user.id);
  if (!token) {
    return NextResponse.json({ error: "Strava isn't connected." }, { status: 401 });
  }

  try {
    const activity = await getActivity(token, id);
    // Full-resolution polyline, distinct from the list endpoint's lighter
    // summary_polyline — this is the one actually imported as the route.
    const polyline = activity.map?.polyline || activity.map?.summary_polyline;
    if (!polyline) {
      return NextResponse.json(
        { error: "This activity has no GPS map data." },
        { status: 422 }
      );
    }

    return NextResponse.json({
      path: decodePolyline(polyline),
      distanceM: activity.distance,
      elevationGainM: activity.total_elevation_gain,
      name: activity.name,
    });
  } catch (err) {
    console.error("Strava get activity failed:", err);
    return NextResponse.json(
      { error: "Couldn't reach Strava. Try again shortly." },
      { status: 502 }
    );
  }
}
