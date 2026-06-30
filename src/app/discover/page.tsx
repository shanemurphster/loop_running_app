"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, Map as MapIcon, List, X } from "lucide-react";
import clsx from "clsx";
import { DiscoverMap } from "@/components/DiscoverMap";
import { RouteCard } from "@/components/RouteCard";
import { ScoreRing } from "@/components/ScoreRing";
import { FilterSheet } from "@/components/FilterSheet";
import { useStore } from "@/lib/store";
import { formatDistance } from "@/lib/units";
import {
  applyFilters,
  countActive,
  DEFAULT_FILTERS,
  type RouteFilters,
} from "@/lib/filters";
import type { City, RouteType, RouteWithStats } from "@/lib/types";

export default function DiscoverPage() {
  return (
    <Suspense fallback={<div className="p-6 text-loop-muted">Loading…</div>}>
      <DiscoverInner />
    </Suspense>
  );
}

function DiscoverInner() {
  const params = useSearchParams();
  const { routes, unit } = useStore();

  const [filters, setFilters] = useState<RouteFilters>(() => ({
    ...DEFAULT_FILTERS,
    city: (params.get("city") as City) ?? "all",
    types: params.get("type") ? [params.get("type") as RouteType] : [],
    certifiedOnly: params.get("certified") === "1",
  }));
  const [view, setView] = useState<"map" | "list">("map");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>();

  const results = useMemo(() => applyFilters(routes, filters), [routes, filters]);
  const activeCount = countActive(filters);

  return (
    <div>
      {/* Search + controls */}
      <div className="sticky top-0 z-30 space-y-3 border-b border-loop-line bg-loop-ink/95 px-4 pb-3 pt-5 backdrop-blur">
        <div className="flex items-center gap-2">
          <div className="flex flex-1 items-center gap-2 rounded-full border border-loop-line bg-loop-panel px-4 py-2.5">
            <Search className="h-4 w-4 text-loop-muted" />
            <input
              value={filters.query}
              onChange={(e) => setFilters({ ...filters, query: e.target.value })}
              placeholder="Search routes, cities…"
              className="w-full bg-transparent text-sm outline-none placeholder:text-loop-muted"
            />
            {filters.query && (
              <button onClick={() => setFilters({ ...filters, query: "" })}>
                <X className="h-4 w-4 text-loop-muted" />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(true)}
            className="relative grid h-11 w-11 place-items-center rounded-full border border-loop-line bg-loop-panel"
          >
            <SlidersHorizontal className="h-5 w-5 text-zinc-200" />
            {activeCount > 0 && (
              <span className="absolute -right-1 -top-1 grid h-5 w-5 place-items-center rounded-full bg-loop-green text-[11px] font-bold text-black">
                {activeCount}
              </span>
            )}
          </button>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-sm text-loop-muted">
            {results.length} {results.length === 1 ? "route" : "routes"}
          </p>
          <div className="flex rounded-full border border-loop-line bg-loop-panel p-0.5">
            <ViewToggle active={view === "map"} onClick={() => setView("map")}>
              <MapIcon className="h-4 w-4" /> Map
            </ViewToggle>
            <ViewToggle active={view === "list"} onClick={() => setView("list")}>
              <List className="h-4 w-4" /> List
            </ViewToggle>
          </div>
        </div>
      </div>

      {view === "map" ? (
        <div className="relative">
          <DiscoverMap
            routes={results}
            selectedId={selectedId}
            onSelect={setSelectedId}
            className="h-[calc(100vh-200px)] w-full"
          />
          {results.length === 0 ? (
            <div className="absolute inset-x-0 bottom-4 z-10 px-4 text-center">
              <p className="inline-block rounded-xl bg-loop-ink/85 px-3 py-2 text-sm text-loop-muted backdrop-blur">
                No routes match these filters.
              </p>
            </div>
          ) : (
            <MapCarousel
              routes={results}
              selectedId={selectedId}
              onSelect={setSelectedId}
              unit={unit}
            />
          )}
        </div>
      ) : (
        <div className="space-y-4 p-4">
          {results.length === 0 && (
            <p className="py-12 text-center text-sm text-loop-muted">
              No routes match these filters.
            </p>
          )}
          {results.map((r) => (
            <RouteCard key={r.id} route={r} variant="wide" />
          ))}
        </div>
      )}

      {showFilters && (
        <FilterSheet
          filters={filters}
          setFilters={setFilters}
          onClose={() => setShowFilters(false)}
          resultCount={results.length}
        />
      )}
    </div>
  );
}

// Horizontal carousel over the map. Tapping a card highlights its route; when
// selection changes (from a map tap), the matching card scrolls into view.
function MapCarousel({
  routes,
  selectedId,
  onSelect,
  unit,
}: {
  routes: RouteWithStats[];
  selectedId?: string;
  onSelect: (id: string) => void;
  unit: "mi" | "km";
}) {
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    if (selectedId && cardRefs.current[selectedId]) {
      cardRefs.current[selectedId]!.scrollIntoView({
        behavior: "smooth",
        inline: "center",
        block: "nearest",
      });
    }
  }, [selectedId]);

  return (
    <div className="no-scrollbar absolute inset-x-0 bottom-3 z-10 flex gap-3 overflow-x-auto px-4 pb-1">
      {routes.map((r) => (
        <div
          key={r.id}
          ref={(el) => {
            cardRefs.current[r.id] = el;
          }}
          onClick={() => onSelect(r.id)}
          className={clsx(
            "flex w-[260px] shrink-0 cursor-pointer items-center gap-3 rounded-2xl border bg-loop-panel p-3 transition",
            selectedId === r.id ? "border-loop-green" : "border-loop-line"
          )}
        >
          <ScoreRing score={r.loopScore} size={44} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold">{r.name}</p>
            <p className="truncate text-sm text-loop-muted">
              {r.city} · {formatDistance(r.distanceMi, unit)} · {r.routeType}
            </p>
          </div>
          <Link
            href={`/route/${r.id}`}
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 text-xs font-semibold text-loop-green"
          >
            Open
          </Link>
        </div>
      ))}
    </div>
  );
}

function ViewToggle({
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
