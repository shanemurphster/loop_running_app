"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Undo2, Trash2, Route as RouteIcon, Spline, Loader2 } from "lucide-react";
import clsx from "clsx";
import { HAS_MAPBOX, MAP_STYLE, MAPBOX_TOKEN } from "@/lib/mapbox";
import { pathLengthMeters } from "@/lib/units";
import type { LngLat } from "@/lib/types";

type Mode = "roads" | "straight";

// OnTheGoMap-style route drawing. Tap to drop waypoints; the line either snaps
// to real roads/paths (Mapbox Directions, walking) or connects straight. The
// resulting geometry + distance are reported up via onChange.
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
            "circle-radius": 5,
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
        setReady(true);
      });

      map.on("click", (e) => {
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

    // waypoint dots
    const pointsData = {
      type: "FeatureCollection" as const,
      features: waypoints.map((c) => ({
        type: "Feature" as const,
        properties: {},
        geometry: { type: "Point" as const, coordinates: c },
      })),
    };
    (map.getSource("draw-points") as import("mapbox-gl").GeoJSONSource)?.setData(
      pointsData
    );

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
