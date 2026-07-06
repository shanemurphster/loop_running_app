"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Link2, Upload, Loader2, Unlink } from "lucide-react";
import clsx from "clsx";
import { useStore } from "@/lib/store";
import { MiniRoute } from "@/components/MiniRoute";
import { decodePolyline } from "@/lib/polyline";
import { parseGpx, gpxElevationGain } from "@/lib/gpx";
import { elevationGainMeters } from "@/lib/elevation";
import { pathLengthMeters, formatDistance, formatElevation, metersToMiles, metersToFeet } from "@/lib/units";

type Mode = "choose" | "strava" | "gpx";

interface StravaActivity {
  id: number;
  name: string;
  startDate: string;
  distanceM: number;
  elevationGainM: number;
  movingTimeS: number;
  summaryPolyline: string;
}

const STRAVA_BANNER: Record<string, string> = {
  connected: "Strava connected.",
  denied: "Strava connection cancelled.",
  error: "Couldn't connect to Strava. Try again.",
  state_mismatch: "That link expired — try connecting again.",
  not_configured: "Strava isn't set up on this server yet.",
};

export default function ImportRoutePage() {
  return (
    <Suspense fallback={<div className="p-6 text-loop-muted">Loading…</div>}>
      <ImportInner />
    </Suspense>
  );
}

function ImportInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isGuest, openAuthPrompt, unit, setPendingImport } = useStore();

  const stravaParam = searchParams.get("strava");
  const [mode, setMode] = useState<Mode>(stravaParam === "connected" ? "strava" : "choose");
  const [banner, setBanner] = useState(stravaParam ? STRAVA_BANNER[stravaParam] ?? "" : "");

  useEffect(() => {
    if (stravaParam) router.replace("/add/import");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isGuest) openAuthPrompt();
  }, [isGuest, openAuthPrompt]);

  if (isGuest) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-semibold">Sign in to import a run</p>
        <p className="text-sm text-loop-muted">
          Connecting Strava or uploading a GPX file needs an account.
        </p>
        <button
          onClick={openAuthPrompt}
          className="mt-2 rounded-xl bg-loop-green px-5 py-2.5 font-bold text-black"
        >
          Sign in
        </button>
      </div>
    );
  }

  function back() {
    if (mode !== "choose") setMode("choose");
    else router.back();
  }

  return (
    <div className="px-4 pb-10">
      <header className="flex items-center gap-3 pb-2 pt-5">
        <button
          onClick={back}
          className="grid h-9 w-9 place-items-center rounded-full bg-loop-panel"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-2xl font-bold">Import a run</h1>
      </header>

      {banner && (
        <p className="mt-2 rounded-xl border border-loop-line bg-loop-panel p-3 text-sm text-zinc-300">
          {banner}
        </p>
      )}

      {mode === "choose" && (
        <div className="mt-4 space-y-3">
          <button
            onClick={() => setMode("strava")}
            className="flex w-full items-center gap-3 rounded-2xl border border-loop-line bg-loop-panel p-4 text-left"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-loop-green/15 text-loop-green">
              <Link2 className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold">Connect Strava</p>
              <p className="text-sm text-loop-muted">Browse your past runs and pick one</p>
            </div>
          </button>

          <button
            onClick={() => setMode("gpx")}
            className="flex w-full items-center gap-3 rounded-2xl border border-loop-line bg-loop-panel p-4 text-left"
          >
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-loop-green/15 text-loop-green">
              <Upload className="h-5 w-5" />
            </div>
            <div>
              <p className="font-bold">Upload a GPX file</p>
              <p className="text-sm text-loop-muted">
                From Garmin Connect, Strava, or your GPS watch
              </p>
            </div>
          </button>
        </div>
      )}

      {mode === "strava" && <StravaPicker unit={unit} setPendingImport={setPendingImport} />}
      {mode === "gpx" && <GpxUpload setPendingImport={setPendingImport} />}
    </div>
  );
}

