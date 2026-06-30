"use client";

import { useMemo, useRef, useState } from "react";
import clsx from "clsx";
import { LogOut, Camera, Loader2 } from "lucide-react";
import { useStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { Avatar } from "@/components/Avatar";
import { RouteCard } from "@/components/RouteCard";

type Tab = "saved" | "created" | "reviewed";

export default function ProfilePage() {
  const {
    currentUser,
    routes,
    reactions,
    isSaved,
    isGuest,
    user,
    followingIds,
    followerCount,
    openAuthPrompt,
    signOut,
    refresh,
  } = useStore();
  const [tab, setTab] = useState<Tab>("saved");
  const supabase = useMemo(() => createClient(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/avatar_${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, file, { upsert: true, contentType: file.type });
    if (!error) {
      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      await supabase
        .from("profiles")
        .update({ avatar_url: data.publicUrl })
        .eq("id", user.id);
      await refresh();
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

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

  const following = followingIds.length;
  const followers = followerCount;
  const signedIn = !!user && !isGuest;

  const list = tab === "saved" ? saved : tab === "created" ? created : reviewed;

  return (
    <div className="pb-10">
      <header className="px-4 pb-2 pt-6">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            <Avatar user={currentUser} size={72} />
            {signedIn && (
              <>
                <button
                  onClick={() => fileRef.current?.click()}
                  aria-label="Change profile picture"
                  className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border-2 border-loop-ink bg-loop-green text-black"
                >
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Camera className="h-3.5 w-3.5" />
                  )}
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onPickFile}
                />
              </>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-2xl font-bold">
              {signedIn ? currentUser.name || `@${currentUser.username}` : "Guest"}
            </h1>
            <p className="truncate text-sm text-loop-muted">
              {signedIn
                ? `@${currentUser.username}${currentUser.city ? ` · ${currentUser.city}` : ""}`
                : "Browsing without an account"}
            </p>
          </div>
          {signedIn ? (
            <button
              onClick={signOut}
              aria-label="Sign out"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-loop-panel text-loop-muted"
            >
              <LogOut className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={openAuthPrompt}
              className="shrink-0 rounded-full bg-loop-green px-4 py-2 text-sm font-bold text-black"
            >
              Sign in
            </button>
          )}
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
