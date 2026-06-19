import { NextResponse } from "next/server";
import { CERTIFY_MIN_RUNNERS, discoverableClusters } from "@/lib/discovery";
import { nameCluster } from "@/lib/aiRoute";
import type { Route } from "@/lib/types";

export const runtime = "nodejs";

// Hard cap on naming calls per request. This is the cost backstop: even if the
// client's dedupe list is empty, a single scan can never make more than this
// many paid calls. Production will persist promoted clusters in Supabase so a
// cluster is named exactly once, ever.
const MAX_NEW_PER_SCAN = 3;

interface Body {
  knownClusterIds?: string[];
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server." },
      { status: 503 }
    );
  }

  let body: Body = {};
  try {
    body = await req.json();
  } catch {
    /* empty body is fine */
  }

  const known = body.knownClusterIds ?? [];
  // Only clusters past the threshold AND not already turned into routes.
  const candidates = discoverableClusters(known).slice(0, MAX_NEW_PER_SCAN);

  const totalReady = discoverableClusters(known).length;

  if (candidates.length === 0) {
    return NextResponse.json({ routes: [], totalReady: 0, remaining: 0 });
  }

  const nowIso = new Date().toISOString();
  const routes: Route[] = [];

  for (const cluster of candidates) {
    try {
      const meta = await nameCluster(cluster); // the one paid call per route
      routes.push({
        id: cluster.clusterId,
        creatorId: "loop", // community-discovered, not a single user
        name: meta.name,
        description: meta.description,
        city: cluster.city,
        routeType: cluster.routeType,
        distanceMi: cluster.distanceMi,
        elevationFt: cluster.elevationFt,
        path: cluster.path,
        image:
          "https://images.unsplash.com/photo-1502904550040-7534597429ae?w=800&q=70",
        createdAt: nowIso,
        loopCertified: cluster.runnerCount >= CERTIFY_MIN_RUNNERS,
        runCount: cluster.runnerCount,
        source: "discovered",
        predictedTags: meta.predictedTags,
      });
    } catch (err) {
      // Skip a cluster that failed to name; don't fail the whole scan.
      console.error(`Failed to name cluster ${cluster.clusterId}:`, err);
    }
  }

  return NextResponse.json({
    routes,
    totalReady,
    remaining: Math.max(0, totalReady - routes.length),
  });
}
