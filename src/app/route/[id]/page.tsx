"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  MapPin,
  TrendingUp,
  Ruler,
  Activity,
  Info,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { RouteMap } from "@/components/RouteMap";
import { ScoreRing } from "@/components/ScoreRing";
import { RouteTypeBadge } from "@/components/RouteTypeBadge";
import { SaveButton } from "@/components/SaveButton";
import { Avatar } from "@/components/Avatar";
import { ReactionPrompt } from "@/components/ReactionPrompt";
import { InfoTooltip } from "@/components/InfoTooltip";
import { TAG_MAP } from "@/lib/tags";
import { formatDistance, formatElevation } from "@/lib/units";
import type { ReactionKind } from "@/lib/types";

const REACTION_EMOJI: Record<ReactionKind, string> = {
  like: "👍",
  ok: "😐",
  dislike: "👎",
};

export default function RouteDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { getRoute, getUser, reactionsFor, unit, isGuest, openAuthPrompt } =
    useStore();
  const [showReaction, setShowReaction] = useState(false);

  const route = getRoute(id);
  if (!route) {
    return (
      <div className="p-6 text-center text-loop-muted">
        Route not found.{" "}
        <button onClick={() => router.push("/")} className="text-loop-green">
          Go home
        </button>
      </div>
    );
  }

  const creator = getUser(route.creatorId);
  const reactions = reactionsFor(route.id);

  return (
    <div>
      {/* Map header */}
      <div className="relative">
        <RouteMap path={route.path} className="h-72 w-full" interactive={false} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-loop-ink/70 via-transparent to-loop-ink" />
        <button
          onClick={() => router.back()}
          className="absolute left-4 top-5 grid h-10 w-10 place-items-center rounded-full bg-black/55 backdrop-blur"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="absolute right-4 top-5">
          <SaveButton routeId={route.id} className="h-10 w-10" />
        </div>
      </div>

      {/* Title block */}
      <div className="-mt-6 px-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <RouteTypeBadge type={route.routeType} />
              {route.loopCertified && (
                <InfoTooltip text="Loop Certified means enough different runners have logged this exact path that we're confident it's a real, well-traveled route — not just one person's upload.">
                  <span className="flex items-center gap-1 rounded-md bg-loop-green/20 px-2 py-0.5 text-xs font-semibold text-loop-green">
                    <BadgeCheck className="h-3.5 w-3.5" /> Loop Certified
                  </span>
                </InfoTooltip>
              )}
            </div>
            <h1 className="text-2xl font-black leading-tight">{route.name}</h1>
            <p className="mt-1 flex items-center gap-1 text-sm text-loop-muted">
              <MapPin className="h-4 w-4 text-loop-green" />
              {route.city}
            </p>
          </div>
          <InfoTooltip
            text="Loop Score (1–10) blends 👍/😐/👎 reactions, head-to-head Compare wins, and how recently people ran it — not just an average star rating."
            align="right"
          >
            <ScoreRing score={route.loopScore} size={60} />
          </InfoTooltip>
        </div>

        {/* Stats */}
        <div className="mt-4 grid grid-cols-3 gap-2">
          <Stat
            icon={Ruler}
            label="Distance"
            value={formatDistance(route.distanceMi, unit)}
          />
          <Stat
            icon={TrendingUp}
            label="Elevation"
            value={formatElevation(route.elevationFt, unit)}
          />
          <Stat
            icon={Activity}
            label="Runs logged"
            value={(route.runCount ?? route.ratingCount).toString()}
          />
        </div>

        <p className="mt-4 text-sm leading-relaxed text-zinc-300">
          {route.description}
        </p>

        {creator &&
          (route.creatorId === "loop" ? (
            <div className="mt-4 flex items-center gap-2 text-sm text-loop-muted">
              <Avatar user={creator} size={28} />
              Added by <span className="font-medium text-zinc-200">Loop</span>
            </div>
          ) : (
            <Link
              href={`/user/${route.creatorId}`}
              className="mt-4 flex items-center gap-2 text-sm text-loop-muted"
            >
              <Avatar user={creator} size={28} />
              Added by{" "}
              <span className="font-medium text-zinc-200">@{creator.username}</span>
            </Link>
          ))}
      </div>

      {/* Predicted vibes — shown for freshly discovered routes before real reactions */}
      {route.tagSignals.length === 0 &&
        route.predictedTags &&
        route.predictedTags.length > 0 && (
          <section className="mt-6 px-4">
            <h2 className="text-lg font-bold">Predicted vibes</h2>
            <p className="mb-3 text-xs text-loop-muted">
              AI-predicted from runner data — not yet confirmed by reactions.
            </p>
            <div className="flex flex-wrap gap-2">
              {route.predictedTags.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-loop-line bg-loop-panel2 px-3 py-1.5 text-sm text-zinc-300"
                >
                  {TAG_MAP[t]?.emoji} {TAG_MAP[t]?.label}
                </span>
              ))}
            </div>
          </section>
        )}

      {/* Why runners like this route */}
      {route.tagSignals.length > 0 && (
        <section className="mt-6 px-4">
          <h2 className="mb-3 flex items-center gap-1.5 text-lg font-bold">
            Why runners like this route
            <InfoTooltip text="Percent of raters who tagged this route with each vibe — e.g. 62% means 62% of people who reacted also picked 'Shaded' for this route.">
              <Info className="h-4 w-4 text-loop-muted" />
            </InfoTooltip>
          </h2>
          <div className="space-y-2.5">
            {route.tagSignals.slice(0, 6).map(({ tag, pct }) => (
              <div key={tag.id} className="flex items-center gap-3">
                <span className="w-36 shrink-0 text-sm text-zinc-300">
                  {tag.emoji} {tag.label}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-loop-panel2">
                  <div
                    className={
                      tag.sentiment === "positive"
                        ? "h-full rounded-full bg-loop-green"
                        : "h-full rounded-full bg-orange-500"
                    }
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="w-10 shrink-0 text-right text-sm tabular-nums text-loop-muted">
                  {pct}%
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Reviews */}
      <section className="mt-6 px-4">
        <h2 className="mb-3 text-lg font-bold">
          Reviews <span className="text-loop-muted">({reactions.length})</span>
        </h2>
        <div className="space-y-3">
          {reactions.slice(0, 12).map((r) => {
            const u = getUser(r.userId);
            return (
              <div
                key={r.id}
                className="rounded-2xl border border-loop-line bg-loop-panel p-3"
              >
                <div className="flex items-center gap-2">
                  {u && <Avatar user={u} size={28} />}
                  {u ? (
                    <Link
                      href={`/user/${u.id}`}
                      className="text-sm font-medium text-zinc-200"
                    >
                      @{u.username}
                    </Link>
                  ) : (
                    <span className="text-sm font-medium text-zinc-200">runner</span>
                  )}
                  <span className="text-lg">{REACTION_EMOJI[r.reaction]}</span>
                  {r.fromActivity && (
                    <span className="ml-auto rounded bg-loop-panel2 px-1.5 py-0.5 text-[10px] text-loop-muted">
                      auto-synced
                    </span>
                  )}
                </div>
                {r.tags.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {r.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-loop-panel2 px-2 py-0.5 text-xs text-zinc-300"
                      >
                        {TAG_MAP[t]?.emoji} {TAG_MAP[t]?.label}
                      </span>
                    ))}
                  </div>
                )}
                {r.text && (
                  <p className="mt-2 text-sm text-zinc-300">{r.text}</p>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Sticky react CTA */}
      <div className="fixed inset-x-0 bottom-[76px] z-30 mx-auto max-w-app px-4">
        <button
          onClick={() => (isGuest ? openAuthPrompt() : setShowReaction(true))}
          className="w-full rounded-xl bg-loop-green py-3.5 font-bold text-black shadow-lg shadow-loop-green/20 transition active:scale-[0.98]"
        >
          Rate this run
        </button>
      </div>

      {showReaction && (
        <ReactionPrompt
          routeId={route.id}
          routeName={route.name}
          onClose={() => setShowReaction(false)}
        />
      )}
    </div>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-loop-line bg-loop-panel p-3">
      <Icon className="h-4 w-4 text-loop-green" />
      <p className="mt-1 text-lg font-bold">{value}</p>
      <p className="text-xs text-loop-muted">{label}</p>
    </div>
  );
}
