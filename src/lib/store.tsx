"use client";

// Data layer — now backed by Supabase (was a localStorage mock).
//
// The hook surface (useStore) is intentionally close to the old one so pages
// barely change. Reads run under RLS as `anon` (guest browsing) until a user
// signs in; writes require auth and are gated through requireAuth(), which pops
// the sign-in sheet for guests. Loop Score is still computed in-app.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User as AuthUser } from "@supabase/supabase-js";
import { createClient } from "./supabase/client";
import { computeLoopScore } from "./score";
import { TAG_MAP } from "./tags";
import {
  feetToMeters,
  lineToEwkt,
  metersToFeet,
  metersToMiles,
  milesToMeters,
  pointToEwkt,
  type Unit,
} from "./units";
import type {
  Comparison,
  ComparisonWinner,
  LngLat,
  Reaction,
  ReactionKind,
  Route,
  RouteWithStats,
  User,
} from "./types";

const DEFAULT_IMG =
  "https://images.unsplash.com/photo-1502904550040-7534597429ae?w=800&q=70";

const GUEST_USER: User = {
  id: "guest",
  username: "guest",
  name: "Guest",
  city: "",
  avatarColor: "#3f3f46",
  badges: [],
};

const LOOP_USER: User = {
  id: "loop",
  username: "loop",
  name: "Loop",
  city: "",
  avatarColor: "#22e06a",
  badges: ["Community"],
};

export interface NewRoute {
  name: string;
  description: string;
  city: string;
  routeType: string;
  surface?: string;
  flatness?: string;
  path: LngLat[];
  distanceMi: number;
  elevationFt: number;
  image?: string;
}

interface StoreValue {
  ready: boolean;
  // auth
  user: AuthUser | null; // null = pure guest (no session)
  isGuest: boolean; // no session or anonymous session
  currentUser: User; // profile, or a guest placeholder
  unit: Unit;
  signInWithEmail: (email: string) => Promise<{ error?: string }>; // magic link / OTP
  verifyEmailCode: (email: string, code: string) => Promise<{ error?: string }>;
  signUpWithPassword: (
    email: string,
    password: string
  ) => Promise<{ error?: string; needsConfirm?: boolean }>;
  signInWithPassword: (
    email: string,
    password: string
  ) => Promise<{ error?: string }>;
  signInAsGuest: () => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  authPromptOpen: boolean;
  openAuthPrompt: () => void;
  closeAuthPrompt: () => void;
  // data
  users: User[];
  routes: RouteWithStats[];
  getRoute: (id: string) => RouteWithStats | undefined;
  getUser: (id: string) => User | undefined;
  reactions: Reaction[];
  reactionsFor: (routeId: string) => Reaction[];
  isSaved: (routeId: string) => boolean;
  followingIds: string[];
  followerCount: number;
  // mutations (require auth; guests get the sign-in sheet)
  addReaction: (input: {
    routeId: string;
    reaction: ReactionKind;
    tags?: string[];
    text?: string;
  }) => Promise<void>;
  addComparison: (
    routeAId: string,
    routeBId: string,
    winner: ComparisonWinner
  ) => Promise<void>;
  toggleSave: (routeId: string) => Promise<void>;
  addRoute: (input: NewRoute) => Promise<string | null>;
  isFollowing: (userId: string) => boolean;
  toggleFollow: (userId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

// ---------------------------------------------------------------------------
// Row → app-type mappers
// ---------------------------------------------------------------------------

function mapProfile(r: Record<string, unknown>): User {
  return {
    id: r.id as string,
    username: (r.username as string) ?? "runner",
    name: (r.name as string) ?? "",
    city: (r.city as string) ?? "",
    avatarColor: (r.avatar_color as string) ?? "#22e06a",
    avatarUrl: (r.avatar_url as string) ?? undefined,
    badges: (r.badges as string[]) ?? [],
    bio: (r.bio as string) ?? undefined,
  };
}

function parseLineString(geojson: unknown): LngLat[] {
  if (typeof geojson !== "string") return [];
  try {
    const g = JSON.parse(geojson) as { coordinates?: number[][] };
    return (g.coordinates ?? []).map((c) => [c[0], c[1]] as LngLat);
  } catch {
    return [];
  }
}

function mapRoute(r: Record<string, unknown>): Route {
  return {
    id: r.id as string,
    creatorId: (r.creator_id as string) ?? "loop",
    name: r.name as string,
    description: (r.description as string) ?? "",
    city: (r.city as string) ?? "",
    routeType: (r.route_type as string) ?? "Easy",
    surface: (r.surface as string) ?? undefined,
    flatness: (r.flatness as string) ?? undefined,
    distanceMi: metersToMiles((r.distance_m as number) ?? 0),
    elevationFt: metersToFeet((r.elevation_m as number) ?? 0),
    path: parseLineString(r.geom_geojson),
    image: (r.image as string) ?? DEFAULT_IMG,
    createdAt: r.created_at as string,
    loopCertified: (r.loop_certified as boolean) ?? false,
    runCount: (r.run_count as number) ?? 0,
    source: (r.source as Route["source"]) ?? "user",
    predictedTags: (r.predicted_tags as string[]) ?? [],
  };
}

function mapReaction(r: Record<string, unknown>): Reaction {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    routeId: r.route_id as string,
    reaction: r.reaction as ReactionKind,
    tags: (r.tags as string[]) ?? [],
    text: (r.text as string) ?? "",
    photos: (r.photos as string[]) ?? [],
    createdAt: r.created_at as string,
    fromActivity: (r.from_activity as boolean) ?? false,
  };
}

function mapComparison(r: Record<string, unknown>): Comparison {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    routeAId: r.route_a_id as string,
    routeBId: r.route_b_id as string,
    winner: r.winner as ComparisonWinner,
    createdAt: r.created_at as string,
  };
}

