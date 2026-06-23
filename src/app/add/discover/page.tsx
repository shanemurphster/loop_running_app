"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BadgeCheck, Radar, Activity } from "lucide-react";
import clsx from "clsx";
import { useStore } from "@/lib/store";
import { RouteTypeBadge } from "@/components/RouteTypeBadge";
import { TAG_MAP } from "@/lib/tags";

interface Found {
  id: string;
  name: string;
  city: string;
  distanceMi: number;
  routeType: string;
  loopCertified: boolean;
  runCount: number;
  predictedTags: string[];
}

// Admin / dev surface for the discovery pipeline. The ONLY place a (paid) Haiku
// call can fire, and only on an explicit scan. The server persists discovered
// routes + dedupes against the DB, so a path is named once ever.
export default function DiscoverRoutesPage() {
  const router = useRouter();
  const { refresh } = useStore();

  const [status, setStatus] = useState<"idle" | "scanning" | "done" | "error">("idle");
  const [found, setFound] = useState<Found[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [error, setError] = useState("");

  async function scan() {
    setStatus("scanning");
    setError("");
    try {
      const res = await fetch("/api/discover-routes", { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? `Scan failed (${res.status})`);
      }
      const data: { routes: Found[]; remaining: number } = await res.json();
      setFound(data.routes);
      setRemaining(data.remaining ?? 0);
      setStatus("done");
      await refresh(); // pull the newly-created routes into the app
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setStatus("error");
    }
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
        <h1 className="text-2xl font-bold">Discover from runs</h1>
      </header>

      <div className="mt-2 rounded-2xl border border-loop-line bg-loop-panel p-4">
        <div className="flex items-center gap-2 text-loop-green">
          <Radar className="h-5 w-5" />
          <span className="font-semibold">How this works</span>
        </div>
        <p className="mt-2 text-sm leading-relaxed text-zinc-300">
          Loop doesn&apos;t invent routes on demand. It watches where people
          actually run. When enough distinct runners cover the same path, that
          path becomes a route — and once it&apos;s popular enough, it&apos;s
          marked <span className="text-loop-green">Loop Certified</span>. The AI
          names a route only once, the moment it&apos;s promoted.
        </p>
        <p className="mt-2 text-xs text-loop-muted">
          Reading a simulated activity feed for now. Strava &amp; Garmin plug in
          here later.
        </p>
      </div>

      <button
        onClick={scan}
        disabled={status === "scanning"}
        className={clsx(
          "mt-4 flex w-full items-center justify-center gap-2 rounded-xl py-3.5 font-bold transition",
          status === "scanning"
            ? "cursor-wait bg-loop-panel2 text-loop-muted"
            : "bg-loop-green text-black active:scale-[0.98]"
        )}
      >
        <Activity className="h-5 w-5" />
        {status === "scanning" ? "Scanning runs…" : "Scan recent runs"}
      </button>

      {status === "error" && (
        <p className="mt-3 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-300">
          {error}
        </p>
      )}

      {status === "done" && (
        <div className="mt-5">
          {found.length === 0 ? (
            <p className="py-8 text-center text-sm text-loop-muted">
              No new routes ready. Paths need at least 3 distinct runners before
              promotion.
            </p>
          ) : (
            <>
              <p className="mb-3 text-sm text-zinc-300">
                Discovered{" "}
                <span className="font-bold text-loop-green">{found.length}</span>{" "}
                new {found.length === 1 ? "route" : "routes"}
                {remaining > 0 && (
                  <span className="text-loop-muted"> · {remaining} more ready</span>
                )}
              </p>
              <div className="space-y-3">
                {found.map((r) => (
                  <Link
                    key={r.id}
                    href={`/route/${r.id}`}
                    className="block rounded-2xl border border-loop-line bg-loop-panel p-3"
                  >
                    <div className="flex items-center gap-2">
                      <RouteTypeBadge type={r.routeType} />
                      {r.loopCertified && (
                        <span className="flex items-center gap-1 rounded-md bg-loop-green/20 px-2 py-0.5 text-xs font-semibold text-loop-green">
                          <BadgeCheck className="h-3.5 w-3.5" /> Certified
                        </span>
                      )}
                      <span className="ml-auto text-xs text-loop-muted">
                        {r.runCount} runners
                      </span>
                    </div>
                    <h3 className="mt-2 font-bold">{r.name}</h3>
                    <p className="text-sm text-loop-muted">
                      {r.city} · {r.distanceMi.toFixed(1)} mi
                    </p>
                    {r.predictedTags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {r.predictedTags.map((t) => (
                          <span
                            key={t}
                            className="rounded-full bg-loop-panel2 px-2 py-0.5 text-xs text-zinc-300"
                          >
                            {TAG_MAP[t]?.emoji} {TAG_MAP[t]?.label}
                          </span>
                        ))}
                      </div>
                    )}
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
