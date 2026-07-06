"use client";

import { useMemo, useRef, useState } from "react";
import { X, ImagePlus, Loader2 } from "lucide-react";
import clsx from "clsx";
import { useStore } from "@/lib/store";
import { createClient } from "@/lib/supabase/client";
import { NEGATIVE_TAGS, POSITIVE_TAGS } from "@/lib/tags";
import type { ReactionKind } from "@/lib/types";

const MAX_PHOTOS = 6;

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
  const { addReaction, user } = useStore();
  const supabase = useMemo(() => createClient(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [reaction, setReaction] = useState<ReactionKind | null>(null);
  const [tags, setTags] = useState<Set<string>>(new Set());
  const [text, setText] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");

  const tagPool = reaction === "dislike" ? NEGATIVE_TAGS : POSITIVE_TAGS;

  function toggleTag(id: string) {
    setTags((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function onPickPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (fileRef.current) fileRef.current.value = "";
    if (!files.length || !user) return;

    setPhotoError("");
    const room = MAX_PHOTOS - photos.length;
    if (files.length > room) {
      setPhotoError(`Up to ${MAX_PHOTOS} photos per review.`);
    }
    const toUpload = files.slice(0, room);
    if (!toUpload.length) return;

    setUploading(true);
    const uploaded: string[] = [];
    for (const file of toUpload) {
      if (file.size > 10 * 1024 * 1024) {
        setPhotoError("Skipped a photo over 10MB.");
        continue;
      }
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/${routeId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage
        .from("route-photos")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (!error) {
        const { data } = supabase.storage.from("route-photos").getPublicUrl(path);
        uploaded.push(data.publicUrl);
      }
    }
    setPhotos((prev) => [...prev, ...uploaded]);
    setUploading(false);
  }

  function removePhoto(url: string) {
    setPhotos((prev) => prev.filter((p) => p !== url));
  }

  function submit() {
    if (!reaction) return;
    addReaction({ routeId, reaction, tags: [...tags], text: text.trim(), photos });
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

            <div className="mt-3 flex flex-wrap gap-2">
              {photos.map((url) => (
                <div key={url} className="relative h-16 w-16 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    className="h-16 w-16 rounded-lg object-cover"
                  />
                  <button
                    onClick={() => removePhoto(url)}
                    aria-label="Remove photo"
                    className="absolute -right-1.5 -top-1.5 grid h-5 w-5 place-items-center rounded-full bg-black/80 text-white"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              {photos.length < MAX_PHOTOS && (
                <button
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                  className="grid h-16 w-16 shrink-0 place-items-center rounded-lg border border-dashed border-loop-line text-loop-muted disabled:opacity-60"
                >
                  {uploading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <ImagePlus className="h-5 w-5" />
                  )}
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={onPickPhotos}
              />
            </div>
            {photoError && <p className="mt-1.5 text-xs text-rose-400">{photoError}</p>}

            <button
              onClick={submit}
              disabled={uploading}
              className="mt-3 w-full rounded-xl bg-loop-green py-3 font-bold text-black transition active:scale-[0.98] disabled:opacity-60"
            >
              Post reaction
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
