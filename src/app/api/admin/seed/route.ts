import { NextResponse } from "next/server";
import { SEED_ROUTES } from "@/lib/seed";
import { createServiceClient } from "@/lib/supabase/service";
import {
  feetToMeters,
  lineToEwkt,
  milesToMeters,
  pointToEwkt,
} from "@/lib/units";

export const runtime = "nodejs";

// One-time loader for the demo routes. Idempotent: skips if seed routes already
// exist. Inserts via the service role (creator_id null, source 'seed'). Wipe
// later with:  delete from routes where source = 'seed';
export async function POST() {
  const db = createServiceClient();

  const { count } = await db
    .from("routes")
    .select("id", { count: "exact", head: true })
    .eq("source", "seed");
  if ((count ?? 0) > 0) {
    return NextResponse.json({ inserted: 0, message: "Seed routes already present." });
  }

  const rows = SEED_ROUTES.map((r) => ({
    creator_id: null,
    name: r.name,
    description: r.description,
    city: r.city,
    route_type: r.routeType,
    distance_m: milesToMeters(r.distanceMi),
    elevation_m: feetToMeters(r.elevationFt),
    geom: lineToEwkt(r.path),
    start_point: pointToEwkt(r.path[0]),
    image: r.image,
    source: "seed",
    loop_certified: r.loopCertified ?? false,
    run_count: r.runCount ?? 0,
  }));

  const { data, error } = await db.from("routes").insert(rows).select("id");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ inserted: data?.length ?? 0 });
}
