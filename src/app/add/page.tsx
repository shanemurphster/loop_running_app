"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Sparkles, Upload, PencilLine, Watch } from "lucide-react";
import clsx from "clsx";
import { useStore } from "@/lib/store";
import { CITY_CENTERS, makeLoop } from "@/lib/geo";
import { CITIES, ROUTE_TYPES, SURFACES, FLATNESS } from "@/lib/filters";

export default function AddRoutePage() {
  const router = useRouter();
  const { addRoute, currentUser } = useStore();

  const [name, setName] = useState("");
  const [city, setCity] = useState<string>(currentUser.city || CITIES[0]);
  const [routeType, setRouteType] = useState<string>("Easy");
  const [surface, setSurface] = useState<string>("Paved");
  const [flatness, setFlatness] = useState<string>("Flat");
  const [distance, setDistance] = useState("5");
  const [elevation, setElevation] = useState("50");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const canSubmit = name.trim().length > 1 && Number(distance) > 0 && !saving;

  async function submit() {
    if (!canSubmit) return;
    setSaving(true);
    const dist = Number(distance);
    const center = CITY_CENTERS[city]?.center ?? [-75.1652, 39.9526];
    // No map drawing yet — fabricate a placeholder loop. The follow-roads
    // drawing flow (next milestone) replaces this with real geometry.
    const id = await addRoute({
      name: name.trim(),
      description: description.trim() || "A new route on Loop.",
      city,
      routeType,
      surface,
      flatness,
      distanceMi: dist,
      elevationFt: Number(elevation) || 0,
      path: makeLoop(center, dist, Math.floor(dist * 7) + 3),
    });
    setSaving(false);
    if (id) router.push(`/route/${id}`);
  }

  return (
    <div className="px-4 pb-10">
      <header className="flex items-center gap-3 pb-2 pt-5">
        <button
          onClick={() => router.back()}
          className="grid h-9 w-9 place-items-center rounded-full bg-loop-panel"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold">Add a route</h1>
      </header>

      {/* Import options — wired up in later milestones */}
      <div className="mt-2 grid grid-cols-3 gap-2">
        <ImportTile icon={Sparkles} label="Auto-discover" href="/add/discover" />
        <ImportTile icon={Upload} label="Upload GPX" soon />
        <ImportTile icon={Watch} label="Strava / Garmin" soon />
      </div>
      <div className="mt-3 flex items-center gap-2 text-sm text-loop-muted">
        <PencilLine className="h-4 w-4" /> Or enter it manually
      </div>

      <div className="mt-4 space-y-4">
        <Field label="Route name">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Riverside Morning Loop"
            className="input"
          />
        </Field>

        <Field label="City">
          <div className="flex flex-wrap gap-2">
            {CITIES.map((c) => (
              <Pill key={c} active={city === c} onClick={() => setCity(c)}>
                {c}
              </Pill>
            ))}
          </div>
        </Field>

        <Field label="Route type">
          <div className="flex flex-wrap gap-2">
            {ROUTE_TYPES.map((t) => (
              <Pill key={t} active={routeType === t} onClick={() => setRouteType(t)}>
                {t}
              </Pill>
            ))}
          </div>
        </Field>

        <Field label="Surface">
          <div className="flex flex-wrap gap-2">
            {SURFACES.map((s) => (
              <Pill key={s} active={surface === s} onClick={() => setSurface(s)}>
                {s}
              </Pill>
            ))}
          </div>
        </Field>

        <Field label="How flat?">
          <div className="flex flex-wrap gap-2">
            {FLATNESS.map((f) => (
              <Pill key={f} active={flatness === f} onClick={() => setFlatness(f)}>
                {f}
              </Pill>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Distance (mi)">
            <input
              type="number"
              inputMode="decimal"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Elevation (ft)">
            <input
              type="number"
              inputMode="numeric"
              value={elevation}
              onChange={(e) => setElevation(e.target.value)}
              className="input"
            />
          </Field>
        </div>

        <Field label="Description">
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="What makes this route worth running?"
            className="input resize-none"
          />
        </Field>

        <button
          disabled={!canSubmit}
          onClick={submit}
          className={clsx(
            "w-full rounded-xl py-3.5 font-bold transition",
            canSubmit
              ? "bg-loop-green text-black active:scale-[0.98]"
              : "cursor-not-allowed bg-loop-panel2 text-loop-muted"
          )}
        >
          {saving ? "Publishing…" : "Publish route"}
        </button>
      </div>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #2a2a30;
          background: #1c1c20;
          padding: 0.75rem;
          font-size: 0.875rem;
          outline: none;
        }
        .input::placeholder {
          color: #8a8a93;
        }
        .input:focus {
          border-color: #8a8a93;
        }
      `}</style>
    </div>
  );
}

function ImportTile({
  icon: Icon,
  label,
  soon,
  href,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  soon?: boolean;
  href?: string;
}) {
  const inner = (
    <>
      <Icon className="h-6 w-6 text-loop-green" />
      <span className="text-xs font-medium text-zinc-300">{label}</span>
      {soon && (
        <span className="absolute right-1.5 top-1.5 rounded bg-loop-panel2 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-loop-muted">
          Soon
        </span>
      )}
    </>
  );
  const className =
    "relative flex flex-col items-center gap-2 rounded-2xl border border-loop-line bg-loop-panel py-4 transition active:scale-[0.98]";
  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }
  return <div className={className}>{inner}</div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-zinc-300">
        {label}
      </span>
      {children}
    </label>
  );
}

function Pill({
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
      type="button"
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
