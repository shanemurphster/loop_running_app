import { NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const db = createServiceClient();
  await db.from("strava_tokens").delete().eq("user_id", user.id);
  await db.from("profiles").update({ strava_athlete_id: null }).eq("id", user.id);

  return NextResponse.json({ ok: true });
}
