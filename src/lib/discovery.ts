// Route discovery engine.
//
// Loop does NOT generate routes on demand — that would mean an API call per
// user tap. Instead routes EMERGE from real run data: when enough distinct
// runners cover roughly the same path in an area, that path is promoted into a
// route, and at a higher threshold becomes Loop Certified.
//
// This module is the pure, server-safe core: it ingests run "activities",
// clusters them, and reports which clusters have crossed the promotion
// threshold. It performs NO network/API calls — the (paid) naming step happens
// once per newly-promoted cluster in the API route, capped and deduped.
//
// Today the activity feed is simulated. Real Strava/Garmin activities will plug
// into `getActivityFeed()` behind the same shape in a later milestone.

import { CITY_CENTERS, centroid, makeLoop } from "./geo";
import type { City, LngLat, RouteType } from "./types";

export interface Activity {
  id: string;
  userId: string;
  city: City;
  path: LngLat[];
  distanceMi: number;
}

export interface RouteCluster {
  /** Deterministic, stable id — used to dedupe so a path is promoted only once. */
  clusterId: string;
  city: City;
  /** Distinct runners who have covered this path. Drives promotion + certification. */
  runnerCount: number;
  distanceMi: number;
  elevationFt: number;
  routeType: RouteType;
  /** Representative geometry for the cluster (medoid trace in production). */
  path: LngLat[];
}

// Promotion thresholds — the cost-control heart of the system. A path must be
// run by this many distinct people before it costs us a (single) naming call.
export const PROMOTE_MIN_RUNNERS = 3;
export const CERTIFY_MIN_RUNNERS = 8;

// ---------------------------------------------------------------------------
// Simulated run feed
//
// Each "emerging" spot is a place several runners have independently run that
// is NOT one of our seed routes. These are what the pipeline discovers.
// ---------------------------------------------------------------------------

interface EmergingSpot {
  city: City;
  label: string; // internal only — the AI writes the real public name
  offset: [number, number]; // degrees from city center, to sit away from seeds
  distanceMi: number;
  elevationFt: number;
  runners: number; // distinct runners who've run it
}

const EMERGING_SPOTS: EmergingSpot[] = [
  { city: "Philadelphia", label: "Pennypack Creek path", offset: [0.04, 0.05], distanceMi: 6.4, elevationFt: 120, runners: 11 },
  { city: "Philadelphia", label: "Cobbs Creek loop", offset: [-0.05, -0.03], distanceMi: 3.6, elevationFt: 60, runners: 4 },
  { city: "Miami", label: "Virginia Key trails", offset: [0.05, -0.02], distanceMi: 5.8, elevationFt: 40, runners: 9 },
  { city: "Miami", label: "Morningside bayfront", offset: [-0.03, 0.04], distanceMi: 4.2, elevationFt: 12, runners: 5 },
  { city: "New York", label: "Riverside Park north", offset: [0.03, 0.05], distanceMi: 5.2, elevationFt: 90, runners: 14 },
  { city: "New York", label: "Astoria waterfront", offset: [-0.04, -0.04], distanceMi: 4.0, elevationFt: 25, runners: 4 },
];

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The activity feed. Real Strava/Garmin activities plug in here later.
 *
 * Until then it's EMPTY by default, so the deployed app stays free of fake data
 * — discovery simply finds nothing to promote. Set LOOP_SIMULATE_RUNS=1 (local
 * only) to replay the simulated feed for testing the pipeline.
 */
export function getActivityFeed(): Activity[] {
  if (process.env.LOOP_SIMULATE_RUNS !== "1") return [];
  const activities: Activity[] = [];
  EMERGING_SPOTS.forEach((spot, si) => {
    const { center } = CITY_CENTERS[spot.city];
    const spotCenter: LngLat = [center[0] + spot.offset[0], center[1] + spot.offset[1]];
    for (let r = 0; r < spot.runners; r++) {
      const rand = mulberry32(si * 1000 + r * 7);
      const jitter: LngLat = [
        spotCenter[0] + (rand() - 0.5) * 0.004,
        spotCenter[1] + (rand() - 0.5) * 0.004,
      ];
      activities.push({
        id: `act_${si}_${r}`,
        userId: `runner_${si}_${r}`,
        city: spot.city,
        distanceMi: spot.distanceMi + (rand() - 0.5) * 0.4,
        path: makeLoop(jitter, spot.distanceMi, si * 13 + r),
      });
    }
  });
  return activities;
}

// ---------------------------------------------------------------------------
// Clustering
//
// Bucket activities by (city, spatial grid cell, distance band). Activities of
// similar length starting near each other are treated as the same route.
// ---------------------------------------------------------------------------

const GRID = 0.02; // ~1.4 km cells — coarse enough to absorb GPS jitter

function clusterKey(city: City, c: LngLat, distanceMi: number): string {
  const gx = Math.round(c[0] / GRID);
  const gy = Math.round(c[1] / GRID);
  const band = Math.round(distanceMi); // group by whole-mile band
  return `disc_${city.replace(/\s+/g, "-").toLowerCase()}_${gx}_${gy}_${band}`;
}

function inferType(distanceMi: number, elevationFt: number): RouteType {
  if (elevationFt / distanceMi > 60) return "Trail";
  if (distanceMi >= 7) return "Long Run";
  if (distanceMi >= 4) return "Tempo";
  return "Easy";
}

export function clusterActivities(activities: Activity[]): RouteCluster[] {
  const groups = new Map<string, { acts: Activity[]; runners: Set<string> }>();

  for (const a of activities) {
    const key = clusterKey(a.city, centroid(a.path), a.distanceMi);
    const g = groups.get(key) ?? { acts: [], runners: new Set<string>() };
    g.acts.push(a);
    g.runners.add(a.userId);
    groups.set(key, g);
  }

  const clusters: RouteCluster[] = [];
  for (const [clusterId, g] of groups) {
    const avgDist =
      g.acts.reduce((s, a) => s + a.distanceMi, 0) / g.acts.length;
    const distanceMi = Math.round(avgDist * 10) / 10;
    // Elevation isn't in the simulated feed; approximate from the spot via type.
    const elevationFt = Math.round(distanceMi * 18);
    clusters.push({
      clusterId,
      city: g.acts[0].city,
      runnerCount: g.runners.size,
      distanceMi,
      elevationFt,
      routeType: inferType(distanceMi, elevationFt),
      path: g.acts[0].path, // representative trace
    });
  }
  return clusters;
}

/**
 * Clusters that have crossed the promotion threshold and have not already been
 * turned into a route (`knownClusterIds`). These — and only these — are worth a
 * naming call.
 */
export function discoverableClusters(knownClusterIds: string[]): RouteCluster[] {
  const known = new Set(knownClusterIds);
  return clusterActivities(getActivityFeed())
    .filter((c) => c.runnerCount >= PROMOTE_MIN_RUNNERS && !known.has(c.clusterId))
    .sort((a, b) => b.runnerCount - a.runnerCount);
}
