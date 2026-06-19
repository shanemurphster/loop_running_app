import { projectToSvg } from "@/lib/geo";
import type { LngLat } from "@/lib/types";

// Dependency-free SVG rendering of a route's geometry. Used as the map
// fallback when no Mapbox token is configured, and as a lightweight glyph.
export function MiniRoute({
  path,
  width = 320,
  height = 200,
  className,
  strokeWidth = 3,
}: {
  path: LngLat[];
  width?: number;
  height?: number;
  className?: string;
  strokeWidth?: number;
}) {
  const pts = projectToSvg(path, width, height, 16);
  const d = pts
    .map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const start = pts[0];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <pattern id="grid" width="22" height="22" patternUnits="userSpaceOnUse">
          <path
            d="M22 0 L0 0 0 22"
            fill="none"
            stroke="#1c1c20"
            strokeWidth="1"
          />
        </pattern>
      </defs>
      <rect width={width} height={height} fill="#101012" />
      <rect width={width} height={height} fill="url(#grid)" />
      <path
        d={d}
        fill="none"
        stroke="#22e06a"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        opacity="0.95"
      />
      {start && (
        <circle cx={start[0]} cy={start[1]} r={strokeWidth + 2} fill="#22e06a" />
      )}
    </svg>
  );
}
