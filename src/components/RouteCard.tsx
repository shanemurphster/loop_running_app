"use client";

import Link from "next/link";
import { MapPin, TrendingUp, BadgeCheck } from "lucide-react";
import clsx from "clsx";
import type { RouteWithStats } from "@/lib/types";
import { useStore } from "@/lib/store";
import { formatDistance, formatElevation } from "@/lib/units";
import { ScoreRing } from "./ScoreRing";
import { RouteTypeBadge } from "./RouteTypeBadge";
import { SaveButton } from "./SaveButton";
import { RouteThumb } from "./RouteThumb";

// The feed card from the mockup: photo, type badge, save + score, then a
// detail strip. `variant="wide"` is the larger Discover hero; "rail" is the
// horizontally-scrolling carousel size.
export function RouteCard({
  route,
  variant = "rail",
}: {
  route: RouteWithStats;
  variant?: "rail" | "wide";
}) {
  const { unit } = useStore();
  return (
    <Link
      href={`/route/${route.id}`}
      className={clsx(
        "group block shrink-0 overflow-hidden rounded-2xl bg-loop-panel ring-1 ring-loop-line/60 transition",
        variant === "rail" ? "w-[300px]" : "w-full"
      )}
    >
      <div className="relative h-44 w-full">
        <RouteThumb
          image={route.image}
          path={route.path}
          alt={route.name}
          sizes="(max-width: 480px) 100vw, 480px"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/20 to-black/30" />

        <div className="absolute left-3 top-3 flex items-center gap-2">
          <RouteTypeBadge type={route.routeType} />
          {route.loopCertified && (
            <span className="flex items-center gap-1 rounded-md bg-loop-green/20 px-2 py-0.5 text-xs font-semibold text-loop-green backdrop-blur-sm">
              <BadgeCheck className="h-3.5 w-3.5" /> Certified
            </span>
          )}
        </div>

        <div className="absolute right-3 top-3 flex items-center gap-2">
          <SaveButton routeId={route.id} />
          <ScoreRing score={route.loopScore} />
        </div>

        <div className="absolute inset-x-0 bottom-0 p-3">
          <h3 className="text-lg font-extrabold leading-tight text-white drop-shadow">
            {route.name}
          </h3>
          <div className="mt-1 flex items-center gap-3 text-sm text-zinc-200">
            <span className="flex items-center gap-1">
              <MapPin className="h-4 w-4 text-loop-green" />
              {route.city}
            </span>
            <span>{formatDistance(route.distanceMi, unit)}</span>
            <span className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4 text-loop-green" />
              {formatElevation(route.elevationFt, unit)}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-1.5 p-3">
        <p className="line-clamp-2 text-sm text-zinc-400">{route.description}</p>
        <div className="flex items-center gap-4 text-xs text-loop-muted">
          <span>{route.ratingCount} ratings</span>
          <span>{route.likeCount} liked</span>
        </div>
      </div>
    </Link>
  );
}
