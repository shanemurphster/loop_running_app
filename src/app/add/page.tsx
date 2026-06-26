"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MapPin } from "lucide-react";
import clsx from "clsx";
import { useStore } from "@/lib/store";
import { RouteDraw } from "@/components/RouteDraw";
import { MiniRoute } from "@/components/MiniRoute";
import { ROUTE_TYPES, SURFACES, FLATNESS } from "@/lib/filters";
import {
  formatDistance,
  formatElevation,
  metersToMiles,
  metersToFeet,
} from "@/lib/units";
import { elevationGainMeters } from "@/lib/elevation";
import { MAPBOX_TOKEN, HAS_MAPBOX } from "@/lib/mapbox";
import type { LngLat } from "@/lib/types";

export default function AddRoutePage() {
  const router = useRouter();
  const { addRoute, currentUser, unit, isGuest, openAuthPrompt } = useStore();

  const [step, setStep] = useState<"draw" | "details">("draw");
  const [path, setPath] = useState<LngLat[]>([]);
  const [distanceM, setDistanceM] = useState(0);
  const [elevationM, setElevationM] = useState(0);
  const [elevLoading, setElevLoading] = useState(false);

  const [name, setName] = useState("");
  const [city, setCity] = useState(currentUser.city || "");
  const [routeType, setRouteType] = useState("Easy");
  const [surface, setSurface] = useState("Paved");
  const [flatness, setFlatness] = useState("Flat");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const canContinue = path.length >= 2 && distanceM > 0;
  const canPublish = canContinue && name.trim().length > 1 && !saving;

  // Reverse-geocode the start point to prefill the city (editable).
  useEffect(() => {
    if (step !== "details" || city || !HAS_MAPBOX || path.length === 0) return;
    const [lng, lat] = path[0];
    fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${lng},${lat}.json?types=place&access_token=${MAPBOX_TOKEN}`
    )
      .then((r) => r.json())
      .then((d) => {
        const place = d?.features?.[0]?.text;
        if (place) setCity(place);
      })
      .catch(() => {});
  }, [step, city, path]);

  // Pull a real elevation profile for the drawn line (best-effort).
  useEffect(() => {
    if (step !== "details" || path.length < 2) return;
    let cancelled = false;
    setElevLoading(true);
    elevationGainMeters(path).then((m) => {
      if (!cancelled) {
        setElevationM(m);
        setElevLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [step, path]);

  function next() {
    if (isGuest) {
      openAuthPrompt();
      return;
    }
    if (canContinue) setStep("details");
  }

  async function publish() {
    if (!canPublish) return;
    setSaving(true);
    const id = await addRoute({
      name: name.trim(),
      description: description.trim(),
      city: city.trim() || "Unknown",
      routeType,
      surface,
      flatness,
      path,
      distanceMi: metersToMiles(distanceM),
      elevationFt: metersToFeet(elevationM),
    });
    setSaving(false);
    if (id) router.push(`/route/${id}`);
  }

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center gap-3 px-4 pb-2 pt-5">
        <button
          onClick={() => (step === "details" ? setStep("draw") : router.back())}
          className="grid h-9 w-9 place-items-center rounded-full bg-loop-panel"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold">
          {step === "draw" ? "Draw your route" : "Route details"}
        </h1>
      </header>

      {step === "draw" ? (
        <>
          <p className="px-4 pb-2 text-sm text-loop-muted">
            Tap to drop points. Switch between following roads and straight lines.
            Distance is measured for you.
          </p>
          <RouteDraw
            onChange={(p, d) => {
              setPath(p);
              setDistanceM(d);
            }}
            className="mx-4 h-[56vh] overflow-hidden rounded-2xl border border-loop-line"
          />
          <div className="mt-3 flex items-center justify-between px-4">
            <div>
              <p className="text-2xl font-bold tabular-nums">
                {canContinue ? formatDistance(metersToMiles(distanceM), unit) : "—"}
              </p>
              <p className="text-xs text-loop-muted">
                {path.length} point{path.length === 1 ? "" : "s"}
              </p>
            </div>
            <button
              onClick={next}
              disabled={!canContinue}
              className={clsx(
                "rounded-xl px-6 py-3 font-bold transition",
                canContinue
                  ? "bg-loop-green text-black active:scale-[0.98]"
                  : "cursor-not-allowed bg-loop-panel2 text-loop-muted"
              )}
            >
              Next
            </button>
          </div>
          <div className="px-4 pb-6 pt-4 text-center">
            <Link href="/add/discover" className="text-xs text-loop-muted underline">
              Or discover routes from runs
            </Link>
          </div>
        </>
      ) : (
        <div className="space-y-4 px-4 pb-10">
          <div className="overflow-hidden rounded-2xl border border-loop-line">
            <MiniRoute path={path} width={400} height={160} className="h-40 w-full" />
            <div className="flex items-center gap-2 bg-loop-panel px-3 py-2 text-sm">
              <span className="font-bold">
                {formatDistance(metersToMiles(distanceM), unit)}
              </span>
              <span className="text-loop-muted">·</span>
              <span className="font-bold">
                {elevLoading ? "…" : formatElevation(metersToFeet(elevationM), unit)}
              </span>
              <span className="text-loop-muted">gain · auto-measured</span>
            </div>
          </div>

          <Field label="Route name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Riverside Morning Loop"
              className="input"
            />
          </Field>

          <Field label="City">
            <div className="flex items-center gap-2 rounded-xl border border-loop-line bg-loop-panel2 px-3">
              <MapPin className="h-4 w-4 text-loop-muted" />
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="City"
                className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-loop-muted"
              />
            </div>
          </Field>

          <Field label="Route type">
            <Pills options={ROUTE_TYPES} value={routeType} onChange={setRouteType} />
          </Field>
          <Field label="Surface">
            <Pills options={SURFACES} value={surface} onChange={setSurface} />
          </Field>
          <Field label="How flat?">
            <Pills options={FLATNESS} value={flatness} onChange={setFlatness} />
          </Field>

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
            disabled={!canPublish}
            onClick={publish}
            className={clsx(
              "w-full rounded-xl py-3.5 font-bold transition",
              canPublish
                ? "bg-loop-green text-black active:scale-[0.98]"
                : "cursor-not-allowed bg-loop-panel2 text-loop-muted"
            )}
          >
            {saving ? "Publishing…" : "Publish route"}
          </button>
        </div>
      )}

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

function Pills({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          className={clsx(
            "rounded-full border px-3 py-1.5 text-sm transition",
            value === o
              ? "border-loop-green bg-loop-green/15 text-loop-green"
              : "border-loop-line bg-loop-panel2 text-zinc-300"
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}
