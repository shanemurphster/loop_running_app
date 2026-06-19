import type { Comparison, Reaction, Route } from "./types";

// Loop Score (1–10) blends three signals, per the product spec:
//   1. Reactions   👍 +2 / 😐 +1 / 👎 -1
//   2. A/B wins    win rate across comparisons (tie = neutral)
//   3. Recency     newer routes get a small visibility boost
//
// Each signal is normalized to 0..1, blended, then mapped to 1..10.

const REACTION_POINTS: Record<Reaction["reaction"], number> = {
  like: 2,
  ok: 1,
  dislike: -1,
};

const WEIGHTS = { reactions: 0.6, comparisons: 0.3, recency: 0.1 };

const DAY = 1000 * 60 * 60 * 24;

function reactionSignal(reactions: Reaction[]): number {
  if (reactions.length === 0) return 0.5; // neutral prior
  const avg =
    reactions.reduce((sum, r) => sum + REACTION_POINTS[r.reaction], 0) /
    reactions.length; // range [-1, 2]
  return (avg + 1) / 3; // -> [0, 1]
}

function comparisonSignal(routeId: string, comparisons: Comparison[]): number {
  let wins = 0;
  let games = 0;
  for (const c of comparisons) {
    const isA = c.routeAId === routeId;
    const isB = c.routeBId === routeId;
    if (!isA && !isB) continue;
    games += 1;
    if (c.winner === "tie") wins += 0.5;
    else if ((c.winner === "a" && isA) || (c.winner === "b" && isB)) wins += 1;
  }
  if (games === 0) return 0.5; // neutral prior
  return wins / games; // [0, 1]
}

function recencySignal(route: Route, now: number): number {
  const ageDays = Math.max(0, (now - new Date(route.createdAt).getTime()) / DAY);
  // Full boost when brand new, decaying to ~0 over ~90 days.
  return Math.max(0, 1 - ageDays / 90);
}

export function computeLoopScore(
  route: Route,
  reactions: Reaction[],
  comparisons: Comparison[],
  now: number = Date.now()
): number {
  const routeReactions = reactions.filter((r) => r.routeId === route.id);
  const blended =
    WEIGHTS.reactions * reactionSignal(routeReactions) +
    WEIGHTS.comparisons * comparisonSignal(route.id, comparisons) +
    WEIGHTS.recency * recencySignal(route, now);
  const score = 1 + blended * 9; // 1..10
  return Math.round(score * 10) / 10;
}
