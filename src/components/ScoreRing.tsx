import clsx from "clsx";

// Circular Loop Score badge (1–10) — the green ring from the mockup.
export function ScoreRing({
  score,
  size = 44,
  className,
}: {
  score: number;
  size?: number;
  className?: string;
}) {
  const stroke = size < 40 ? 3 : 4;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, score / 10));
  const dash = circumference * pct;

  // Green when great, amber mid, red-ish when poor.
  const color =
    score >= 7.5 ? "#22e06a" : score >= 5.5 ? "#eab308" : "#f97316";

  return (
    <div
      className={clsx("relative grid place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="rgba(0,0,0,0.45)"
          stroke="#2a2a30"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <span
        className="absolute font-bold tabular-nums"
        style={{ fontSize: size < 40 ? 11 : 13, color }}
      >
        {score.toFixed(1)}
      </span>
    </div>
  );
}
