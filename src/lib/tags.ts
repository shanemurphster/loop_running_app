import type { TagDef } from "./types";

// The full tag vocabulary. Reactions reference these by id.
export const TAGS: TagDef[] = [
  // Positive
  { id: "shade", label: "Shade", emoji: "🌳", sentiment: "positive" },
  { id: "scenic", label: "Scenic", emoji: "🌅", sentiment: "positive" },
  { id: "pavement", label: "Good pavement", emoji: "🛣️", sentiment: "positive" },
  { id: "low-traffic", label: "Low traffic", emoji: "🚦", sentiment: "positive" },
  { id: "safe", label: "Safe feeling", emoji: "🧍", sentiment: "positive" },
  { id: "bathrooms", label: "Bathrooms", emoji: "🚻", sentiment: "positive" },
  { id: "water", label: "Water access", emoji: "🚰", sentiment: "positive" },
  // Negative
  { id: "traffic", label: "Traffic", emoji: "🚗", sentiment: "negative" },
  { id: "no-shade", label: "No shade", emoji: "🌞", sentiment: "negative" },
  { id: "bad-pavement", label: "Bad pavement", emoji: "🕳️", sentiment: "negative" },
  { id: "unsafe", label: "Unsafe", emoji: "⚠️", sentiment: "negative" },
  { id: "confusing", label: "Confusing route", emoji: "🔁", sentiment: "negative" },
];

export const TAG_MAP: Record<string, TagDef> = Object.fromEntries(
  TAGS.map((t) => [t.id, t])
);

export const POSITIVE_TAGS = TAGS.filter((t) => t.sentiment === "positive");
export const NEGATIVE_TAGS = TAGS.filter((t) => t.sentiment === "negative");
