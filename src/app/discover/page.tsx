"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, Map as MapIcon, List, X } from "lucide-react";
import clsx from "clsx";
import { DiscoverMap } from "@/components/DiscoverMap";
import { RouteCard } from "@/components/RouteCard";
import { ScoreRing } from "@/components/ScoreRing";
import { FilterSheet } from "@/components/FilterSheet";
import { useStore } from "@/lib/store";
import {
  applyFilters,
  countActive,
  DEFAULT_FILTERS,
  type RouteFilters,
} from "@/lib/filters";
import type { City, RouteType } from "@/lib/types";

export default function DiscoverPage() {
  return (
    <Suspense fallback={<div className="p-6 text-loop-muted">Loading…</div>}>
      <DiscoverInner />
    </Suspense>
  );
}

function DiscoverInner() {
  const params = useSearchParams();
  const { routes } = useStore();

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
  const selected = results.find((r) => r.id === selectedId);
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
            className="h-[calc(100vh-220px)] w-full"
          />
          {selected && (
            <div className="absolute inset-x-0 bottom-3 z-10 animate-slide-up px-4">
              <div className="relative">
                <button
                  onClick={() => setSelectedId(undefined)}
                  className="absolute -top-2 right-1 z-10 grid h-7 w-7 place-items-center rounded-full bg-black/70 text-white"
                >
                  <X className="h-4 w-4" />
                </button>
                <Link
                  href={`/route/${selected.id}`}
                  className="flex items-center gap-3 rounded-2xl border border-loop-line bg-loop-panel p-3"
                >
                  <ScoreRing score={selected.loopScore} size={48} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold">{selected.name}</p>
                    <p className="text-sm text-loop-muted">
                      {selected.city} · {selected.distanceMi} mi · {selected.routeType}
                    </p>
                  </div>
                </Link>
              </div>
            </div>
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
