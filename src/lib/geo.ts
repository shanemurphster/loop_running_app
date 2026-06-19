import type { LngLat } from "./types";

// Lightweight geo helpers. No external deps — enough to generate plausible
// loop geometry for seed data and to project paths for the SVG fallback map.

export const CITY_CENTERS: Record<string, { center: LngLat; zoom: number }> = {
  Philadelphia: { center: [-75.1652, 39.9526], zoom: 12 },
  Miami: { center: [-80.1918, 25.7617], zoom: 12 },
  "New York": { center: [-73.9712, 40.7831], zoom: 12 },
};

// Miles -> degrees latitude (roughly constant).
const MI_PER_DEG_LAT = 69.0;

/**
 * Deterministically generate a wobbly closed loop around a center point.
 * `seed` keeps each route's shape stable across renders.
 */
export function makeLoop(
  center: LngLat,
  distanceMi: number,
  seed: number,
  points = 28
): LngLat[] {
  const [lng, lat] = center;
  const radiusMi = distanceMi / (2 * Math.PI); // loop circumference ≈ distance
  const radLat = radiusMi / MI_PER_DEG_LAT;
  const radLng = radiusMi / (MI_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));

  const path: LngLat[] = [];
  for (let i = 0; i < points; i++) {
    const t = (i / points) * Math.PI * 2;
    // Pseudo-random but deterministic wobble from the seed.
    const wobble =
      0.78 +
      0.22 * Math.sin(t * 3 + seed) +
      0.12 * Math.cos(t * 5 + seed * 1.7);
    path.push([
      lng + Math.cos(t) * radLng * wobble,
      lat + Math.sin(t) * radLat * wobble,
    ]);
  }
  path.push(path[0]); // close the loop
  return path;
}

export function bounds(path: LngLat[]) {
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  for (const [lng, lat] of path) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return { minLng, minLat, maxLng, maxLat };
}

/** Project a path into a 0..width / 0..height SVG box, preserving aspect. */
export function projectToSvg(path: LngLat[], width: number, height: number, pad = 8) {
  const b = bounds(path);
  const w = Math.max(b.maxLng - b.minLng, 1e-6);
  const h = Math.max(b.maxLat - b.minLat, 1e-6);
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const scale = Math.min(innerW / w, innerH / h);
  const offsetX = pad + (innerW - w * scale) / 2;
  const offsetY = pad + (innerH - h * scale) / 2;
  return path.map(([lng, lat]) => {
    const x = offsetX + (lng - b.minLng) * scale;
    // invert lat so north is up
    const y = offsetY + (b.maxLat - lat) * scale;
    return [x, y] as [number, number];
  });
}

export function centroid(path: LngLat[]): LngLat {
  const sum = path.reduce(
    (acc, [lng, lat]) => [acc[0] + lng, acc[1] + lat] as LngLat,
    [0, 0] as LngLat
  );
  return [sum[0] / path.length, sum[1] / path.length];
}
