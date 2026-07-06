"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Undo2, Trash2, Route as RouteIcon, Spline, Loader2 } from "lucide-react";
import clsx from "clsx";
import { HAS_MAPBOX, MAP_STYLE, MAPBOX_TOKEN } from "@/lib/mapbox";
import { pathLengthMeters } from "@/lib/units";
import type { LngLat } from "@/lib/types";

type Mode = "roads" | "straight";
type Drag = { index: number; points: LngLat[] };
// The installed mapbox-gl types expose queried features as a bare
// `GeoJSONFeature` without `geometry`/`properties` — cast once at the query
// site to the shape we actually get back at runtime (our own point/line
// layers, so we know exactly what's on them).
type QueriedFeature = {
  properties: Record<string, unknown>;
  geometry: { coordinates: [number, number] };
};

function queryFeatures(
  map: import("mapbox-gl").Map,
  geometry: import("mapbox-gl").PointLike | [import("mapbox-gl").PointLike, import("mapbox-gl").PointLike],
  layers: string[]
): QueriedFeature[] {
  return map.queryRenderedFeatures(geometry, { layers }) as unknown as QueriedFeature[];
}

// OnTheGoMap-style route drawing. Tap to drop waypoints; the line either snaps
// to real roads/paths (Mapbox Directions, walking) or connects straight. The
// resulting geometry + distance are reported up via onChange.
//
// Existing waypoints are draggable to reposition them, and the line itself is
// draggable — grabbing any point along it inserts a new waypoint there so you
// can pull a wrong turn back onto the path you meant, same as tapping.
//
// Mapbox Directions allows up to 25 coordinates per request, plenty for a
// hand-tapped route; we cap waypoints there in roads mode.
const MAX_WAYPOINTS = 25;

