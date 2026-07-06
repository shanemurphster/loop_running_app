"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { formatDistance, formatElevation } from "@/lib/units";
import { RouteTypeBadge } from "@/components/RouteTypeBadge";
import { RouteThumb } from "@/components/RouteThumb";
import type { ComparisonWinner, RouteWithStats } from "@/lib/types";

// "Which run would you rather do?" — builds the preference graph one tap at a
// time. We pair routes within the same city so the choice is meaningful.
export default function ComparePage() {
  const router = useRouter();
  const { routes, addComparison } = useStore();
  const [pair, setPair] = useState<[RouteWithStats, RouteWithStats] | null>(null);
  const [count, setCount] = useState(0);

  const pickPair = useCallback(() => {
    if (routes.length < 2) return;
    // Prefer two routes from the same city.
    const byCity: Record<string, RouteWithStats[]> = {};
    for (const r of routes) (byCity[r.city] ||= []).push(r);
    const cities = Object.keys(byCity).filter((c) => byCity[c].length >= 2);
    const city = cities[Math.floor(Math.random() * cities.length)];
    const pool = byCity[city];
    const a = pool[Math.floor(Math.random() * pool.length)];
    let b = pool[Math.floor(Math.random() * pool.length)];
    while (b.id === a.id) b = pool[Math.floor(Math.random() * pool.length)];
    setPair([a, b]);
  }, [routes]);

  useEffect(() => {
    pickPair();
  }, [pickPair]);

  function choose(winner: ComparisonWinner) {
    if (!pair) return;
    addComparison(pair[0].id, pair[1].id, winner);
    setCount((c) => c + 1);
    pickPair();
  }

  if (routes.length < 2) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="text-2xl">🆚</p>
        <p className="font-semibold">Not enough routes yet</p>
        <p className="text-sm text-loop-muted">
          Comparisons need at least two routes. Add a few and come back.
        </p>
        <button
          onClick={() => router.push("/add")}
          className="mt-2 rounded-xl bg-loop-green px-5 py-2.5 font-bold text-black"
        >
          Add a route
        </button>
      </div>
    );
  }

  if (!pair) {
    return <div className="p-6 text-loop-muted">Loading…</div>;
  }

  const [a, b] = pair;

  return (
    <div className="flex min-h-[calc(100vh-100px)] flex-col px-4">
      <header className="flex items-center gap-3 pb-1 pt-5">
        <button
          onClick={() => router.back()}
          className="grid h-9 w-9 place-items-center rounded-full bg-loop-panel"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-xl font-bold">Which would you rather run?</h1>
          <p className="text-sm text-loop-muted">
            {count > 0 ? `${count} compared this session` : "Tap to choose"} · {a.city}
          </p>
        </div>
      </header>

      <div className="mt-3 flex flex-1 flex-col gap-3">
        <CompareCard route={a} onClick={() => choose("a")} />

        <div className="flex items-center justify-center">
          <button
            onClick={() => choose("tie")}
            className="rounded-full border border-loop-line bg-loop-panel px-5 py-2 text-sm font-semibold text-zinc-300"
          >
            😵 Too tough to decide
          </button>
        </div>

        <CompareCard route={b} onClick={() => choose("b")} />
      </div>
    </div>
  );
}

function CompareCard({
  route,
  onClick,
}: {
  route: RouteWithStats;
  onClick: () => void;
}) {
  const { unit } = useStore();
  return (
    <button
      onClick={onClick}
      className="group relative flex-1 overflow-hidden rounded-2xl ring-1 ring-loop-line transition active:scale-[0.99]"
    >
      <RouteThumb
        image={route.image}
        path={route.path}
        alt={route.name}
        sizes="(max-width: 480px) 100vw, 480px"
        imageClassName="object-cover transition group-active:scale-105"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/30 to-black/40" />
      <div className="absolute left-3 top-3">
        <RouteTypeBadge type={route.routeType} />
      </div>
      <div className="absolute inset-x-0 bottom-0 p-4 text-left">
        <h2 className="text-xl font-extrabold text-white">{route.name}</h2>
        <p className="text-sm text-zinc-200">
          {formatDistance(route.distanceMi, unit)} ·{" "}
          {formatElevation(route.elevationFt, unit)} · {route.city}
        </p>
      </div>
    </button>
  );
}
