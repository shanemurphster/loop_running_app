import type { LngLat } from "./types";

// Google/Strava "encoded polyline" format (precision 5) — decodes a string
// like "u{~vFvyys@fS]" into a list of points. Client-safe (pure math, no
// secrets), shared by the server-side Strava routes and the /add/import
// picker's client-side thumbnails so there's exactly one implementation.
//
// Strava encodes each pair as [lat, lng]; we emit this app's [lng, lat]
// (LngLat) convention instead — don't drop that swap when touching this.
export function decodePolyline(encoded: string): LngLat[] {
  const factor = 1e5;
  const coordinates: LngLat[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    coordinates.push([lng / factor, lat / factor]);
  }
  return coordinates;
}
