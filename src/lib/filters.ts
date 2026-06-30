import type { City, RouteType, RouteWithStats } from "./types";

export const CITIES: City[] = ["Philadelphia", "Miami", "New York"];
export const ROUTE_TYPES: RouteType[] = [
  "Long Run",
  "Tempo",
  "Easy",
  "Trail",
  "Hills",
  "Track",
];

// Presets offered in the add-route UI (stored as free text in the DB).
export const SURFACES = ["Paved", "Trail", "Gravel", "Track", "Mixed"];
export const FLATNESS = ["Flat", "Rolling", "Hilly"];

export const MAX_DISTANCE = 30; // mi — slider ceiling / "no cap" sentinel
export const MAX_ELEVATION = 2000; // ft — slider ceiling / "no cap" sentinel

export interface RouteFilters {
  query: string;
  city: City | "all";
  types: string[];
  surfaces: string[];
  flatness: string[];
  minDistance: number; // miles
  maxDistance: number; // miles; MAX_DISTANCE = no cap
  maxElevation: number; // ft; MAX_ELEVATION = no cap
  certifiedOnly: boolean;
  // tag ids the runner cares about (route must show a strong signal for them)
  tags: string[];
  sort: "score" | "distance" | "newest";
}

export const DEFAULT_FILTERS: RouteFilters = {
  query: "",
  city: "all",
  types: [],
  surfaces: [],
  flatness: [],
  minDistance: 0,
  maxDistance: MAX_DISTANCE,
  maxElevation: MAX_ELEVATION,
  certifiedOnly: false,
  tags: [],
  sort: "score",
};

const TAG_SIGNAL_THRESHOLD = 40; // % of reactions

export function applyFilters(
  routes: RouteWithStats[],
  f: RouteFilters
): RouteWithStats[] {
  const q = f.query.trim().toLowerCase();
  const filtered = routes.filter((r) => {
    if (q && !`${r.name} ${r.city} ${r.description}`.toLowerCase().includes(q))
      return false;
    if (f.city !== "all" && r.city !== f.city) return false;
    if (f.types.length && !f.types.some((t) => t === r.routeType)) return false;
    if (f.surfaces.length && (!r.surface || !f.surfaces.includes(r.surface)))
      return false;
    if (f.flatness.length && (!r.flatness || !f.flatness.includes(r.flatness)))
      return false;
    if (r.distanceMi < f.minDistance) return false;
    if (r.distanceMi > f.maxDistance) return false;
    if (f.maxElevation < MAX_ELEVATION && r.elevationFt > f.maxElevation)
      return false;
    if (f.certifiedOnly && !r.loopCertified) return false;
    if (f.tags.length) {
      const strong = new Set(
        r.tagSignals.filter((s) => s.pct >= TAG_SIGNAL_THRESHOLD).map((s) => s.tag.id)
      );
      if (!f.tags.every((t) => strong.has(t))) return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    if (f.sort === "distance") return a.distanceMi - b.distanceMi;
    if (f.sort === "newest") return b.createdAt.localeCompare(a.createdAt);
    return b.loopScore - a.loopScore;
  });

  return filtered;
}

export function countActive(f: RouteFilters): number {
  let n = 0;
  if (f.city !== "all") n++;
  n += f.types.length;
  n += f.surfaces.length;
  n += f.flatness.length;
  if (f.minDistance > 0) n++;
  if (f.maxDistance < MAX_DISTANCE) n++;
  if (f.maxElevation < MAX_ELEVATION) n++;
  if (f.certifiedOnly) n++;
  n += f.tags.length;
  return n;
}
