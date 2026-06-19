"use client";

// Mock data layer for Loop.
//
// This is the single seam we swap out for Supabase later: every page reads
// through these hooks rather than touching seed data directly. Replacing the
// internals with Supabase queries leaves the component code untouched.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { computeLoopScore } from "./score";
import {
  CURRENT_USER_ID,
  SEED_COMPARISONS,
  SEED_FOLLOWS,
  SEED_REACTIONS,
  SEED_ROUTES,
  SEED_SAVED,
  SEED_USERS,
} from "./seed";
import { TAG_MAP } from "./tags";
import type {
  Comparison,
  ComparisonWinner,
  Reaction,
  ReactionKind,
  Route,
  RouteWithStats,
  User,
} from "./types";

interface Mutations {
  reactions: Reaction[];
  comparisons: Comparison[];
  saved: { userId: string; routeId: string }[];
  routes: Route[]; // user-added routes (seed routes live separately)
}

const STORAGE_KEY = "loop.mutations.v1";

const EMPTY: Mutations = { reactions: [], comparisons: [], saved: [], routes: [] };

interface StoreValue {
  ready: boolean;
  currentUser: User;
  users: User[];
  routes: RouteWithStats[];
  getRoute: (id: string) => RouteWithStats | undefined;
  getUser: (id: string) => User | undefined;
  reactions: Reaction[]; // all reactions (seed + local), for aggregates
  reactionsFor: (routeId: string) => Reaction[];
  isSaved: (routeId: string) => boolean;
  followingIds: string[];
  // mutations
  addReaction: (input: {
    routeId: string;
    reaction: ReactionKind;
    tags?: string[];
    text?: string;
  }) => void;
  addComparison: (routeAId: string, routeBId: string, winner: ComparisonWinner) => void;
  toggleSave: (routeId: string) => void;
  addRoute: (route: Route) => void;
  /** Add routes surfaced by the discovery pipeline (deduped by id). */
  addDiscoveredRoutes: (routes: Route[]) => void;
  /** Cluster ids already turned into routes — sent to the API so it never re-names them. */
  discoveredClusterIds: string[];
}

const StoreContext = createContext<StoreValue | null>(null);

function loadMutations(): Mutations {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    return { ...EMPTY, ...JSON.parse(raw) };
  } catch {
    return EMPTY;
  }
}

