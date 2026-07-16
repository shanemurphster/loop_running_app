# Loop 🟢

> Strava shows where you ran. **Loop shows where you should run.**

Loop is a taste-based discovery platform for running routes — not a fitness
tracker. It learns what makes a route good through one-tap reactions and A/B
preference comparisons, then surfaces the best runs near you on a map.

## Stack

- **Next.js** (App Router) + **TypeScript**
- **Tailwind CSS** — mobile-first, centered 480px column on desktop
- **Mapbox GL** for the live map and route drawing (falls back to a
  dependency-free SVG map/outline renderer with no token)
- **Supabase** — Postgres + PostGIS (route geometry, proximity search),
  Auth (email/password + email-code sign-in), Storage (avatars, review photos)
- **Anthropic Claude (Haiku)** — names a route once, at the moment it's
  auto-promoted from aggregated run data (see [Route discovery](#route-discovery))
- **Strava API** — OAuth connect + browse-and-import past activities

## Getting started

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Open http://localhost:3000.

**Supabase is required** — the app reads/writes through it for everything
(routes, reactions, auth, storage). To set one up:

1. Create a free project at [supabase.com](https://supabase.com).
2. In the SQL editor, run every file in [`supabase/migrations/`](supabase/migrations/)
   **in order** (`0001_init.sql` → `0005_reaction_photos.sql`). Each is
   idempotent (`if not exists` / `on conflict do nothing`), so re-running is safe.
3. Copy your project's URL, anon key, and service role key (Project Settings
   → API) into `.env.local` — see the comments in `.env.local.example` for
   which var is which and why the service-role key needs to stay server-only.
4. Optional: seed some demo routes — `curl -X POST http://localhost:3000/api/admin/seed`
   (idempotent; skips if seed routes already exist).

Everything else in `.env.local.example` is optional and independently
gated — the app degrades gracefully without any of it:

| Missing | What you lose |
|---|---|
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Live map + tap-to-draw become a clean SVG fallback; route drawing is disabled |
| `STRAVA_CLIENT_ID`/`SECRET` | "Connect Strava" shows a friendly "not configured" message; GPX upload still works |
| `ANTHROPIC_API_KEY` | The discovery scan (`/add/discover`) finds nothing to promote |
| `LOOP_SIMULATE_RUNS=1` | Without it, the discovery engine has no activity feed to read at all (real Strava/GPX imports don't need this — it's only for exercising the aggregated-run discovery pipeline without real traffic) |

## What's built

- **Home** — Discover feed with Trending / Friend Picks / For You tabs and
  city/type rails.
- **Discover** — map-centric search with live filters (city, type, distance,
  must-have tags, Loop Certified), plus a list view and a route-outline map
  overlay.
- **Route detail** — map, stats (with hover/tap explainers on Loop Score,
  Loop Certified, and tag-signal percentages), "Why runners like this route"
  signals, a photo gallery aggregated from every review, and the one-tap
  reaction flow.
- **Add a route** — three ways in, all converging on the same name/city/type
  publish step:
  - **Draw** — tap to drop points; drag any point *or* drag anywhere along
    the line itself to insert a new point and reshape it; toggle between
    roads-snapped (Mapbox Directions) and straight-line modes.
  - **Import** (`/add/import`) — connect Strava and pick from your past runs,
    or upload a `.gpx` file (exported from Garmin Connect, Strava, or any GPS
    watch). See [Importing a run](#importing-a-run).
  - **Discover from runs** (`/add/discover`) — admin/dev surface for the
    aggregated-run promotion pipeline (see [Route discovery](#route-discovery)).
- **Compare** — the A/B "which would you rather run?" preference engine.
- **Leaderboard** — city-based contributor rankings.
- **Profile** — saved / created / reviewed routes, profile picture upload,
  badges, follower counts, unit preference (mi/km).
- **Auth** — email + password, or email-code (a link *and* a 6-digit code,
  same email); accounts created via code-only sign-in are nudged (dismissible
  banner) to set a password so they're not locked out if they lose inbox
  access.

### Loop Score

Computed in [`src/lib/score.ts`](src/lib/score.ts) — blends reactions
(👍 +2 / 😐 +1 / 👎 −1), A/B win rate, and a recency boost, normalized to 1–10.
Not just an average rating; see the tooltip on the route detail page.

### Route cards

A route card shows its real photo if one was uploaded; otherwise it shows a
plain outline of its own path (`src/components/RouteThumb.tsx` +
`MiniRoute.tsx`) — never a generic stock photo standing in for a route no one
has actually photographed.

## Importing a run

Two ways to turn a real run into a route, both landing on the same
name/city/type "details" step as a hand-drawn route:

- **Strava** — OAuth connect (`/api/strava/connect` → `/api/strava/callback`),
  then browse your activities and pick one. Tokens live in a
  service-role-only `strava_tokens` table (RLS enabled, zero client-facing
  policies — never readable from the browser, mirroring `discovery_clusters`).
  Needs a free app registered at
  [strava.com/settings/api](https://www.strava.com/settings/api) — set its
  "Authorization Callback Domain" to `localhost` for dev.
- **GPX upload** — parsed entirely client-side (`src/lib/gpx.ts`, native
  `DOMParser`); the file itself never touches the server. This is the
  practical path for Garmin (their developer API requires a slow
  partner-approval process not worth it for this project) and works for any
  GPS watch or app that can export GPX.

Imported paths are treated as final, real geometry — they skip the
tap-to-draw editor entirely (it's built for a handful of hand-placed points,
not a GPS trace with hundreds of them) and go straight to a read-only preview.

## Route discovery

Routes are **not** generated on demand. They emerge from aggregated run
data — when enough distinct runners cover the same path, it's promoted into
a route (and Loop Certified at a higher threshold). The one paid call
(Claude Haiku) names a route once, at promotion, capped per scan and deduped
so it never fires twice. See `src/lib/discovery.ts`, `src/lib/aiRoute.ts`,
`/api/discover-routes`, and the "Discover from runs" tile in `/add`.

The activity feed this reads from is simulated today (`LOOP_SIMULATE_RUNS=1`)
— real Strava/GPX imports (above) feed individual routes directly rather
than through this aggregation pipeline; wiring imported activities into the
same discovery feed is a natural next step but isn't built yet.

## Project layout

```
src/
  app/
    add/              # draw, import (Strava/GPX), discover-from-runs
    api/strava/       # OAuth connect/callback/disconnect, activities list + detail
    api/discover-routes/  # aggregated-run promotion scan (server-only, paid AI call)
    route/[id]/       # route detail: map, stats, reviews, photo gallery
    ...               # home, discover, compare, leaderboard, profile, login
  components/         # RouteCard, RouteThumb, RouteDraw, maps, ScoreRing,
                       #   ReactionPrompt, InfoTooltip, SetPasswordBanner, nav…
  lib/
    store.tsx         # the single data layer — every page reads through this
    strava.ts, stravaAuth.ts, polyline.ts   # Strava REST + token refresh + decode
    gpx.ts             # client-side GPX parsing
    discovery.ts, aiRoute.ts   # aggregated-run clustering + AI naming
    supabase/          # browser / server / service-role Supabase clients
supabase/migrations/   # run in order against a fresh Supabase project
```

## Contributing

### Branching workflow

`main` is always deployable — work happens on short-lived branches, merged
back via pull request.

**1. Start from an up-to-date `main`:**

```bash
git checkout main
git pull
```

**2. Create a branch.** Name it `<type>/<short-description>`, e.g.
`feature/route-comments`, `fix/save-button-guest`, `chore/bump-mapbox`:

```bash
git checkout -b feature/short-description
```

**3. Work and commit.** Commit messages: short, present-tense, describe the
*why* over the *what* where it's not obvious (see `git log` for the existing
style — it's informal, that's fine):

```bash
git add <files>          # avoid `git add -A` — review what you're staging
git commit -m "Add comment threading to reviews"
```

**4. Push the branch and open a PR:**

```bash
git push -u origin feature/short-description
gh pr create   # or open the compare view on GitHub
```

**5. Keep your branch current with `main`** while it's in review (merge is
simpler than rebase if you're less git-comfortable — either is fine):

```bash
git checkout main && git pull
git checkout feature/short-description
git merge main
```

**6. After the PR merges**, clean up:

```bash
git checkout main
git pull
git branch -d feature/short-description        # delete local
git push origin --delete feature/short-description   # delete remote
```

### A few conventions specific to this repo

- **Never commit `.env.local`** (it's gitignored) — real Supabase/Strava
  credentials live only there. `.env.local.example` documents every var.
- **New DB changes go in a new numbered file** under `supabase/migrations/`
  (`0006_...sql`, etc.) — never edit an already-applied migration. Every
  migration should be idempotent (`if not exists`, `on conflict do nothing`)
  so it's safe to re-run.
- **RLS matters here.** `profiles` is world-readable by design — never add a
  sensitive column to it. Anything that must never reach the browser (OAuth
  tokens, etc.) belongs in its own table with RLS enabled and *no* policies,
  so only the service-role client (server-only code) can touch it — see
  `strava_tokens` for the pattern.
- Before pushing, run `npm run build` — it typechecks and will catch a
  `server-only` module accidentally imported into a client component, which
  `npm run dev` alone won't always surface immediately.
