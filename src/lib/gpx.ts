import type { LngLat } from "./types";
import { sumPositiveGain } from "./elevation";

// Browser-only (uses DOMParser) — only ever called client-side, right after
// the user picks a .gpx file, so the file itself never has to touch a server.

export interface ParsedGpx {
  path: LngLat[];
  elevations: (number | null)[];
  name: string | null;
}

export function parseGpx(xmlText: string): ParsedGpx | { error: string } {
  let doc: Document;
  try {
    doc = new DOMParser().parseFromString(xmlText, "application/xml");
  } catch {
    return { error: "Could not read this GPX file." };
  }
  if (doc.getElementsByTagName("parsererror").length > 0) {
    return { error: "Could not read this GPX file." };
  }
  if (doc.documentElement?.nodeName.toLowerCase() !== "gpx") {
    return { error: "This doesn't look like a GPX file." };
  }

  // Standard track-log shape first; some exports use routes (<rte>) instead.
  let points = Array.from(doc.getElementsByTagName("trkpt"));
  if (points.length === 0) {
    points = Array.from(doc.getElementsByTagName("rtept"));
  }

  const path: LngLat[] = [];
  const elevations: (number | null)[] = [];
  for (const pt of points) {
    const latStr = pt.getAttribute("lat");
    const lonStr = pt.getAttribute("lon");
    if (!latStr || !lonStr) continue;
    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;

    path.push([lon, lat]);
    const eleText = pt.getElementsByTagName("ele")[0]?.textContent;
    const ele = eleText ? parseFloat(eleText) : NaN;
    elevations.push(Number.isFinite(ele) ? ele : null);
  }

  if (path.length < 2) {
    return { error: "This GPX file doesn't contain a usable track." };
  }

  const nameEl =
    doc.getElementsByTagName("trk")[0]?.getElementsByTagName("name")[0] ??
    doc.getElementsByTagName("metadata")[0]?.getElementsByTagName("name")[0];
  const name = nameEl?.textContent?.trim() || null;

  return { path, elevations, name };
}

/**
 * Elevation gain from a GPX's own <ele> samples — only trusted when present
 * for most of the track; sparse/absent elevation (common on cheaper GPS
 * watches) should fall back to elevationGainMeters() instead.
 */
export function gpxElevationGain(elevations: (number | null)[]): number | null {
  const known = elevations.filter((e): e is number => e !== null);
  if (known.length < 2 || known.length < elevations.length * 0.8) return null;
  return sumPositiveGain(known);
}
