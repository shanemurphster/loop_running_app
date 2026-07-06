import type { LngLat } from "./types";

// Elevation gain for a drawn route, via the Open-Meteo Elevation API — free, no
// API key, CORS-enabled, up to 100 coordinates per request. We sample the path
// evenly, fetch ground elevations, and sum the positive deltas (total ascent).
//
// Best-effort: any failure returns 0 (flatness, the user-picked descriptor, is
// the primary vertical signal). Resolution is ~90 m (SRTM), so treat as "≈".
/** Total ascent from a sequence of elevation samples (sums positive deltas). */
export function sumPositiveGain(elevations: number[]): number {
  let gain = 0;
  for (let i = 1; i < elevations.length; i++) {
    const d = elevations[i] - elevations[i - 1];
    if (d > 0) gain += d;
  }
  return gain;
}

export async function elevationGainMeters(path: LngLat[]): Promise<number> {
  if (path.length < 2) return 0;

  const N = Math.min(100, path.length);
  const step = (path.length - 1) / (N - 1);
  const sampled: LngLat[] = [];
  for (let i = 0; i < N; i++) sampled.push(path[Math.round(i * step)]);

  const lats = sampled.map((p) => p[1].toFixed(5)).join(",");
  const lngs = sampled.map((p) => p[0].toFixed(5)).join(",");

  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/elevation?latitude=${lats}&longitude=${lngs}`
    );
    const data = await res.json();
    const elev: number[] | undefined = data?.elevation;
    if (!Array.isArray(elev) || elev.length < 2) return 0;
    return sumPositiveGain(elev);
  } catch {
    return 0;
  }
}
