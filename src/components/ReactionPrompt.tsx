"use client";

import { useState } from "react";
import { X } from "lucide-react";
import clsx from "clsx";
import { useStore } from "@/lib/store";
import { NEGATIVE_TAGS, POSITIVE_TAGS } from "@/lib/tags";
import type { ReactionKind } from "@/lib/types";

const REACTIONS: { kind: ReactionKind; emoji: string; label: string }[] = [
  { kind: "like", emoji: "👍", label: "Loved it" },
  { kind: "ok", emoji: "😐", label: "It was okay" },
  { kind: "dislike", emoji: "👎", label: "Didn't like it" },
];

// Bottom-sheet "How was this run?" flow: one-tap reaction, then optional tags
// and text. No numbers shown to the user — pure taste signal.
export function ReactionPrompt({
  routeId,
  routeName,
  onClose,
}: {
  routeId: string;
  routeName: string;
  onClose: () => void;
}) {
  const { addReaction } = useStore();
  const [reaction, setReaction] = useState<ReactionKind | null>(null);
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");

  const tagPool = reaction === "dislike" ? NEGATIVE_TAGS : POSITIVE_TAGS;

  function toggleTag(id: string) {
    setTags((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function submit() {
    if (!reaction) return;
    addReaction({ routeId, reaction, tags: [...tags], text: text.trim() });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        aria-label="Close"
        className="absolute inset-0 bg-black/70 animate-fade-in"
        onClick={onClose}
      />
      <div className="relative z-10 w-full max-w-app animate-slide-up rounded-t-3xl border-t border-loop-line bg-loop-panel p-5 pb-8">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold">How was this run?</h2>
            <p className="text-sm text-loop-muted">{routeName}</p>
          </div>
          <button
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-full bg-loop-panel2 text-loop-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {REACTIONS.map((r) => (
            <button
              key={r.kind}
              onClick={() => setReaction(r.kind)}
              className={clsx(
                "flex flex-col items-center gap-2 rounded-2xl border py-4 transition",
                reaction === r.kind
                  ? "border-loop-green bg-loop-green/10"
                  : "border-loop-line bg-loop-panel2 hover:border-loop-muted"
              )}
            >
              <span className="text-3xl">{r.emoji}</span>
              <span className="text-xs font-medium text-zinc-300">{r.label}</span>
            </button>
          ))}
        </div>

        {reaction && (
          <div className="mt-5 animate-fade-in">
            <p className="mb-2 text-sm font-semibold text-zinc-300">
              What stood out?
            </p>
            <div className="flex flex-wrap gap-2">
              {tagPool.map((t) => (
                <button
                  key={t.id}
                  onClick={() => toggleTag(t.id)}
                  className={clsx(
                    "rounded-full border px-3 py-1.5 text-sm transition",
                    tags.has(t.id)
                      ? "border-loop-green bg-loop-green/15 text-loop-green"
                      : "border-loop-line bg-loop-panel2 text-zinc-300"
                  )}
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>

            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Add a note (optional)"
              rows={2}
              className="mt-4 w-full resize-none rounded-xl border border-loop-line bg-loop-panel2 p-3 text-sm outline-none placeholder:text-loop-muted focus:border-loop-muted"
            />

            <button
              onClick={submit}
              className="mt-3 w-full rounded-xl bg-loop-green py-3 font-bold text-black transition active:scale-[0.98]"
            >
              Post reaction
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
