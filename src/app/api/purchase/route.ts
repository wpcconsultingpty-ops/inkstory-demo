import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const supa = createSupabaseServerClient();
  const {
    data: { user }
  } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { brief_id } = await req.json();
  if (!brief_id) return NextResponse.json({ error: "brief_id required" }, { status: 400 });

  const { data, error } = await supa
    .from("orders")
    .insert({
      user_id: user.id,
      brief_id,
      amount_cents: 1900,
      currency: "aud",
      status: "mock_paid",
      paid_at: new Date().toISOString()
    })
    .select("*")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supa.from("briefs").update({ status: "purchased" }).eq("id", brief_id);
  return NextResponse.json({ ok: true, order: data });
}
