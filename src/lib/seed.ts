import { CITY_CENTERS, makeLoop } from "./geo";
import type {
  City,
  Comparison,
  Reaction,
  ReactionKind,
  Route,
  RouteType,
  User,
} from "./types";

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------

export const SEED_USERS: User[] = [
  { id: "u1", username: "shane", name: "Shane M.", city: "Philadelphia", avatarColor: "#22e06a", badges: ["Local Guide"], bio: "Chasing negative splits." },
  { id: "u2", username: "maya_runs", name: "Maya R.", city: "Miami", avatarColor: "#3b82f6", badges: ["Top Reviewer", "Marathon Runner"] },
  { id: "u3", username: "deej", name: "DJ Patel", city: "New York", avatarColor: "#f59e0b", badges: ["Trail Specialist"] },
  { id: "u4", username: "carla", name: "Carla V.", city: "Miami", avatarColor: "#ec4899", badges: ["Local Guide"] },
  { id: "u5", username: "tomsprints", name: "Tom K.", city: "Philadelphia", avatarColor: "#8b5cf6", badges: ["Top Reviewer"] },
  { id: "u6", username: "nyc_nina", name: "Nina O.", city: "New York", avatarColor: "#14b8a6", badges: ["Marathon Runner"] },
];

export const CURRENT_USER_ID = "u1";

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

const IMG = {
  city: "https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?w=800&q=70",
  river: "https://images.unsplash.com/photo-1502904550040-7534597429ae?w=800&q=70",
  beach: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=70",
  park: "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800&q=70",
  trail: "https://images.unsplash.com/photo-1551632811-561732d1e306?w=800&q=70",
  bridge: "https://images.unsplash.com/photo-1496588152823-86ff7695e68f?w=800&q=70",
};

interface RouteSeed {
  id: string;
  creatorId: string;
  name: string;
  description: string;
  city: City;
  routeType: RouteType;
  distanceMi: number;
  elevationFt: number;
  image: string;
  daysAgo: number;
  certified?: boolean;
  runCount?: number;
}

