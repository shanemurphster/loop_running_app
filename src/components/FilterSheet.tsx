"use client";

import { X } from "lucide-react";
import clsx from "clsx";
import { CITIES, ROUTE_TYPES, type RouteFilters } from "@/lib/filters";
import { POSITIVE_TAGS } from "@/lib/tags";
import type { City, RouteType } from "@/lib/types";

// Slide-up sheet exposing every filter. Mutates a draft via setFilters.
export function FilterSheet({
  filters,
  setFilters,
  onClose,
  resultCount,
}: {
  filters: RouteFilters;
  setFilters: (f: RouteFilters) => void;
  onClose: () => void;
  resultCount: number;
}) {
  function toggleType(t: RouteType) {
    setFilters({
      ...filters,
      types: filters.types.includes(t)
        ? filters.types.filter((x) => x !== t)
        : [...filters.types, t],
    });
  }
  function toggleTag(id: string) {
    setFilters({
      ...filters,
      tags: filters.tags.includes(id)
        ? filters.tags.filter((x) => x !== id)
        : [...filters.tags, id],
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button className="absolute inset-0 bg-black/70 animate-fade-in" onClick={onClose} />
      <div className="relative z-10 max-h-[85vh] w-full max-w-app animate-slide-up overflow-y-auto rounded-t-3xl border-t border-loop-line bg-loop-panel p-5 pb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Filters</h2>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-loop-panel2 text-loop-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <Group label="City">
          <Chip active={filters.city === "all"} onClick={() => setFilters({ ...filters, city: "all" })}>
            All
          </Chip>
          {CITIES.map((c: City) => (
            <Chip key={c} active={filters.city === c} onClick={() => setFilters({ ...filters, city: c })}>
              {c}
            </Chip>
          ))}
        </Group>

        <Group label="Route type">
          {ROUTE_TYPES.map((t) => (
            <Chip key={t} active={filters.types.includes(t)} onClick={() => toggleType(t)}>
              {t}
            </Chip>
          ))}
        </Group>

        <div className="mb-5">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold text-zinc-300">Max distance</p>
            <span className="text-sm text-loop-green">
              {filters.maxDistance >= 30 ? "Any" : `${filters.maxDistance} mi`}
            </span>
          </div>
          <input
            type="range"
            min={1}
            max={30}
            step={1}
            value={filters.maxDistance}
            onChange={(e) =>
              setFilters({ ...filters, maxDistance: Number(e.target.value) })
            }
            className="w-full accent-loop-green"
          />
        </div>

        <Group label="Must have">
          {POSITIVE_TAGS.map((t) => (
            <Chip key={t.id} active={filters.tags.includes(t.id)} onClick={() => toggleTag(t.id)}>
              {t.emoji} {t.label}
            </Chip>
          ))}
        </Group>

        <label className="mb-5 flex items-center justify-between rounded-xl border border-loop-line bg-loop-panel2 px-4 py-3">
          <span className="text-sm font-medium text-zinc-200">
            Loop Certified only
          </span>
          <input
            type="checkbox"
            checked={filters.certifiedOnly}
            onChange={(e) =>
              setFilters({ ...filters, certifiedOnly: e.target.checked })
            }
            className="h-5 w-5 accent-loop-green"
          />
        </label>

        <button
          onClick={onClose}
          className="w-full rounded-xl bg-loop-green py-3 font-bold text-black"
        >
          Show {resultCount} {resultCount === 1 ? "route" : "routes"}
        </button>
      </div>
    </div>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <p className="mb-2 text-sm font-semibold text-zinc-300">{label}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function Chip({
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
        "rounded-full border px-3 py-1.5 text-sm transition",
        active
          ? "border-loop-green bg-loop-green/15 text-loop-green"
          : "border-loop-line bg-loop-panel2 text-zinc-300"
      )}
    >
      {children}
    </button>
  );
}
