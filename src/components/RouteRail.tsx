import Link from "next/link";
import { ChevronRight, MapPin } from "lucide-react";
import type { RouteWithStats } from "@/lib/types";
import { RouteCard } from "./RouteCard";

// A titled, horizontally-scrolling row of route cards (the home feed sections).
export function RouteRail({
  title,
  location,
  routes,
  seeAllHref,
}: {
  title: string;
  location?: string;
  routes: RouteWithStats[];
  seeAllHref?: string;
}) {
  if (routes.length === 0) return null;
  return (
    <section className="mt-6">
      <div className="flex items-end justify-between px-4">
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          {location && (
            <p className="flex items-center gap-1 text-sm text-loop-muted">
              <MapPin className="h-3.5 w-3.5" />
              {location}
            </p>
          )}
        </div>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="flex items-center gap-0.5 text-sm font-semibold text-loop-green"
          >
            See all <ChevronRight className="h-4 w-4" />
          </Link>
        )}
      </div>

      <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-4 pb-1">
        {routes.map((r) => (
          <RouteCard key={r.id} route={r} variant="rail" />
        ))}
      </div>
    </section>
  );
}
