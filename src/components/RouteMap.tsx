"use client";

import { useEffect, useRef } from "react";
import { bounds } from "@/lib/geo";
import { HAS_MAPBOX, MAP_STYLE, MAPBOX_TOKEN } from "@/lib/mapbox";
import type { LngLat } from "@/lib/types";
import { MiniRoute } from "./MiniRoute";

// Renders a single route. Uses Mapbox GL when a token is present, otherwise
// falls back to the SVG MiniRoute so the app is fully usable with no setup.
export function RouteMap({
  path,
  className,
  interactive = true,
}: {
  path: LngLat[];
  className?: string;
  interactive?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!HAS_MAPBOX || !containerRef.current) return;
    let map: import("mapbox-gl").Map | undefined;
    let cancelled = false;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      if (cancelled || !containerRef.current) return;
      mapboxgl.accessToken = MAPBOX_TOKEN;

      const b = bounds(path);
      map = new mapboxgl.Map({
        container: containerRef.current,
        style: MAP_STYLE,
        bounds: [
          [b.minLng, b.minLat],
          [b.maxLng, b.maxLat],
        ],
        fitBoundsOptions: { padding: 40 },
        interactive,
        attributionControl: false,
      });

      map.on("load", () => {
        if (!map) return;
        map.addSource("route", {
          type: "geojson",
          data: {
            type: "Feature",
            properties: {},
            geometry: { type: "LineString", coordinates: path },
          },
        });
        map.addLayer({
          id: "route-line",
          type: "line",
          source: "route",
          layout: { "line-cap": "round", "line-join": "round" },
          paint: {
            "line-color": "#22e06a",
            "line-width": 4,
            "line-opacity": 0.95,
          },
        });
        // Start marker
        new mapboxgl.Marker({ color: "#22e06a" })
          .setLngLat(path[0])
          .addTo(map);
      });
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
    // path is stable per route id; we intentionally only re-init on identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path]);

  if (!HAS_MAPBOX) {
    return <MiniRoute path={path} className={className} width={400} height={260} />;
  }

  return <div ref={containerRef} className={className} />;
}
