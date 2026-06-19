"use client";

import { Bookmark } from "lucide-react";
import clsx from "clsx";
import { useStore } from "@/lib/store";

export function SaveButton({
  routeId,
  className,
}: {
  routeId: string;
  className?: string;
}) {
  const { isSaved, toggleSave } = useStore();
  const saved = isSaved(routeId);

  return (
    <button
      type="button"
      aria-label={saved ? "Unsave route" : "Save route"}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleSave(routeId);
      }}
      className={clsx(
        "grid h-9 w-9 place-items-center rounded-full bg-black/55 backdrop-blur-sm transition active:scale-90",
        className
      )}
    >
      <Bookmark
        className={clsx("h-[18px] w-[18px]", saved ? "text-loop-green" : "text-white")}
        fill={saved ? "#22e06a" : "none"}
      />
    </button>
  );
}
