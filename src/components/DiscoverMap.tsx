"use client";

import { useEffect, useMemo, useRef } from "react";
import { bounds, centroid, projectToSvg } from "@/lib/geo";
import { HAS_MAPBOX, MAP_STYLE, MAPBOX_TOKEN } from "@/lib/mapbox";
import type { LngLat, RouteWithStats } from "@/lib/types";

interface Props {
  routes: RouteWithStats[];
  selectedId?: string;
  onSelect: (id: string) => void;
  className?: string;
}

// Map of many routes. Each route is drawn as its full outline; dense areas
// collapse into a numbered cluster bubble. Selecting a route highlights its
// line and frames it.
export function DiscoverMap(props: Props) {
  if (!HAS_MAPBOX) return <FallbackMap {...props} />;
  return <MapboxMap {...props} />;
}

function lineFeature(r: RouteWithStats) {
  return {
    type: "Feature" as const,
    properties: { id: r.id },
    geometry: { type: "LineString" as const, coordinates: r.path },
  };
}

function MapboxMap({ routes, selectedId, onSelect, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("mapbox-gl").Map | null>(null);
  const loadedRef = useRef(false);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const linesFC = useMemo(
    () => ({ type: "FeatureCollection" as const, features: routes.map(lineFeature) }),
    [routes]
  );
  const pointsFC = useMemo(
    () => ({
      type: "FeatureCollection" as const,
      features: routes.map((r) => ({
        type: "Feature" as const,
        properties: { id: r.id },
        geometry: { type: "Point" as const, coordinates: centroid(r.path) },
      })),
    }),
    [routes]
  );

  // init once
  useEffect(() => {
    if (!ref.current) return;
    let cancelled = false;
    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !ref.current) return;
      mapboxgl.accessToken = MAPBOX_TOKEN;
      const map = new mapboxgl.Map({
        container: ref.current,
        style: MAP_STYLE,
        center: [-75.16, 39.95],
        zoom: 10,
        attributionControl: false,
      });
      mapRef.current = map;

      map.on("load", () => {
        map.addSource("routes-lines", { type: "geojson", data: linesFC });
        map.addSource("selected-line", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });
        map.addSource("routes-points", {
          type: "geojson",
          data: pointsFC,
          cluster: true,
          clusterRadius: 48,
          clusterMaxZoom: 14,
        });

        // all route outlines
        map.addLayer({
          id: "routes-lines",
          type: "line",
          source: "routes-lines",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#22e06a", "line-width": 2.5, "line-opacity": 0.5 },
        });
        // highlighted selection
        map.addLayer({
          id: "selected-line",
          type: "line",
          source: "selected-line",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: { "line-color": "#22e06a", "line-width": 5, "line-opacity": 1 },
        });
        // cluster bubbles
        map.addLayer({
          id: "clusters",
          type: "circle",
          source: "routes-points",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#0a0a0b",
            "circle-stroke-color": "#22e06a",
            "circle-stroke-width": 2,
            "circle-radius": ["step", ["get", "point_count"], 16, 5, 20, 15, 26],
          },
        });
        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "routes-points",
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-size": 13,
          },
          paint: { "text-color": "#22e06a" },
        });
        // lone (unclustered) routes get a small dot handle
        map.addLayer({
          id: "unclustered",
          type: "circle",
          source: "routes-points",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": "#22e06a",
            "circle-radius": 5,
            "circle-stroke-color": "#0a0a0b",
            "circle-stroke-width": 2,
          },
        });

        // Single click/tap handler that queries a PADDED box around the point,
        // so imprecise touches near a thin line or small dot still register on
        // mobile (per-layer click handlers only fire on a pixel-perfect hit).
        map.on("click", (e) => {
          const pad = 12;
          const box: [[number, number], [number, number]] = [
            [e.point.x - pad, e.point.y - pad],
            [e.point.x + pad, e.point.y + pad],
          ];
          const feats = map.queryRenderedFeatures(box, {
            layers: ["clusters", "unclustered", "routes-lines"],
          });
          if (!feats.length) return;

          const cluster = feats.find((f) => f.layer?.id === "clusters") as
            | {
                properties?: { cluster_id?: number };
                geometry?: { coordinates?: [number, number] };
              }
            | undefined;
          if (cluster) {
            const clusterId = cluster.properties?.cluster_id;
            const coords = cluster.geometry?.coordinates;
            if (clusterId == null || !coords) return;
            const src = map.getSource("routes-points") as import("mapbox-gl").GeoJSONSource;
            src.getClusterExpansionZoom(clusterId, (err, zoom) => {
              if (err || zoom == null) return;
              map.easeTo({ center: coords, zoom });
            });
            return;
          }

          const routeFeat = feats.find(
            (f) => f.layer?.id === "unclustered" || f.layer?.id === "routes-lines"
          ) as { properties?: { id?: string } } | undefined;
          const id = routeFeat?.properties?.id;
          if (id) onSelectRef.current(String(id));
        });
        for (const layer of ["routes-lines", "unclustered", "clusters"]) {
          map.on("mouseenter", layer, () => (map.getCanvas().style.cursor = "pointer"));
          map.on("mouseleave", layer, () => (map.getCanvas().style.cursor = ""));
        }

        loadedRef.current = true;
        fitAll(map, routes);
      });
    })();
    return () => {
      cancelled = true;
      loadedRef.current = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // update data when the route set changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    (map.getSource("routes-lines") as import("mapbox-gl").GeoJSONSource)?.setData(linesFC);
    (map.getSource("routes-points") as import("mapbox-gl").GeoJSONSource)?.setData(pointsFC);
    if (!selectedId) fitAll(map, routes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linesFC, pointsFC]);

  // highlight + frame the selected route
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const sel = routes.find((r) => r.id === selectedId);
    const src = map.getSource("selected-line") as
      | import("mapbox-gl").GeoJSONSource
      | undefined;
    if (!sel) {
      src?.setData({ type: "FeatureCollection", features: [] });
      return;
    }
    src?.setData(lineFeature(sel));
    const b = bounds(sel.path);
    map.fitBounds(
      [
        [b.minLng, b.minLat],
        [b.maxLng, b.maxLat],
      ],
      { padding: 80, maxZoom: 15, duration: 500 }
    );
  }, [selectedId, routes]);

  return <div ref={ref} className={className} />;
}

