import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 10;

// Lightweight endpoint: marks the brief as submitted and clears any existing
// concept rows. Client is expected to then hit /api/generate-one three times
// in parallel (one per direction). This keeps each function call well under
// Vercel's Hobby 60s limit so we can generate high-quality images.
export async function POST(req: Request) {
  const { brief_id } = await req.json();
  if (!brief_id) return NextResponse.json({ error: "brief_id required" }, { status: 400 });

  const supa = createSupabaseServerClient();
  const {
    data: { user }
  } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: brief, error } = await supa
    .from("briefs")
    .select("id")
    .eq("id", brief_id)
    .single();
  if (error || !brief) return NextResponse.json({ error: "brief not found" }, { status: 404 });

  await supa.from("concepts").delete().eq("brief_id", brief_id);
  await supa.from("briefs").update({ status: "generating" }).eq("id", brief_id);

  return NextResponse.json({ ok: true });
}
