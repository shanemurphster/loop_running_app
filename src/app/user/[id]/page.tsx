"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, UserPlus, UserCheck } from "lucide-react";
import clsx from "clsx";
import { useStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/Avatar";
import { RouteCard } from "@/components/RouteCard";

export default function UserProfilePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const {
    getUser,
    routes,
    reactions,
    user,
    isGuest,
    isFollowing,
    toggleFollow,
  } = useStore();
  const supabase = useMemo(() => createClient(), []);

  const profile = getUser(id);
  const [counts, setCounts] = useState({ followers: 0, following: 0 });
  const following = isFollowing(id);
  const isSelf = user?.id === id;

  useEffect(() => {
    let active = true;
    (async () => {
      const [followers, follows] = await Promise.all([
        supabase
          .from("follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("following_id", id),
        supabase
          .from("follows")
          .select("following_id", { count: "exact", head: true })
          .eq("follower_id", id),
      ]);
      if (active)
        setCounts({
          followers: followers.count ?? 0,
          following: follows.count ?? 0,
        });
    })();
    return () => {
      active = false;
    };
    // re-count when the viewer follows/unfollows this user
  }, [id, supabase, following]);

  const created = routes.filter((r) => r.creatorId === id);
  const reviewedCount = useMemo(
    () => new Set(reactions.filter((r) => r.userId === id).map((r) => r.routeId)).size,
    [reactions, id]
  );

  if (!profile) {
    return (
      <div className="px-4 pt-6">
        <button
          onClick={() => router.back()}
          className="mb-6 grid h-9 w-9 place-items-center rounded-full bg-loop-panel"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <p className="text-center text-loop-muted">Runner not found.</p>
      </div>
    );
  }

  return (
    <div className="pb-10">
      <header className="px-4 pb-2 pt-5">
        <button
          onClick={() => router.back()}
          className="mb-4 grid h-9 w-9 place-items-center rounded-full bg-loop-panel"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-4">
          <Avatar user={profile} size={72} />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold">
              {profile.name || `@${profile.username}`}
            </h1>
            <p className="truncate text-sm text-loop-muted">
              @{profile.username}
              {profile.city ? ` · ${profile.city}` : ""}
            </p>
          </div>
          {!isSelf && (
            <button
              onClick={() => toggleFollow(id)}
              className={clsx(
                "flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition active:scale-95",
                following
                  ? "border border-loop-line bg-loop-panel text-zinc-200"
                  : "bg-loop-green text-black"
              )}
            >
              {following ? (
                <>
                  <UserCheck className="h-4 w-4" /> Following
                </>
              ) : (
                <>
                  <UserPlus className="h-4 w-4" /> Follow
                </>
              )}
            </button>
          )}
        </div>

        {profile.bio && (
          <p className="mt-3 text-sm text-zinc-300">{profile.bio}</p>
        )}

        {profile.badges.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {profile.badges.map((b) => (
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
          <Stat n={reviewedCount} label="Reviewed" />
          <Stat n={created.length} label="Created" />
          <Stat n={counts.followers} label="Followers" />
          <Stat n={counts.following} label="Following" />
        </div>
      </header>

      <h2 className="px-4 pb-2 pt-4 text-lg font-bold">Routes by @{profile.username}</h2>
      <div className="space-y-4 px-4">
        {created.length === 0 ? (
          <p className="py-8 text-center text-sm text-loop-muted">
            No routes yet.
          </p>
        ) : (
          created.map((r) => <RouteCard key={r.id} route={r} variant="wide" />)
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
