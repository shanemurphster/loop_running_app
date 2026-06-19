# Loop 🟢

> Strava shows where you ran. **Loop shows where you should run.**

Loop is a taste-based discovery platform for running routes — not a fitness
tracker. It learns what makes a route good through one-tap reactions and A/B
preference comparisons, then surfaces the best runs near you on a map.

## Stack

- **Next.js** (App Router) + **TypeScript**
- **Tailwind CSS** — mobile-first, centered 480px column on desktop
- **Mapbox GL** for the live map (falls back to a clean SVG map with no token)
- Mock data layer today; **Supabase** swaps in behind the same hooks later

## Getting started

```bash
npm install
cp .env.local.example .env.local   # optional — add a Mapbox token for live maps
npm run dev
```

Open http://localhost:3000. The app works fully **without any keys** — it runs on
a seeded in-memory data layer (persisted to `localStorage`) and renders an SVG
fallback map. Add `NEXT_PUBLIC_MAPBOX_TOKEN` to turn on interactive Mapbox.

## What's built (Milestone 1)

- **Home** — Discover feed with Trending / Friend Picks / For You tabs and
  city/type rails.
- **Discover** — map-centric search with live filters (city, type, distance,
  must-have tags, Loop Certified), plus a list view.
- **Route detail** — map, stats, "Why runners like this route" tag signals,
  reviews, and the one-tap reaction flow.
- **Add route** — manual entry now; AI Maker / GPX / Strava+Garmin tiles are
  stubbed for later milestones.
- **Compare** — the A/B "which would you rather run?" preference engine.
- **Leaderboard** — city-based contributor rankings.
- **Profile** — saved / created / reviewed routes, badges, follower counts.

### Loop Score

Computed in [`src/lib/score.ts`](src/lib/score.ts) — blends reactions
(👍 +2 / 😐 +1 / 👎 −1), A/B win rate, and a recency boost, normalized to 1–10.

## Architecture seams (for later milestones)

The whole app reads through the hooks in [`src/lib/store.tsx`](src/lib/store.tsx).
Swapping the mock internals for Supabase queries leaves every page untouched.

- **Milestone 2 — route discovery (built):** routes are NOT generated on
  demand. They emerge from aggregated run data — when enough distinct runners
  cover the same path, it's promoted into a route (and Loop Certified at a
  higher threshold). The one paid call (Claude **Haiku**) names a route once, at
  promotion, capped per scan and deduped so it never fires twice. See
  `src/lib/discovery.ts`, `src/lib/aiRoute.ts`, `/api/discover-routes`, and the
  "Auto-discover" tile in `/add`. Runs on a simulated activity feed today.
- **Milestone 3 — Strava / Garmin:** OAuth import of activities → feeds the same
  discovery engine and auto "rate this run?" prompts. Hook: the "Strava /
  Garmin" tile, `getActivityFeed()` in `discovery.ts`, `fromActivity` on reactions.
- **Milestone 4 — richer clustering:** map-match traces and medoid geometry;
  the threshold/certification machinery already lives in `discovery.ts`.

## Project layout

```
src/
  app/            # routes (home, discover, route/[id], add, compare, leaderboard, profile)
  components/     # RouteCard, maps, ScoreRing, ReactionPrompt, filters, nav…
  lib/            # types, score, geo, tags, filters, seed data, store (data layer)
```
