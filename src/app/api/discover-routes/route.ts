import { NextResponse } from "next/server";
import { CERTIFY_MIN_RUNNERS, discoverableClusters } from "@/lib/discovery";
import { nameCluster } from "@/lib/aiRoute";
import { createServiceClient } from "@/lib/supabase/service";
import {
  feetToMeters,
  lineToEwkt,
  milesToMeters,
  pointToEwkt,
} from "@/lib/units";

export const runtime = "nodejs";

// Cost backstop: a single scan can never make more than this many paid (Haiku)
// calls, regardless of state.
const MAX_NEW_PER_SCAN = 3;

export async function POST() {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server." },
      { status: 503 }
    );
  }

  const db = createServiceClient();

  // Dedup against the DB so a cluster is ever named exactly once.
  const { data: knownRows } = await db
    .from("discovery_clusters")
    .select("cluster_id");
  const known = (knownRows ?? []).map((r) => r.cluster_id as string);

  const ready = discoverableClusters(known);
  const candidates = ready.slice(0, MAX_NEW_PER_SCAN);

  if (candidates.length === 0) {
    return NextResponse.json({ routes: [], remaining: 0 });
  }

  const created: Array<{
    id: string;
    name: string;
    city: string;
    distanceMi: number;
    routeType: string;
    loopCertified: boolean;
    runCount: number;
    predictedTags: string[];
  }> = [];

  for (const cluster of candidates) {
    try {
      const meta = await nameCluster(cluster); // the one paid call per route
      const { data, error } = await db
        .from("routes")
        .insert({
          creator_id: null, // community-discovered
          name: meta.name,
          description: meta.description,
          city: cluster.city,
          route_type: cluster.routeType,
          distance_m: milesToMeters(cluster.distanceMi),
          elevation_m: feetToMeters(cluster.elevationFt),
          geom: lineToEwkt(cluster.path),
          start_point: pointToEwkt(cluster.path[0]),
          source: "discovered",
          loop_certified: cluster.runnerCount >= CERTIFY_MIN_RUNNERS,
          run_count: cluster.runnerCount,
          predicted_tags: meta.predictedTags,
          cluster_id: cluster.clusterId,
        })
        .select("id")
        .single();
      if (error || !data) throw new Error(error?.message ?? "insert failed");

      // Record the cluster so it's never named again.
      await db.from("discovery_clusters").insert({
        cluster_id: cluster.clusterId,
        route_id: data.id,
      });

      created.push({
        id: data.id as string,
        name: meta.name,
        city: cluster.city,
        distanceMi: cluster.distanceMi,
        routeType: cluster.routeType,
        loopCertified: cluster.runnerCount >= CERTIFY_MIN_RUNNERS,
        runCount: cluster.runnerCount,
        predictedTags: meta.predictedTags,
      });
    } catch (err) {
      console.error(`discover: cluster ${cluster.clusterId} failed:`, err);
    }
  }

  return NextResponse.json({
    routes: created,
    remaining: Math.max(0, ready.length - created.length),
  });
}