const ROUTE_SEEDS: RouteSeed[] = [
  // Philadelphia
  { id: "r1", creatorId: "u1", name: "Kelly Drive River Loop", description: "Philly's most iconic long run. Down Kelly Drive, across Falls Bridge, back along West River Drive. Flat, scenic, and packed with runners.", city: "Philadelphia", routeType: "Long Run", distanceMi: 8.7, elevationFt: 95, image: IMG.river, daysAgo: 120, certified: true, runCount: 412 },
  { id: "r2", creatorId: "u5", name: "Boathouse Row Tempo Run", description: "Fast and flat past the lit-up boathouses. Perfect for a controlled tempo effort with mile markers the whole way.", city: "Philadelphia", routeType: "Tempo", distanceMi: 4.8, elevationFt: 30, image: IMG.river, daysAgo: 64 },
  { id: "r3", creatorId: "u5", name: "Manayunk Canal Path", description: "Crushed-gravel towpath along the canal. Soft surface, shaded, and almost no road crossings.", city: "Philadelphia", routeType: "Easy", distanceMi: 4.3, elevationFt: 20, image: IMG.trail, daysAgo: 40 },
  { id: "r4", creatorId: "u1", name: "Wissahickon Forbidden Drive", description: "Gorgeous wooded trail along the creek. Gravel underfoot, total escape from the city.", city: "Philadelphia", routeType: "Trail", distanceMi: 6.2, elevationFt: 240, image: IMG.trail, daysAgo: 200, certified: true, runCount: 530 },
  { id: "r5", creatorId: "u5", name: "Art Museum Steps Repeat", description: "Hill and stair work around the museum. Rocky-style finish optional but encouraged.", city: "Philadelphia", routeType: "Hills", distanceMi: 3.1, elevationFt: 310, image: IMG.city, daysAgo: 15 },
  { id: "r6", creatorId: "u1", name: "Schuylkill Banks Boardwalk", description: "Over-the-water boardwalk connecting Center City to South Philly. Sunset views over the river.", city: "Philadelphia", routeType: "Easy", distanceMi: 5.0, elevationFt: 25, image: IMG.river, daysAgo: 9 },
  { id: "r7", creatorId: "u5", name: "FDR Park Loop", description: "Flat loop around the lakes in South Philly. Good for repeats and easy days.", city: "Philadelphia", routeType: "Easy", distanceMi: 2.4, elevationFt: 12, image: IMG.park, daysAgo: 75 },

  // Miami
  { id: "r8", creatorId: "u4", name: "Crandon Park Beach Run", description: "Crandon Park on Key Biscayne is a runner's paradise. Start at the marina and follow the path along the sand.", city: "Miami", routeType: "Long Run", distanceMi: 7.5, elevationFt: 15, image: IMG.beach, daysAgo: 90, certified: true, runCount: 288 },
  { id: "r9", creatorId: "u2", name: "South Beach Boardwalk", description: "The iconic South Beach run from 5th Street to 23rd Street along the dunes. Ocean on one side the whole way.", city: "Miami", routeType: "Long Run", distanceMi: 5.1, elevationFt: 8, image: IMG.beach, daysAgo: 50 },
  { id: "r10", creatorId: "u2", name: "Venetian Causeway Out & Back", description: "Bridge-hopping across Biscayne Bay. Gentle inclines, bay breeze, and skyline views both directions.", city: "Miami", routeType: "Tempo", distanceMi: 6.0, elevationFt: 60, image: IMG.bridge, daysAgo: 30 },
  { id: "r11", creatorId: "u4", name: "Coral Gables Shade Loop", description: "Tree-lined residential loop with banyan canopy almost the entire way. The coolest run in Miami, literally.", city: "Miami", routeType: "Easy", distanceMi: 4.0, elevationFt: 22, image: IMG.park, daysAgo: 18 },
  { id: "r12", creatorId: "u2", name: "Key Biscayne Lighthouse", description: "Out to the Cape Florida lighthouse through the state park. Quiet, scenic, and well-paved.", city: "Miami", routeType: "Long Run", distanceMi: 9.2, elevationFt: 18, image: IMG.beach, daysAgo: 110, certified: true, runCount: 201 },
  { id: "r13", creatorId: "u4", name: "Brickell Bayfront Tempo", description: "Fast urban loop along the bay walk through Brickell. Smooth pavement, great for threshold work.", city: "Miami", routeType: "Tempo", distanceMi: 4.6, elevationFt: 14, image: IMG.city, daysAgo: 7 },
  { id: "r14", creatorId: "u2", name: "Oleta River Trails", description: "Real off-road singletrack in the middle of the city. Roots, sand, and mangroves.", city: "Miami", routeType: "Trail", distanceMi: 5.5, elevationFt: 130, image: IMG.trail, daysAgo: 22 },

  // New York
  { id: "r15", creatorId: "u6", name: "Central Park Full Loop", description: "The classic 6-mile outer loop. Rolling hills, Harlem Hill at the north end, and runners at every hour.", city: "New York", routeType: "Long Run", distanceMi: 6.1, elevationFt: 380, image: IMG.park, daysAgo: 150, certified: true, runCount: 980 },
  { id: "r16", creatorId: "u3", name: "Brooklyn Bridge Crossing", description: "Manhattan to DUMBO across the Brooklyn Bridge. Crowded but unbeatable views — go early.", city: "New York", routeType: "Easy", distanceMi: 3.4, elevationFt: 110, image: IMG.bridge, daysAgo: 60 },
  { id: "r17", creatorId: "u6", name: "Hudson River Greenway", description: "Flat, fast, uninterrupted path down the west side. The fastest miles in the city.", city: "New York", routeType: "Tempo", distanceMi: 7.0, elevationFt: 40, image: IMG.river, daysAgo: 35 },
  { id: "r18", creatorId: "u3", name: "Prospect Park Loop", description: "Brooklyn's answer to Central Park. Shaded, rolling, and friendlier crowds.", city: "New York", routeType: "Long Run", distanceMi: 3.4, elevationFt: 160, image: IMG.park, daysAgo: 80 },
  { id: "r19", creatorId: "u6", name: "Roosevelt Island Perimeter", description: "Quiet loop with skyline views on every side. Almost no traffic and a lighthouse finish.", city: "New York", routeType: "Easy", distanceMi: 3.8, elevationFt: 30, image: IMG.city, daysAgo: 12 },
  { id: "r20", creatorId: "u3", name: "Van Cortlandt Park Trails", description: "Legendary XC trails in the Bronx. The Cow Path and back hills are a rite of passage.", city: "New York", routeType: "Trail", distanceMi: 5.0, elevationFt: 420, image: IMG.trail, daysAgo: 95, certified: true, runCount: 240 },
];

const NOW = Date.UTC(2026, 5, 17); // stable "now" for deterministic seed timestamps

function isoDaysAgo(days: number): string {
  return new Date(NOW - days * 86400000).toISOString();
}

export const SEED_ROUTES: Route[] = ROUTE_SEEDS.map((s, i) => {
  const { center } = CITY_CENTERS[s.city];
  return {
    id: s.id,
    creatorId: s.creatorId,
    name: s.name,
    description: s.description,
    city: s.city,
    routeType: s.routeType,
    distanceMi: s.distanceMi,
    elevationFt: s.elevationFt,
    path: makeLoop(center, s.distanceMi, i + 1),
    image: s.image,
    createdAt: isoDaysAgo(s.daysAgo),
    loopCertified: s.certified,
    runCount: s.runCount,
  };
});

// ---------------------------------------------------------------------------
// Reactions — deterministically generated so scores are stable but varied.
// ---------------------------------------------------------------------------

