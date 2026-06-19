"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { useStore } from "@/lib/store";
import { Avatar } from "@/components/Avatar";
import { CITIES } from "@/lib/filters";
import type { City } from "@/lib/types";

interface Row {
  userId: string;
  reactions: number;
  routes: number;
  score: number;
}

export default function LeaderboardPage() {
  const { users, routes, reactions } = useStore();
  const [city, setCity] = useState<City>("Philadelphia");

  const rows = useMemo<Row[]>(() => {
    const cityUserIds = new Set(users.filter((u) => u.city === city).map((u) => u.id));
    const byUser = new Map<string, Row>();
    for (const id of cityUserIds)
      byUser.set(id, { userId: id, reactions: 0, routes: 0, score: 0 });

    for (const r of reactions) {
      const row = byUser.get(r.userId);
      if (row) row.reactions += 1;
    }
    for (const rt of routes) {
      const row = byUser.get(rt.creatorId);
      if (row) row.routes += 1;
    }
    for (const row of byUser.values()) {
      // Contributions weighting: each route added is worth more than a reaction.
      row.score = row.reactions + row.routes * 5;
    }
    return [...byUser.values()].sort((a, b) => b.score - a.score);
  }, [users, routes, reactions, city]);

  return (
    <div className="px-4 pb-10">
      <header className="pb-3 pt-5">
        <h1 className="text-2xl font-bold">Leaderboard</h1>
        <p className="text-sm text-loop-muted">Top contributors by city</p>
      </header>

      <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
        {CITIES.map((c) => (
          <button
            key={c}
            onClick={() => setCity(c)}
            className={clsx(
              "shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition",
              city === c
                ? "bg-loop-green text-black"
                : "bg-loop-panel2 text-zinc-300"
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {rows.map((row, i) => {
          const user = users.find((u) => u.id === row.userId)!;
          return (
            <div
              key={row.userId}
              className="flex items-center gap-3 rounded-2xl border border-loop-line bg-loop-panel p-3"
            >
              <span
                className={clsx(
                  "w-6 text-center text-lg font-black",
                  i === 0
                    ? "text-loop-green"
                    : i < 3
                    ? "text-zinc-200"
                    : "text-loop-muted"
                )}
              >
                {i + 1}
              </span>
              <Avatar user={user} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold">@{user.username}</p>
                <p className="text-xs text-loop-muted">
                  {row.reactions} reactions · {row.routes} routes
                </p>
              </div>
              {user.badges[0] && (
                <span className="rounded-full bg-loop-panel2 px-2.5 py-1 text-xs font-medium text-loop-green">
                  {user.badges[0]}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
