"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

// Wraps a trigger (a score ring, a badge, a heading…) so hovering it on
// desktop or tapping it on mobile pops a short explanation. Used for the
// handful of things in the UI that aren't self-explanatory at a glance.
export function InfoTooltip({
  text,
  children,
  align = "center",
  className,
}: {
  text: string;
  children: React.ReactNode;
  align?: "center" | "right";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("click", onDocClick);
    return () => document.removeEventListener("click", onDocClick);
  }, [open]);

  return (
    <span
      ref={ref}
      className={clsx("relative inline-flex cursor-help", className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onClick={(e) => {
        // Stop taps from also activating a wrapping <Link>/button.
        e.preventDefault();
        e.stopPropagation();
        setOpen((o) => !o);
      }}
    >
      {children}
      {open && (
        <span
          role="tooltip"
          className={clsx(
            "absolute top-full z-50 mt-2 w-56 rounded-lg border border-loop-line bg-loop-panel p-2.5 text-left text-xs font-normal normal-case leading-snug text-zinc-200 shadow-xl",
            align === "right" ? "right-0" : "left-1/2 -translate-x-1/2"
          )}
        >
          {text}
        </span>
      )}
    </span>
  );
}