function fitAll(map: import("mapbox-gl").Map, routes: RouteWithStats[]) {
  const all: LngLat[] = routes.flatMap((r) => r.path);
  if (all.length === 0) return;
  const b = bounds(all);
  map.fitBounds(
    [
      [b.minLng, b.minLat],
      [b.maxLng, b.maxLat],
    ],
    { padding: 50, maxZoom: 13, duration: 400 }
  );
}

// Token-less fallback: project every route's line into an SVG box; tap to select.
function FallbackMap({ routes, selectedId, onSelect, className }: Props) {
  const W = 360;
  const H = 460;
  const all = routes.flatMap((r) => r.path);
  const projAll = all.length ? projectToSvg(all, W, H, 28) : [];
  // rebuild per-route by walking the flattened projection in order
  let idx = 0;
  const perRoute = routes.map((r) => {
    const pts = projAll.slice(idx, idx + r.path.length);
    idx += r.path.length;
    return { id: r.id, pts };
  });

  return (
    <div className={className}>
      <div className="relative h-full w-full overflow-hidden bg-[#101012]">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" preserveAspectRatio="xMidYMid slice">
          <rect width={W} height={H} fill="#101012" />
          {perRoute.map((r) => {
            const active = r.id === selectedId;
            const d = r.pts
              .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
              .join(" ");
            return (
              <path
                key={r.id}
                d={d}
                fill="none"
                stroke="#22e06a"
                strokeWidth={active ? 4 : 2}
                strokeOpacity={active ? 1 : 0.5}
                className="cursor-pointer"
                onClick={() => onSelect(r.id)}
              />
            );
          })}
        </svg>
        <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-1 text-[10px] text-loop-muted">
          Add a Mapbox token for the live map
        </div>
      </div>
    </div>
  );
}
