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

export interface RouteFilters {
  query: string;
  city: City | "all";
  types: RouteType[];
  maxDistance: number; // miles; large default = no cap
  certifiedOnly: boolean;
  // tag ids the runner cares about (route must show a strong signal for them)
  tags: string[];
  sort: "score" | "distance" | "newest";
}

export const DEFAULT_FILTERS: RouteFilters = {
  query: "",
  city: "all",
  types: [],
  maxDistance: 30,
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
    if (f.types.length && !f.types.includes(r.routeType)) return false;
    if (r.distanceMi > f.maxDistance) return false;
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
    if (f.sort === "newest")
      return b.createdAt.localeCompare(a.createdAt);
    return b.loopScore - a.loopScore;
  });

  return filtered;
}

export function countActive(f: RouteFilters): number {
  let n = 0;
  if (f.city !== "all") n++;
  if (f.types.length) n += f.types.length;
  if (f.maxDistance < 30) n++;
  if (f.certifiedOnly) n++;
  n += f.tags.length;
  return n;
}
