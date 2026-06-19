"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, TrendingUp, Users, Sparkles } from "lucide-react";
import clsx from "clsx";
import { AppHeader } from "@/components/AppHeader";
import { RouteCard } from "@/components/RouteCard";
import { RouteRail } from "@/components/RouteRail";
import { useStore } from "@/lib/store";
import type { RouteWithStats } from "@/lib/types";

type Tab = "trending" | "friends" | "foryou";

export default function HomePage() {
  const { routes, currentUser, followingIds } = useStore();
  const [tab, setTab] = useState<Tab>("trending");

  const homeCity = currentUser.city;

  const sorted = useMemo(
    () => [...routes].sort((a, b) => b.loopScore - a.loopScore),
    [routes]
  );

  const discoverRoutes = useMemo<RouteWithStats[]>(() => {
    if (tab === "friends") {
      const friendSet = new Set(followingIds);
      return sorted.filter((r) => friendSet.has(r.creatorId));
    }
    if (tab === "foryou") {
      // "For You" — bias toward the user's city, then score.
      return [...sorted].sort((a, b) => {
        const ca = a.city === homeCity ? 1 : 0;
        const cb = b.city === homeCity ? 1 : 0;
        if (ca !== cb) return cb - ca;
        return b.loopScore - a.loopScore;
      });
    }
    // trending — newest-weighted high scorers
    return [...sorted].sort(
      (a, b) =>
        b.loopScore + recencyBoost(b) - (a.loopScore + recencyBoost(a))
    );
  }, [tab, sorted, followingIds, homeCity]);

  const topLong = sorted
    .filter((r) => r.city === "Miami" && r.routeType === "Long Run")
    .slice(0, 6);
  const topTempo = sorted
    .filter((r) => r.city === "Philadelphia" && r.routeType === "Tempo")
    .slice(0, 6);
  const certified = sorted.filter((r) => r.loopCertified).slice(0, 6);

  return (
    <div>
      <AppHeader subtitle="Discover your next run" />
      <div className="h-px w-full bg-loop-line/70" />

      {/* Discover section with tabs */}
      <section className="mt-5">
        <div className="flex items-center justify-between px-4">
          <h2 className="text-2xl font-bold">Discover</h2>
          <Link
            href="/discover"
            className="flex items-center gap-0.5 text-sm font-semibold text-loop-green"
          >
            See all <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto px-4">
          <TabButton active={tab === "trending"} onClick={() => setTab("trending")}>
            <TrendingUp className="h-4 w-4" /> Trending Nearby
          </TabButton>
          <TabButton active={tab === "friends"} onClick={() => setTab("friends")}>
            <Users className="h-4 w-4" /> Friend Picks
          </TabButton>
          <TabButton active={tab === "foryou"} onClick={() => setTab("foryou")}>
            <Sparkles className="h-4 w-4" /> For You
          </TabButton>
        </div>

        {discoverRoutes.length > 0 ? (
          <div className="no-scrollbar mt-3 flex gap-3 overflow-x-auto px-4 pb-1">
            {discoverRoutes.slice(0, 8).map((r) => (
              <RouteCard key={r.id} route={r} variant="rail" />
            ))}
          </div>
        ) : (
          <p className="px-4 py-8 text-center text-sm text-loop-muted">
            No routes from people you follow yet. Find runners on the leaderboard.
          </p>
        )}
      </section>

      <RouteRail
        title="Top Long Runs"
        location="Miami"
        routes={topLong}
        seeAllHref="/discover?city=Miami&type=Long%20Run"
      />
      <RouteRail
        title="Best Tempo Routes"
        location="Philadelphia"
        routes={topTempo}
        seeAllHref="/discover?city=Philadelphia&type=Tempo"
      />
      <RouteRail
        title="Loop Certified"
        routes={certified}
        seeAllHref="/discover?certified=1"
      />

      <div className="px-4 pt-2 text-center">
        <Link
          href="/compare"
          className="mt-6 inline-block rounded-xl border border-loop-line bg-loop-panel px-5 py-3 text-sm font-semibold text-zinc-200"
        >
          🆚 Help rank routes — quick compare
        </Link>
      </div>
    </div>
  );
}

function recencyBoost(r: RouteWithStats) {
  const ageDays = (Date.now() - new Date(r.createdAt).getTime()) / 86400000;
  return Math.max(0, 1.5 - ageDays / 30);
}

function TabButton({
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
        "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition",
        active
          ? "bg-loop-green text-black"
          : "bg-loop-panel2 text-zinc-300 hover:bg-loop-line"
      )}
    >
      {children}
    </button>
  );
}