export function RouteDraw({
  onChange,
  className,
}: {
  onChange: (path: LngLat[], distanceMeters: number) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("mapbox-gl").Map | null>(null);
  const [ready, setReady] = useState(false);
  const [mode, setMode] = useState<Mode>("roads");
  const [waypoints, setWaypoints] = useState<LngLat[]>([]);
  const [routing, setRouting] = useState(false);

  const modeRef = useRef(mode);
  modeRef.current = mode;
  const waypointsRef = useRef<LngLat[]>([]);
  waypointsRef.current = waypoints;
  // Set while a point/line is being dragged; suppresses the trailing "click"
  // so a drag-release doesn't also append a brand-new waypoint.
  const draggingRef = useRef<Drag | null>(null);
  const suppressClickRef = useRef(false);

  // --- init map ---
  useEffect(() => {
    if (!HAS_MAPBOX || !containerRef.current) return;
    let cancelled = false;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current) return;
      mapboxgl.accessToken = MAPBOX_TOKEN;
      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: MAP_STYLE,
        center: [-75.1652, 39.9526],
        zoom: 12,
        attributionControl: false,
      });
      mapRef.current = map;
      map.addControl(
        new mapboxgl.GeolocateControl({
          positionOptions: { enableHighAccuracy: true },
          trackUserLocation: false,
        }),
        "top-right"
      );

      map.on("load", () => {
        map.addSource("draw-line", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        // Wide, invisible line sharing the same source — makes the thin
        // visible line much easier to grab (mouse and, especially, touch).
        map.addLayer({
          id: "draw-line-hit",
          type: "line",
          source: "draw-line",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#000", "line-width": 26, "line-opacity": 0 },
        });
        map.addLayer({
          id: "draw-line",
          type: "line",
          source: "draw-line",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#22e06a", "line-width": 4 },
        });
        map.addSource("draw-points", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addLayer({
          id: "draw-points",
          type: "circle",
          source: "draw-points",
          paint: {
            "circle-radius": 6,
            "circle-color": "#22e06a",
            "circle-stroke-color": "#0a0a0b",
            "circle-stroke-width": 2,
          },
        });

        // Jump to the user's location if we can get it.
        navigator.geolocation?.getCurrentPosition(
          (pos) => map.easeTo({ center: [pos.coords.longitude, pos.coords.latitude], zoom: 14 }),
          () => {},
          { enableHighAccuracy: true, timeout: 4000 }
        );

        // --- drag an existing point, or grab the line to insert a new one ---
        function endDrag(map: import("mapbox-gl").Map) {
          map.dragPan.enable();
          map.getCanvas().style.cursor = "";
          const drag = draggingRef.current;
          draggingRef.current = null;
          if (drag) setWaypoints(drag.points);
          // "click" fires right after "mouseup"/touch release in the same
          // gesture — defer clearing the suppress flag so it still applies.
          setTimeout(() => {
            suppressClickRef.current = false;
          }, 0);
        }

        function onDown(
          e: import("mapbox-gl").MapMouseEvent | import("mapbox-gl").MapTouchEvent
        ) {
          if (waypointsRef.current.length === 0) return;
          const tolerance = 12;
          const bbox: [import("mapbox-gl").PointLike, import("mapbox-gl").PointLike] = [
            [e.point.x - tolerance, e.point.y - tolerance],
            [e.point.x + tolerance, e.point.y + tolerance],
          ];
          const pointFeats = queryFeatures(map, bbox, ["draw-points"]);
          const pointFeat = pointFeats.length
            ? pointFeats.reduce((closest, f) => {
                const dist = (feat: QueriedFeature) => {
                  const p = map.project(feat.geometry.coordinates);
                  return Math.hypot(p.x - e.point.x, p.y - e.point.y);
                };
                return dist(f) < dist(closest) ? f : closest;
              })
            : null;
          const lineFeat = pointFeat
            ? null
            : queryFeatures(map, e.point, ["draw-line-hit"])[0];
          if (!pointFeat && !lineFeat) return; // let the normal "tap to append" click through

          e.preventDefault();
          map.dragPan.disable();
          suppressClickRef.current = true;
          map.getCanvas().style.cursor = "grabbing";

          const points = [...waypointsRef.current];
          let index: number;
          if (pointFeat) {
            index = pointFeat.properties.index as number;
          } else {
            if (modeRef.current === "roads" && points.length >= MAX_WAYPOINTS) {
              map.dragPan.enable();
              suppressClickRef.current = false;
              return;
            }
            index = nearestInsertIndex(points, [e.lngLat.lng, e.lngLat.lat]);
            points.splice(index, 0, [e.lngLat.lng, e.lngLat.lat]);
          }
          draggingRef.current = { index, points };
          setLine(map, points);
          setPoints(map, points);

          function onMove(
            ev: import("mapbox-gl").MapMouseEvent | import("mapbox-gl").MapTouchEvent
          ) {
            const drag = draggingRef.current;
            if (!drag) return;
            drag.points[drag.index] = [ev.lngLat.lng, ev.lngLat.lat];
            setLine(map, drag.points);
            setPoints(map, drag.points);
          }
          function onUp() {
            map.off("mousemove", onMove);
            map.off("touchmove", onMove);
            map.off("mouseup", onUp);
            map.off("touchend", onUp);
            map.off("touchcancel", onUp);
            endDrag(map);
          }
          map.on("mousemove", onMove);
          map.on("touchmove", onMove);
          map.on("mouseup", onUp);
          map.on("touchend", onUp);
          map.on("touchcancel", onUp);
        }
        map.on("mousedown", onDown);
        map.on("touchstart", onDown);

        map.on("mouseenter", "draw-points", () => {
          if (!draggingRef.current) map.getCanvas().style.cursor = "grab";
        });
        map.on("mouseenter", "draw-line-hit", () => {
          if (!draggingRef.current) map.getCanvas().style.cursor = "copy";
        });
        map.on("mouseleave", "draw-points", () => {
          if (!draggingRef.current) map.getCanvas().style.cursor = "";
        });
        map.on("mouseleave", "draw-line-hit", () => {
          if (!draggingRef.current) map.getCanvas().style.cursor = "";
        });

        setReady(true);
      });

      map.on("click", (e) => {
        if (suppressClickRef.current) return;
        const pt: LngLat = [e.lngLat.lng, e.lngLat.lat];
        setWaypoints((prev) => {
          if (modeRef.current === "roads" && prev.length >= MAX_WAYPOINTS) return prev;
          return [...prev, pt];
        });
      });
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  // --- recompute the line whenever waypoints or mode change ---
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    setPoints(map, waypoints);

    let cancelled = false;
    async function compute() {
      if (waypoints.length < 2) {
        setLine(map!, waypoints);
        onChange(waypoints, 0);
        return;
      }
      if (modeRef.current === "straight") {
        setLine(map!, waypoints);
        onChange(waypoints, pathLengthMeters(waypoints));
        return;
      }
      // roads: snap through all waypoints
      setRouting(true);
      try {
        const coords = waypoints.map((c) => `${c[0]},${c[1]}`).join(";");
        const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${coords}?geometries=geojson&overview=full&access_token=${MAPBOX_TOKEN}`;
        const res = await fetch(url);
        const data = await res.json();
        if (cancelled) return;
        const route = data?.routes?.[0];
        if (route?.geometry?.coordinates?.length) {
          const path: LngLat[] = route.geometry.coordinates.map(
            (c: number[]) => [c[0], c[1]] as LngLat
          );
          setLine(map!, path);
          onChange(path, route.distance ?? pathLengthMeters(path));
        } else {
          // No road route found — fall back to straight.
          setLine(map!, waypoints);
          onChange(waypoints, pathLengthMeters(waypoints));
        }
      } catch {
        if (!cancelled) {
          setLine(map!, waypoints);
          onChange(waypoints, pathLengthMeters(waypoints));
        }
      } finally {
        if (!cancelled) setRouting(false);
      }
    }
    compute();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waypoints, mode, ready]);

  const undo = useCallback(() => setWaypoints((p) => p.slice(0, -1)), []);
  const clear = useCallback(() => setWaypoints([]), []);

  if (!HAS_MAPBOX) {
    return (
      <div className={clsx("grid place-items-center bg-loop-panel p-6 text-center", className)}>
        <p className="text-sm text-loop-muted">
          Add a Mapbox token (NEXT_PUBLIC_MAPBOX_TOKEN) to draw routes.
        </p>
      </div>
    );
  }

  return (
    <div className={clsx("relative", className)}>
      <div ref={containerRef} className="absolute inset-0" />

      {/* mode toggle */}
      <div className="absolute left-3 top-3 z-10 flex rounded-full border border-loop-line bg-loop-ink/90 p-0.5 backdrop-blur">
        <ModeBtn active={mode === "roads"} onClick={() => setMode("roads")}>
          <RouteIcon className="h-4 w-4" /> Roads
        </ModeBtn>
        <ModeBtn active={mode === "straight"} onClick={() => setMode("straight")}>
          <Spline className="h-4 w-4" /> Straight
        </ModeBtn>
      </div>

      {/* undo / clear */}
      <div className="absolute bottom-3 left-3 z-10 flex gap-2">
        <button
          onClick={undo}
          disabled={waypoints.length === 0}
          className="flex items-center gap-1 rounded-full border border-loop-line bg-loop-ink/90 px-3 py-2 text-sm font-medium text-zinc-200 backdrop-blur disabled:opacity-40"
        >
          <Undo2 className="h-4 w-4" /> Undo
        </button>
        <button
          onClick={clear}
          disabled={waypoints.length === 0}
          className="flex items-center gap-1 rounded-full border border-loop-line bg-loop-ink/90 px-3 py-2 text-sm font-medium text-zinc-200 backdrop-blur disabled:opacity-40"
        >
          <Trash2 className="h-4 w-4" /> Clear
        </button>
      </div>

      {routing && (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-loop-ink/90 px-3 py-2 text-xs text-loop-muted backdrop-blur">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> routing…
        </div>
      )}

      {waypoints.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-10 text-center">
          <span className="rounded-full bg-loop-ink/80 px-4 py-1.5 text-sm text-zinc-200 backdrop-blur">
            Tap the map to start your route
          </span>
        </div>
      )}
      {waypoints.length === 1 && (
        <div className="pointer-events-none absolute inset-x-0 top-16 z-10 text-center">
          <span className="rounded-full bg-loop-ink/80 px-4 py-1.5 text-sm text-zinc-200 backdrop-blur">
            Keep tapping, or drag a point or the line to adjust
          </span>
        </div>
      )}
    </div>
  );
}

function setLine(map: import("mapbox-gl").Map, path: LngLat[]) {
  const src = map.getSource("draw-line") as
    | import("mapbox-gl").GeoJSONSource
    | undefined;
  src?.setData({
    type: "Feature",
    properties: {},
    geometry: { type: "LineString", coordinates: path },
  });
}

function setPoints(map: import("mapbox-gl").Map, points: LngLat[]) {
  const src = map.getSource("draw-points") as
    | import("mapbox-gl").GeoJSONSource
    | undefined;
  src?.setData({
    type: "FeatureCollection",
    features: points.map((c, index) => ({
      type: "Feature",
      properties: { index },
      geometry: { type: "Point", coordinates: c },
    })),
  });
}

/** Index to splice a new waypoint into `points` given where it was dropped —
 * whichever existing segment it's closest to. */
function nearestInsertIndex(points: LngLat[], p: LngLat): number {
  if (points.length < 2) return points.length;
  let bestDist = Infinity;
  let bestIdx = points.length;
  for (let i = 0; i < points.length - 1; i++) {
    const d = pointToSegmentDistSq(p, points[i], points[i + 1]);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i + 1;
    }
  }
  return bestIdx;
}

// Planar approximation (fine at route-drawing scale) — just needs to pick the
// right segment, not measure real-world distance.
function pointToSegmentDistSq(p: LngLat, a: LngLat, b: LngLat): number {
  const [px, py] = p;
  const [ax, ay] = a;
  const [bx, by] = b;
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  const ddx = px - cx;
  const ddy = py - cy;
  return ddx * ddx + ddy * ddy;
}

function ModeBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition",
        active ? "bg-loop-green text-black" : "text-zinc-300"
      )}
    >
      {children}
    </button>
  );
}
