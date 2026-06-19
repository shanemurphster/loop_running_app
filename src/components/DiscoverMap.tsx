"use client";

import { useEffect, useMemo, useRef } from "react";
import { bounds, centroid, projectToSvg } from "@/lib/geo";
import { HAS_MAPBOX, MAP_STYLE, MAPBOX_TOKEN } from "@/lib/mapbox";
import type { RouteWithStats } from "@/lib/types";

interface Props {
  routes: RouteWithStats[];
  selectedId?: string;
  onSelect: (id: string) => void;
  className?: string;
}

// Map of many routes. Mapbox build uses native GeoJSON clustering; the
// token-less fallback projects route centroids onto a grid as tappable pins.
export function DiscoverMap({ routes, selectedId, onSelect, className }: Props) {
  if (!HAS_MAPBOX) {
    return (
      <FallbackMap
        routes={routes}
        selectedId={selectedId}
        onSelect={onSelect}
        className={className}
      />
    );
  }
  return (
    <MapboxMap
      routes={routes}
      selectedId={selectedId}
      onSelect={onSelect}
      className={className}
    />
  );
}

function MapboxMap({ routes, selectedId, onSelect, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<import("mapbox-gl").Map | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const features = useMemo(
    () =>
      routes.map((r) => {
        const c = centroid(r.path);
        return {
          type: "Feature" as const,
          properties: { id: r.id, name: r.name, score: r.loopScore },
          geometry: { type: "Point" as const, coordinates: c },
        };
      }),
    [routes]
  );

  // Init once.
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
        center: features[0]?.geometry.coordinates ?? [-75.16, 39.95],
        zoom: 10,
        attributionControl: false,
      });
      mapRef.current = map;

      map.on("load", () => {
        map.addSource("routes", {
          type: "geojson",
          data: { type: "FeatureCollection", features },
          cluster: true,
          clusterRadius: 45,
        });

        map.addLayer({
          id: "clusters",
          type: "circle",
          source: "routes",
          filter: ["has", "point_count"],
          paint: {
            "circle-color": "#22e06a",
            "circle-opacity": 0.25,
            "circle-radius": ["step", ["get", "point_count"], 18, 5, 24, 10, 30],
            "circle-stroke-color": "#22e06a",
            "circle-stroke-width": 2,
          },
        });
        map.addLayer({
          id: "cluster-count",
          type: "symbol",
          source: "routes",
          filter: ["has", "point_count"],
          layout: {
            "text-field": ["get", "point_count_abbreviated"],
            "text-size": 13,
          },
          paint: { "text-color": "#eafff2" },
        });
        map.addLayer({
          id: "unclustered",
          type: "circle",
          source: "routes",
          filter: ["!", ["has", "point_count"]],
          paint: {
            "circle-color": "#22e06a",
            "circle-radius": 8,
            "circle-stroke-color": "#0a0a0b",
            "circle-stroke-width": 2,
          },
        });

        map.on("click", "unclustered", (e) => {
          const props = (
            e.features?.[0] as { properties?: Record<string, unknown> } | undefined
          )?.properties;
          const id = props?.id;
          if (id) onSelectRef.current(String(id));
        });
        map.on("click", "clusters", (e) => {
          const feature = e.features?.[0] as
            | {
                properties?: Record<string, unknown>;
                geometry?: { coordinates: [number, number] };
              }
            | undefined;
          const clusterId = feature?.properties?.cluster_id as number | undefined;
          const coords = feature?.geometry?.coordinates;
          if (clusterId == null || !coords) return;
          const src = map.getSource("routes") as import("mapbox-gl").GeoJSONSource;
          src.getClusterExpansionZoom(clusterId, (err, zoom) => {
            if (err || zoom == null) return;
            map.easeTo({ center: coords, zoom });
          });
        });
        map.on("mouseenter", "unclustered", () => {
          map.getCanvas().style.cursor = "pointer";
        });
        map.on("mouseleave", "unclustered", () => {
          map.getCanvas().style.cursor = "";
        });
      });
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update source data + fit bounds when the route set changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource("routes") as
        | import("mapbox-gl").GeoJSONSource
        | undefined;
      if (!src) return;
      src.setData({ type: "FeatureCollection", features });
      if (features.length) {
        const all = features.map((f) => f.geometry.coordinates);
        const b = bounds(all as [number, number][]);
        map.fitBounds(
          [
            [b.minLng, b.minLat],
            [b.maxLng, b.maxLat],
          ],
          { padding: 60, maxZoom: 13, duration: 500 }
        );
      }
    };
    if (map.isStyleLoaded()) apply();
    else map.once("idle", apply);
  }, [features]);

  return <div ref={ref} className={className} />;
}

function FallbackMap({ routes, selectedId, onSelect, className }: Props) {
  const W = 360;
  const H = 460;
  const centroids = routes.map((r) => centroid(r.path));
  const pts = centroids.length
    ? projectToSvg(centroids, W, H, 36)
    : [];

  return (
    <div className={className}>
      <div className="relative h-full w-full overflow-hidden bg-[#101012]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-full w-full"
          preserveAspectRatio="xMidYMid slice"
        >
          <defs>
            <pattern id="dgrid" width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M28 0 L0 0 0 28" fill="none" stroke="#1a1a1e" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width={W} height={H} fill="#101012" />
          <rect width={W} height={H} fill="url(#dgrid)" />
          {pts.map(([x, y], i) => {
            const r = routes[i];
            const active = r.id === selectedId;
            return (
              <g
                key={r.id}
                transform={`translate(${x},${y})`}
                className="cursor-pointer"
                onClick={() => onSelect(r.id)}
              >
                <circle
                  r={active ? 11 : 8}
                  fill="#22e06a"
                  stroke="#0a0a0b"
                  strokeWidth={2}
                  opacity={active ? 1 : 0.85}
                />
                {active && (
                  <text
                    y={-16}
                    textAnchor="middle"
                    fontSize="11"
                    fill="#eafff2"
                    fontWeight="600"
                  >
                    {r.name}
                  </text>
                )}
              </g>
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