function StravaPicker({
  unit,
  setPendingImport,
}: {
  unit: "mi" | "km";
  setPendingImport: ReturnType<typeof useStore>["setPendingImport"];
}) {
  const router = useRouter();
  const [status, setStatus] = useState<
    "loading" | "connected" | "not_connected" | "error"
  >("loading");
  const [activities, setActivities] = useState<StravaActivity[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [pickingId, setPickingId] = useState<number | null>(null);
  const [pickError, setPickError] = useState("");

  const load = useCallback(async (p: number) => {
    setStatus("loading");
    try {
      const res = await fetch(`/api/strava/activities?page=${p}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load activities");
      if (!data.connected) {
        setStatus("not_connected");
        return;
      }
      setActivities((prev) => (p === 1 ? data.activities : [...prev, ...data.activities]));
      setPage(p);
      setHasMore(Boolean(data.hasMore));
      setStatus("connected");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    load(1);
  }, [load]);

  async function pick(a: StravaActivity) {
    setPickingId(a.id);
    setPickError("");
    try {
      const res = await fetch(`/api/strava/activities/${a.id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't import that run.");
      setPendingImport({
        path: data.path,
        distanceM: data.distanceM,
        elevationM: data.elevationGainM,
        suggestedName: data.name || undefined,
        source: "strava",
      });
      router.push("/add");
    } catch (e) {
      setPickError(e instanceof Error ? e.message : "Couldn't import that run.");
      setPickingId(null);
    }
  }

  async function disconnect() {
    await fetch("/api/strava/disconnect", { method: "POST" });
    setActivities([]);
    setStatus("not_connected");
  }

  if (status === "loading" && activities.length === 0) {
    return (
      <div className="mt-8 flex items-center justify-center gap-2 text-loop-muted">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  if (status === "not_connected") {
    return (
      <div className="mt-6 rounded-2xl border border-loop-line bg-loop-panel p-5 text-center">
        <p className="text-sm text-loop-muted">
          Connect your Strava account to browse your runs.
        </p>
        <a
          href="/api/strava/connect"
          className="mt-3 inline-block rounded-xl bg-loop-green px-5 py-2.5 font-bold text-black"
        >
          Connect Strava
        </a>
      </div>
    );
  }

  if (status === "error") {
    return (
      <p className="mt-6 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">
        Couldn&apos;t reach Strava. Try again shortly.
      </p>
    );
  }

  return (
    <div className="mt-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-loop-muted">Tap a run to import it</p>
        <button
          onClick={disconnect}
          className="flex items-center gap-1 text-xs text-loop-muted underline"
        >
          <Unlink className="h-3 w-3" /> Disconnect
        </button>
      </div>

      {pickError && (
        <p className="mb-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">
          {pickError}
        </p>
      )}

      {activities.length === 0 ? (
        <p className="py-8 text-center text-sm text-loop-muted">
          No runs found in your Strava history.
        </p>
      ) : (
        <div className="space-y-2.5">
          {activities.map((a) => (
            <button
              key={a.id}
              onClick={() => pick(a)}
              disabled={pickingId !== null}
              className="flex w-full items-center gap-3 rounded-2xl border border-loop-line bg-loop-panel p-3 text-left disabled:opacity-60"
            >
              <MiniRoute
                path={decodePolyline(a.summaryPolyline)}
                width={64}
                height={64}
                className="h-16 w-16 shrink-0 rounded-xl border border-loop-line"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">{a.name}</p>
                <p className="text-xs text-loop-muted">
                  {new Date(a.startDate).toLocaleDateString()} ·{" "}
                  {formatDistance(metersToMiles(a.distanceM), unit)} ·{" "}
                  {formatElevation(metersToFeet(a.elevationGainM), unit)} gain
                </p>
              </div>
              {pickingId === a.id && (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-loop-muted" />
              )}
            </button>
          ))}
        </div>
      )}

      {hasMore && (
        <button
          onClick={() => load(page + 1)}
          disabled={status === "loading"}
          className="mt-3 w-full rounded-xl border border-loop-line bg-loop-panel2 py-2.5 text-sm font-semibold text-zinc-200 disabled:opacity-60"
        >
          {status === "loading" ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}

function GpxUpload({
  setPendingImport,
}: {
  setPendingImport: ReturnType<typeof useStore>["setPendingImport"];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File) {
    setError("");
    setBusy(true);
    const text = await file.text();
    const parsed = parseGpx(text);
    if ("error" in parsed) {
      setError(parsed.error);
      setBusy(false);
      return;
    }

    const distanceM = pathLengthMeters(parsed.path);
    let elevationM = gpxElevationGain(parsed.elevations);
    if (elevationM == null) {
      elevationM = await elevationGainMeters(parsed.path);
    }

    setBusy(false);
    setPendingImport({
      path: parsed.path,
      distanceM,
      elevationM,
      suggestedName: parsed.name ?? undefined,
      source: "gpx",
    });
    router.push("/add");
  }

  return (
    <div className="mt-6 rounded-2xl border border-loop-line bg-loop-panel p-5 text-center">
      <p className="mb-3 text-sm text-loop-muted">
        Exported from Garmin Connect, Strava, or your GPS watch.
      </p>
      <label
        className={clsx(
          "inline-flex cursor-pointer items-center gap-2 rounded-xl bg-loop-green px-5 py-2.5 font-bold text-black",
          busy && "cursor-wait opacity-60"
        )}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
        {busy ? "Reading…" : "Choose a .gpx file"}
        <input
          type="file"
          accept=".gpx,application/gpx+xml"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </label>
      {error && (
        <p className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}
