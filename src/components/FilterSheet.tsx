"use client";

import { X, RotateCcw } from "lucide-react";
import clsx from "clsx";
import {
  CITIES,
  ROUTE_TYPES,
  SURFACES,
  FLATNESS,
  MAX_DISTANCE,
  MAX_ELEVATION,
  DEFAULT_FILTERS,
  type RouteFilters,
} from "@/lib/filters";
import { POSITIVE_TAGS } from "@/lib/tags";
import type { City } from "@/lib/types";

type ArrayField = "types" | "surfaces" | "flatness" | "tags";

const SORTS: { id: RouteFilters["sort"]; label: string }[] = [
  { id: "score", label: "Top rated" },
  { id: "distance", label: "Shortest" },
  { id: "newest", label: "Newest" },
];

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
  function toggle(field: ArrayField, value: string) {
    const arr = filters[field];
    setFilters({
      ...filters,
      [field]: arr.includes(value)
        ? arr.filter((x) => x !== value)
        : [...arr, value],
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button className="absolute inset-0 bg-black/70 animate-fade-in" onClick={onClose} />
      <div className="relative z-10 max-h-[88vh] w-full max-w-app animate-slide-up overflow-y-auto rounded-t-3xl border-t border-loop-line bg-loop-panel p-5 pb-8">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-bold">Filters</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilters({ ...DEFAULT_FILTERS, query: filters.query })}
              className="flex items-center gap-1 rounded-full bg-loop-panel2 px-3 py-1.5 text-xs font-medium text-loop-muted"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
            <button
              onClick={onClose}
              className="grid h-8 w-8 place-items-center rounded-full bg-loop-panel2 text-loop-muted"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <Group label="Sort by">
          {SORTS.map((s) => (
            <Chip
              key={s.id}
              active={filters.sort === s.id}
              onClick={() => setFilters({ ...filters, sort: s.id })}
            >
              {s.label}
            </Chip>
          ))}
        </Group>

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
            <Chip key={t} active={filters.types.includes(t)} onClick={() => toggle("types", t)}>
              {t}
            </Chip>
          ))}
        </Group>

        <Group label="Surface">
          {SURFACES.map((s) => (
            <Chip key={s} active={filters.surfaces.includes(s)} onClick={() => toggle("surfaces", s)}>
              {s}
            </Chip>
          ))}
        </Group>

        <Group label="How flat">
          {FLATNESS.map((f) => (
            <Chip key={f} active={filters.flatness.includes(f)} onClick={() => toggle("flatness", f)}>
              {f}
            </Chip>
          ))}
        </Group>

        <Slider
          label="Min distance"
          value={filters.minDistance}
          min={0}
          max={MAX_DISTANCE}
          display={filters.minDistance <= 0 ? "Any" : `${filters.minDistance} mi`}
          onChange={(v) =>
            setFilters({
              ...filters,
              minDistance: Math.min(v, filters.maxDistance),
            })
          }
        />
        <Slider
          label="Max distance"
          value={filters.maxDistance}
          min={1}
          max={MAX_DISTANCE}
          display={filters.maxDistance >= MAX_DISTANCE ? "Any" : `${filters.maxDistance} mi`}
          onChange={(v) =>
            setFilters({
              ...filters,
              maxDistance: Math.max(v, filters.minDistance),
            })
          }
        />
        <Slider
          label="Max elevation gain"
          value={filters.maxElevation}
          min={0}
          max={MAX_ELEVATION}
          step={50}
          display={filters.maxElevation >= MAX_ELEVATION ? "Any" : `${filters.maxElevation} ft`}
          onChange={(v) => setFilters({ ...filters, maxElevation: v })}
        />

        <Group label="Must have">
          {POSITIVE_TAGS.map((t) => (
            <Chip key={t.id} active={filters.tags.includes(t.id)} onClick={() => toggle("tags", t.id)}>
              {t.emoji} {t.label}
            </Chip>
          ))}
        </Group>

        <label className="mb-5 flex items-center justify-between rounded-xl border border-loop-line bg-loop-panel2 px-4 py-3">
          <span className="text-sm font-medium text-zinc-200">Loop Certified only</span>
          <input
            type="checkbox"
            checked={filters.certifiedOnly}
            onChange={(e) => setFilters({ ...filters, certifiedOnly: e.target.checked })}
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

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-zinc-300">{label}</p>
        <span className="text-sm text-loop-green">{display}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-loop-green"
      />
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