let idCounter = 0;
function localId(prefix: string) {
  idCounter += 1;
  return `${prefix}_local_${idCounter}_${performance.now().toString(36)}`;
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [mut, setMut] = useState<Mutations>(EMPTY);
  const [ready, setReady] = useState(false);

  // Hydrate from localStorage after mount to avoid SSR mismatch.
  useEffect(() => {
    setMut(loadMutations());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(mut));
    } catch {
      /* storage full or unavailable — fine for a mock layer */
    }
  }, [mut, ready]);

  const allReactions = useMemo(
    () => [...SEED_REACTIONS, ...mut.reactions],
    [mut.reactions]
  );
  const allComparisons = useMemo(
    () => [...SEED_COMPARISONS, ...mut.comparisons],
    [mut.comparisons]
  );
  const allRoutes = useMemo(() => [...SEED_ROUTES, ...mut.routes], [mut.routes]);

  const routes: RouteWithStats[] = useMemo(() => {
    return allRoutes.map((route) => {
      const routeReactions = allReactions.filter((r) => r.routeId === route.id);
      const likeCount = routeReactions.filter((r) => r.reaction === "like").length;

      // Tag signals: % of reactions that included each tag.
      const tally = new Map<string, number>();
      for (const r of routeReactions) {
        for (const t of r.tags) tally.set(t, (tally.get(t) ?? 0) + 1);
      }
      const tagSignals = [...tally.entries()]
        .map(([tagId, n]) => ({
          tag: TAG_MAP[tagId],
          pct: routeReactions.length
            ? Math.round((n / routeReactions.length) * 100)
            : 0,
        }))
        .filter((s) => s.tag)
        .sort((a, b) => b.pct - a.pct);

      return {
        ...route,
        loopScore: computeLoopScore(route, allReactions, allComparisons),
        likeCount,
        ratingCount: routeReactions.length,
        tagSignals,
      };
    });
  }, [allRoutes, allReactions, allComparisons]);

  const routeMap = useMemo(
    () => new Map(routes.map((r) => [r.id, r])),
    [routes]
  );

  const followingIds = useMemo(() => {
    return SEED_FOLLOWS.filter((f) => f.followerId === CURRENT_USER_ID).map(
      (f) => f.followingId
    );
  }, []);

  const savedSet = useMemo(() => {
    const all = [...SEED_SAVED, ...mut.saved].filter(
      (s) => s.userId === CURRENT_USER_ID
    );
    return new Set(all.map((s) => s.routeId));
  }, [mut.saved]);

  const addReaction = useCallback<StoreValue["addReaction"]>((input) => {
    const reaction: Reaction = {
      id: localId("re"),
      userId: CURRENT_USER_ID,
      routeId: input.routeId,
      reaction: input.reaction,
      tags: input.tags ?? [],
      text: input.text ?? "",
      createdAt: new Date().toISOString(),
    };
    setMut((m) => ({ ...m, reactions: [...m.reactions, reaction] }));
  }, []);

  const addComparison = useCallback<StoreValue["addComparison"]>(
    (routeAId, routeBId, winner) => {
      const comparison: Comparison = {
        id: localId("c"),
        userId: CURRENT_USER_ID,
        routeAId,
        routeBId,
        winner,
        createdAt: new Date().toISOString(),
      };
      setMut((m) => ({ ...m, comparisons: [...m.comparisons, comparison] }));
    },
    []
  );

  const toggleSave = useCallback<StoreValue["toggleSave"]>((routeId) => {
    setMut((m) => {
      const exists = m.saved.some(
        (s) => s.userId === CURRENT_USER_ID && s.routeId === routeId
      );
      const seedHas = SEED_SAVED.some(
        (s) => s.userId === CURRENT_USER_ID && s.routeId === routeId
      );
      // Toggle within our mutation layer. (Seed saves can be "unsaved" by
      // adding a tombstone — kept simple here: seed saves are sticky.)
      if (exists) {
        return {
          ...m,
          saved: m.saved.filter(
            (s) => !(s.userId === CURRENT_USER_ID && s.routeId === routeId)
          ),
        };
      }
      if (seedHas) return m;
      return {
        ...m,
        saved: [...m.saved, { userId: CURRENT_USER_ID, routeId }],
      };
    });
  }, []);

  const addRoute = useCallback<StoreValue["addRoute"]>((route) => {
    setMut((m) => ({ ...m, routes: [...m.routes, route] }));
  }, []);

  const addDiscoveredRoutes = useCallback<StoreValue["addDiscoveredRoutes"]>(
    (incoming) => {
      setMut((m) => {
        const have = new Set(m.routes.map((r) => r.id));
        const fresh = incoming.filter((r) => !have.has(r.id));
        if (fresh.length === 0) return m;
        return { ...m, routes: [...m.routes, ...fresh] };
      });
    },
    []
  );

  const discoveredClusterIds = useMemo(
    () =>
      [...SEED_ROUTES, ...mut.routes]
        .filter((r) => r.source === "discovered")
        .map((r) => r.id),
    [mut.routes]
  );

  const value: StoreValue = useMemo(
    () => ({
      ready,
      currentUser: SEED_USERS.find((u) => u.id === CURRENT_USER_ID)!,
      users: SEED_USERS,
      routes,
      getRoute: (id) => routeMap.get(id),
      getUser: (id) => SEED_USERS.find((u) => u.id === id),
      reactions: allReactions,
      reactionsFor: (routeId) =>
        allReactions
          .filter((r) => r.routeId === routeId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      isSaved: (routeId) => savedSet.has(routeId),
      followingIds,
      addReaction,
      addComparison,
      toggleSave,
      addRoute,
      addDiscoveredRoutes,
      discoveredClusterIds,
    }),
    [
      ready,
      routes,
      routeMap,
      allReactions,
      savedSet,
      followingIds,
      addReaction,
      addComparison,
      toggleSave,
      addRoute,
      addDiscoveredRoutes,
      discoveredClusterIds,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