const POSITIVE_TAG_IDS = ["shade", "scenic", "pavement", "low-traffic", "safe", "bathrooms", "water"];
const NEGATIVE_TAG_IDS = ["traffic", "no-shade", "bad-pavement", "unsafe", "confusing"];

// Per-route reaction "quality" — controls the like/ok/dislike mix (0..1).
const ROUTE_QUALITY: Record<string, number> = {
  r1: 0.92, r2: 0.78, r3: 0.7, r4: 0.95, r5: 0.6, r6: 0.82, r7: 0.55,
  r8: 0.88, r9: 0.84, r10: 0.76, r11: 0.9, r12: 0.86, r13: 0.72, r14: 0.68,
  r15: 0.96, r16: 0.74, r17: 0.85, r18: 0.8, r19: 0.71, r20: 0.83,
};

const REVIEW_TEXTS = [
  "Best run I've done all month. Felt smooth the whole way.",
  "Great surface, would do tempo here again.",
  "Bit crowded around mile 2 but worth it.",
  "Shade saved me on a hot day.",
  "Stunning at sunrise.",
  "",
  "",
  "Got a little lost at the turnaround — signage could be better.",
  "Flat and fast. New PR.",
  "",
];

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function buildReactions(): Reaction[] {
  const reactions: Reaction[] = [];
  let n = 0;
  for (let ri = 0; ri < SEED_ROUTES.length; ri++) {
    const route = SEED_ROUTES[ri];
    const quality = ROUTE_QUALITY[route.id] ?? 0.7;
    const rand = mulberry32(ri * 7919 + 13);
    const count = 6 + Math.floor(rand() * 8); // 6..13 reactions each
    for (let k = 0; k < count; k++) {
      const roll = rand();
      let reaction: ReactionKind;
      if (roll < quality) reaction = "like";
      else if (roll < quality + (1 - quality) * 0.6) reaction = "ok";
      else reaction = "dislike";

      const pool = reaction === "dislike" ? NEGATIVE_TAG_IDS : POSITIVE_TAG_IDS;
      const tagCount = Math.floor(rand() * 3); // 0..2 tags
      const tags = new Set<string>();
      for (let t = 0; t < tagCount; t++) {
        tags.add(pool[Math.floor(rand() * pool.length)]);
      }

      const user = SEED_USERS[Math.floor(rand() * SEED_USERS.length)];
      reactions.push({
        id: `re${++n}`,
        userId: user.id,
        routeId: route.id,
        reaction,
        tags: [...tags],
        text: rand() < 0.4 ? REVIEW_TEXTS[Math.floor(rand() * REVIEW_TEXTS.length)] : "",
        createdAt: isoDaysAgo(Math.floor(rand() * 60)),
        fromActivity: rand() < 0.25,
      });
    }
  }
  return reactions;
}

export const SEED_REACTIONS: Reaction[] = buildReactions();

// ---------------------------------------------------------------------------
// Comparisons — A/B preference choices within the same city.
// ---------------------------------------------------------------------------

function buildComparisons(): Comparison[] {
  const comparisons: Comparison[] = [];
  let n = 0;
  const byCity: Record<string, Route[]> = {};
  for (const r of SEED_ROUTES) (byCity[r.city] ||= []).push(r);

  const rand = mulberry32(424242);
  for (const city of Object.keys(byCity)) {
    const routes = byCity[city];
    for (let i = 0; i < 14; i++) {
      const a = routes[Math.floor(rand() * routes.length)];
      let b = routes[Math.floor(rand() * routes.length)];
      if (a.id === b.id) b = routes[(routes.indexOf(b) + 1) % routes.length];
      // Higher-quality route tends to win.
      const qa = ROUTE_QUALITY[a.id] ?? 0.7;
      const qb = ROUTE_QUALITY[b.id] ?? 0.7;
      const roll = rand();
      let winner: Comparison["winner"];
      if (roll < 0.15) winner = "tie";
      else winner = qa >= qb ? "a" : "b";

      const user = SEED_USERS[Math.floor(rand() * SEED_USERS.length)];
      comparisons.push({
        id: `c${++n}`,
        userId: user.id,
        routeAId: a.id,
        routeBId: b.id,
        winner,
        createdAt: isoDaysAgo(Math.floor(rand() * 45)),
      });
    }
  }
  return comparisons;
}

export const SEED_COMPARISONS: Comparison[] = buildComparisons();

export const SEED_SAVED: { userId: string; routeId: string }[] = [
  { userId: "u1", routeId: "r4" },
  { userId: "u1", routeId: "r15" },
];

export const SEED_FOLLOWS: { followerId: string; followingId: string }[] = [
  { followerId: "u1", followingId: "u5" },
  { followerId: "u1", followingId: "u2" },
  { followerId: "u5", followingId: "u1" },
];
