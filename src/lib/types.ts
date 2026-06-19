// Core domain types for Loop.
// Kept framework-agnostic so the same shapes map cleanly onto a Supabase
// schema in a later milestone.

export type ReactionKind = "like" | "ok" | "dislike";

export type ComparisonWinner = "a" | "b" | "tie";

/** Route "vibe" classification — drives the colored badge on cards. */
export type RouteType = "Long Run" | "Tempo" | "Easy" | "Trail" | "Track" | "Hills";

export type City = "Philadelphia" | "Miami" | "New York";

/** A positive/negative signal tag a runner can attach to a reaction. */
export interface TagDef {
  id: string;
  label: string;
  emoji: string;
  sentiment: "positive" | "negative";
}

/** [longitude, latitude] — GeoJSON ordering. */
export type LngLat = [number, number];

export interface User {
  id: string;
  username: string;
  name: string;
  city: City;
  avatarColor: string; // fallback avatar bg when no photo
  badges: string[];
  bio?: string;
}

export interface Reaction {
  id: string;
  userId: string;
  routeId: string;
  reaction: ReactionKind;
  tags: string[]; // TagDef ids
  text?: string;
  photos?: string[];
  createdAt: string; // ISO
  /** True when auto-created from a synced Strava/Garmin activity. */
  fromActivity?: boolean;
}

export interface Comparison {
  id: string;
  userId: string;
  routeAId: string;
  routeBId: string;
  winner: ComparisonWinner;
  createdAt: string;
}

export interface Route {
  id: string;
  creatorId: string;
  name: string;
  description: string;
  city: City;
  routeType: RouteType;
  distanceMi: number;
  elevationFt: number;
  /** Loop geometry as [lng, lat] points. Used by both Mapbox and SVG fallback. */
  path: LngLat[];
  image: string;
  createdAt: string;
  /** Auto-promoted from real run traces once popular enough. */
  loopCertified?: boolean;
  /** How many distinct runners have logged this route (drives certification). */
  runCount?: number;
  /** Where this route came from. "discovered" = surfaced from aggregated runs. */
  source?: "seed" | "user" | "discovered";
  /**
   * Tags the AI predicted at discovery time, before any real reactions exist.
   * Shown as "predicted" on the detail page until runners weigh in. Tag ids.
   */
  predictedTags?: string[];
}

/** A route with its derived, display-ready stats. */
export interface RouteWithStats extends Route {
  loopScore: number; // 1–10, one decimal
  likeCount: number;
  ratingCount: number;
  tagSignals: { tag: TagDef; pct: number }[];
}
