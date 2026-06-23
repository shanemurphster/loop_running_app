import type { LngLat } from "./types";

// The DB stores distance/elevation in meters (SI). The app model carries miles
// and feet (historical), and displays miles OR km per the user's preference.
// These helpers are the single conversion point.

export type Unit = "mi" | "km";

const M_PER_MI = 1609.344;
const FT_PER_M = 3.28084;

/** Format an app distance (stored in MILES) for display in the chosen unit. */
export function formatDistance(miles: number, unit: Unit): string {
  if (unit === "km") return `${(miles * 1.609344).toFixed(1)} km`;
  return `${miles.toFixed(1)} mi`;
}

/** Format an app elevation (stored in FEET): feet in mi mode, meters in km mode. */
export function formatElevation(feet: number, unit: Unit): string {
  if (unit === "km") return `${Math.round(feet / FT_PER_M)} m`;
  return `${Math.round(feet)} ft`;
}

// --- DB (meters) <-> app (miles/feet) ---
export const metersToMiles = (m: number) => m / M_PER_MI;
export const metersToFeet = (m: number) => m * FT_PER_M;
export const milesToMeters = (mi: number) => mi * M_PER_MI;
export const feetToMeters = (ft: number) => ft / FT_PER_M;

// --- Geometry (EWKT for inserts; haversine for drawn-route length) ---

/** PostGIS EWKT LineString — insertable directly into a geography column. */
export function lineToEwkt(path: LngLat[]): string {
  const pts = path.map(([lng, lat]) => `${lng} ${lat}`).join(",");
  return `SRID=4326;LINESTRING(${pts})`;
}

export function pointToEwkt([lng, lat]: LngLat): string {
  return `SRID=4326;POINT(${lng} ${lat})`;
}

/** Total length of a path in meters (haversine) — used to auto-compute distance. */
export function pathLengthMeters(path: LngLat[]): number {
  const R = 6371000;
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    const [lng1, lat1] = path[i - 1];
    const [lng2, lat2] = path[i];
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLng = ((lng2 - lng1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2;
    total += 2 * R * Math.asin(Math.sqrt(a));
  }
  return total;
}