const ROUTE_COLUMNS =
  "id,creator_id,name,description,city,route_type,surface,flatness,distance_m,elevation_m,image,source,loop_certified,run_count,predicted_tags,cluster_id,created_at,geom_geojson";

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => createClient(), []);

  const [ready, setReady] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [unit, setUnit] = useState<Unit>("mi");
  const [profiles, setProfiles] = useState<User[]>([]);
  const [rawRoutes, setRawRoutes] = useState<Route[]>([]);
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const [comparisons, setComparisons] = useState<Comparison[]>([]);
  const [savedSet, setSavedSet] = useState<Set<string>>(new Set());
  const [followingIds, setFollowingIds] = useState<string[]>([]);
  const [followerCount, setFollowerCount] = useState(0);
  const [authPromptOpen, setAuthPromptOpen] = useState(false);

  // --- public (RLS anon) data ---
  const loadData = useCallback(async () => {
    const [routesRes, reactionsRes, comparisonsRes, profilesRes] =
      await Promise.all([
        supabase.from("routes_geojson").select(ROUTE_COLUMNS),
        supabase.from("reactions").select("*"),
        supabase.from("comparisons").select("*"),
        supabase.from("profiles").select("*"),
      ]);
    setRawRoutes((routesRes.data ?? []).map(mapRoute));
    setReactions((reactionsRes.data ?? []).map(mapReaction));
    setComparisons((comparisonsRes.data ?? []).map(mapComparison));
    setProfiles((profilesRes.data ?? []).map(mapProfile));
    setReady(true);
  }, [supabase]);

  // --- per-user (profile, unit, saves, follows) ---
  const loadUser = useCallback(
    async (uid: string | null) => {
      if (!uid) {
        setProfile(null);
        setUnit("mi");
        setSavedSet(new Set());
        setFollowingIds([]);
        setFollowerCount(0);
        return;
      }
      const [prof, saved, following, followers] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", uid).maybeSingle(),
        supabase.from("saved_routes").select("route_id").eq("user_id", uid),
        supabase.from("follows").select("following_id").eq("follower_id", uid),
        supabase
          .from("follows")
          .select("follower_id", { count: "exact", head: true })
          .eq("following_id", uid),
      ]);
      setProfile(prof.data ? mapProfile(prof.data) : null);
      setUnit(
        (prof.data?.unit_preference as string) === "km" ? "km" : "mi"
      );
      setSavedSet(new Set((saved.data ?? []).map((s) => s.route_id as string)));
      setFollowingIds(
        (following.data ?? []).map((f) => f.following_id as string)
      );
      setFollowerCount(followers.count ?? 0);
    },
    [supabase]
  );

  useEffect(() => {
    let mounted = true;
    loadData();
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      setAuthUser(data.user ?? null);
      loadUser(data.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
      loadUser(session?.user?.id ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase, loadData, loadUser]);

  // --- derived: routes with Loop Score + tag signals ---
  const routes: RouteWithStats[] = useMemo(() => {
    return rawRoutes.map((route) => {
      const routeReactions = reactions.filter((r) => r.routeId === route.id);
      const likeCount = routeReactions.filter(
        (r) => r.reaction === "like"
      ).length;
      const tally = new Map<string, number>();
      for (const r of routeReactions)
        for (const t of r.tags) tally.set(t, (tally.get(t) ?? 0) + 1);
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
        loopScore: computeLoopScore(route, reactions, comparisons),
        likeCount,
        ratingCount: routeReactions.length,
        tagSignals,
      };
    });
  }, [rawRoutes, reactions, comparisons]);

  const routeMap = useMemo(
    () => new Map(routes.map((r) => [r.id, r])),
    [routes]
  );
  const profileMap = useMemo(
    () => new Map(profiles.map((p) => [p.id, p])),
    [profiles]
  );

  // --- auth ---
  const signInWithEmail = useCallback(
    async (email: string) => {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      return { error: error?.message };
    },
    [supabase]
  );
  const verifyEmailCode = useCallback(
    async (email: string, code: string) => {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: code.trim(),
        type: "email",
      });
      return { error: error?.message };
    },
    [supabase]
  );
  const signUpWithPassword = useCallback(
    async (email: string, password: string) => {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) return { error: error.message };
      // No session => the project requires email confirmation.
      return { needsConfirm: !data.session };
    },
    [supabase]
  );
  const signInWithPassword = useCallback(
    async (email: string, password: string) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: error?.message };
    },
    [supabase]
  );
  const signInAsGuest = useCallback(async () => {
    const { error } = await supabase.auth.signInAnonymously();
    if (!error) setAuthPromptOpen(false);
    return { error: error?.message };
  }, [supabase]);
  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, [supabase]);

  const requireAuth = useCallback(() => {
    if (authUser) return true;
    setAuthPromptOpen(true);
    return false;
  }, [authUser]);

  // --- mutations ---
  const reloadReactions = useCallback(async () => {
    const { data } = await supabase.from("reactions").select("*");
    setReactions((data ?? []).map(mapReaction));
  }, [supabase]);

  const addReaction = useCallback<StoreValue["addReaction"]>(
    async (input) => {
      if (!requireAuth()) return;
      await supabase.from("reactions").upsert(
        {
          user_id: authUser!.id,
          route_id: input.routeId,
          reaction: input.reaction,
          tags: input.tags ?? [],
          text: input.text ?? "",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id,route_id" }
      );
      await reloadReactions();
    },
    [supabase, authUser, requireAuth, reloadReactions]
  );

  const addComparison = useCallback<StoreValue["addComparison"]>(
    async (routeAId, routeBId, winner) => {
      if (!requireAuth()) return;
      await supabase.from("comparisons").insert({
        user_id: authUser!.id,
        route_a_id: routeAId,
        route_b_id: routeBId,
        winner,
      });
      const { data } = await supabase.from("comparisons").select("*");
      setComparisons((data ?? []).map(mapComparison));
    },
    [supabase, authUser, requireAuth]
  );

  const toggleSave = useCallback<StoreValue["toggleSave"]>(
    async (routeId) => {
      if (!requireAuth()) return;
      const isCurrentlySaved = savedSet.has(routeId);
      // optimistic
      setSavedSet((prev) => {
        const next = new Set(prev);
        isCurrentlySaved ? next.delete(routeId) : next.add(routeId);
        return next;
      });
      if (isCurrentlySaved) {
        await supabase
          .from("saved_routes")
          .delete()
          .eq("user_id", authUser!.id)
          .eq("route_id", routeId);
      } else {
        await supabase
          .from("saved_routes")
          .insert({ user_id: authUser!.id, route_id: routeId });
      }
    },
    [supabase, authUser, requireAuth, savedSet]
  );

  const addRoute = useCallback<StoreValue["addRoute"]>(
    async (input) => {
      if (!requireAuth()) return null;
      if (input.path.length < 2) return null;
      const { data, error } = await supabase
        .from("routes")
        .insert({
          creator_id: authUser!.id,
          name: input.name,
          description: input.description,
          city: input.city,
          route_type: input.routeType,
          surface: input.surface ?? null,
          flatness: input.flatness ?? null,
          distance_m: milesToMeters(input.distanceMi),
          elevation_m: feetToMeters(input.elevationFt),
          geom: lineToEwkt(input.path),
          start_point: pointToEwkt(input.path[0]),
          image: input.image ?? null,
          source: "user",
        })
        .select("id")
        .single();
      if (error) {
        console.error("addRoute failed:", error.message);
        return null;
      }
      await loadData();
      return (data?.id as string) ?? null;
    },
    [supabase, authUser, requireAuth, loadData]
  );

  const toggleFollow = useCallback<StoreValue["toggleFollow"]>(
    async (userId) => {
      if (!requireAuth()) return;
      if (userId === authUser!.id) return;
      const currently = followingIds.includes(userId);
      setFollowingIds((prev) =>
        currently ? prev.filter((x) => x !== userId) : [...prev, userId]
      );
      if (currently) {
        await supabase
          .from("follows")
          .delete()
          .eq("follower_id", authUser!.id)
          .eq("following_id", userId);
      } else {
        await supabase
          .from("follows")
          .insert({ follower_id: authUser!.id, following_id: userId });
      }
    },
    [supabase, authUser, requireAuth, followingIds]
  );

  const refresh = useCallback(async () => {
    await Promise.all([loadData(), loadUser(authUser?.id ?? null)]);
  }, [loadData, loadUser, authUser]);

  const currentUser = profile ?? GUEST_USER;

  const value: StoreValue = useMemo(
    () => ({
      ready,
      user: authUser,
      isGuest: !authUser || authUser.is_anonymous === true,
      currentUser,
      unit,
      signInWithEmail,
      signInAsGuest,
      signOut,
      authPromptOpen,
      openAuthPrompt: () => setAuthPromptOpen(true),
      closeAuthPrompt: () => setAuthPromptOpen(false),
      verifyEmailCode,
      signUpWithPassword,
      signInWithPassword,
      users: profiles,
      routes,
      getRoute: (id) => routeMap.get(id),
      getUser: (id) =>
        id === "loop"
          ? LOOP_USER
          : id === authUser?.id
          ? currentUser
          : profileMap.get(id),
      reactions,
      reactionsFor: (routeId) =>
        reactions
          .filter((r) => r.routeId === routeId)
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      isSaved: (routeId) => savedSet.has(routeId),
      followingIds,
      followerCount,
      addReaction,
      addComparison,
      toggleSave,
      addRoute,
      isFollowing: (userId) => followingIds.includes(userId),
      toggleFollow,
      refresh,
    }),
    [
      ready,
      authUser,
      currentUser,
      unit,
      authPromptOpen,
      profiles,
      routes,
      routeMap,
      profileMap,
      reactions,
      savedSet,
      followingIds,
      followerCount,
      signInWithEmail,
      verifyEmailCode,
      signUpWithPassword,
      signInWithPassword,
      signInAsGuest,
      signOut,
      addReaction,
      addComparison,
      toggleSave,
      addRoute,
      toggleFollow,
      refresh,
    ]
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}
