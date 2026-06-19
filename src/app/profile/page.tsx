"use client";

import { useMemo, useState } from "react";
import clsx from "clsx";
import { useStore } from "@/lib/store";
import { Avatar } from "@/components/Avatar";
import { RouteCard } from "@/components/RouteCard";
import { SEED_FOLLOWS } from "@/lib/seed";

type Tab = "saved" | "created" | "reviewed";

export default function ProfilePage() {
  const { currentUser, routes, reactions, isSaved } = useStore();
  const [tab, setTab] = useState<Tab>("saved");

  const created = routes.filter((r) => r.creatorId === currentUser.id);
  const saved = routes.filter((r) => isSaved(r.id));
  const reviewedIds = useMemo(
    () =>
      new Set(
        reactions
          .filter((r) => r.userId === currentUser.id)
          .map((r) => r.routeId)
      ),
    [reactions, currentUser.id]
  );
  const reviewed = routes.filter((r) => reviewedIds.has(r.id));

  const followers = SEED_FOLLOWS.filter(
    (f) => f.followingId === currentUser.id
  ).length;
  const following = SEED_FOLLOWS.filter(
    (f) => f.followerId === currentUser.id
  ).length;

  const list = tab === "saved" ? saved : tab === "created" ? created : reviewed;

  return (
    <div className="pb-10">
      <header className="px-4 pb-2 pt-6">
        <div className="flex items-center gap-4">
          <Avatar user={currentUser} size={72} />
          <div>
            <h1 className="text-2xl font-bold">{currentUser.name}</h1>
            <p className="text-sm text-loop-muted">
              @{currentUser.username} · {currentUser.city}
            </p>
          </div>
        </div>

        {currentUser.bio && (
          <p className="mt-3 text-sm text-zinc-300">{currentUser.bio}</p>
        )}

        {currentUser.badges.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {currentUser.badges.map((b) => (
              <span
                key={b}
                className="rounded-full bg-loop-green/15 px-3 py-1 text-xs font-semibold text-loop-green"
              >
                {b}
              </span>
            ))}
          </div>
        )}

        <div className="mt-4 grid grid-cols-4 gap-2 text-center">
          <Stat n={reviewed.length} label="Reviewed" />
          <Stat n={created.length} label="Created" />
          <Stat n={followers} label="Followers" />
          <Stat n={following} label="Following" />
        </div>
      </header>

      <div className="no-scrollbar mt-2 flex gap-2 overflow-x-auto px-4">
        <TabBtn active={tab === "saved"} onClick={() => setTab("saved")}>
          Saved
        </TabBtn>
        <TabBtn active={tab === "created"} onClick={() => setTab("created")}>
          Created
        </TabBtn>
        <TabBtn active={tab === "reviewed"} onClick={() => setTab("reviewed")}>
          Reviewed
        </TabBtn>
      </div>

      <div className="mt-4 space-y-4 px-4">
        {list.length === 0 ? (
          <p className="py-12 text-center text-sm text-loop-muted">
            Nothing here yet.
          </p>
        ) : (
          list.map((r) => <RouteCard key={r.id} route={r} variant="wide" />)
        )}
      </div>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-xl border border-loop-line bg-loop-panel py-2">
      <p className="text-xl font-bold">{n}</p>
      <p className="text-xs text-loop-muted">{label}</p>
    </div>
  );
}

function TabBtn({
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
        "shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition",
        active ? "bg-loop-green text-black" : "bg-loop-panel2 text-zinc-300"
      )}
    >
      {children}
    </button>
  );
}
