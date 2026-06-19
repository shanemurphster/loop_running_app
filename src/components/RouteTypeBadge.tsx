import clsx from "clsx";
import type { RouteType } from "@/lib/types";

const STYLES: Record<RouteType, string> = {
  "Long Run": "bg-blue-500/20 text-blue-300",
  Tempo: "bg-orange-500/20 text-orange-300",
  Easy: "bg-emerald-500/20 text-emerald-300",
  Trail: "bg-amber-600/20 text-amber-300",
  Track: "bg-purple-500/20 text-purple-300",
  Hills: "bg-rose-500/20 text-rose-300",
};

export function RouteTypeBadge({
  type,
  className,
}: {
  type: RouteType;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "rounded-md px-2 py-0.5 text-xs font-semibold backdrop-blur-sm",
        STYLES[type],
        className
      )}
    >
      {type}
    </span>
  );
}
