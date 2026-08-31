import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildPrompt } from "@/lib/brief";
import { buildTattooPrompt, generateTattooImage } from "@/lib/openai-image";

export const runtime = "nodejs";
export const maxDuration = 60;

const STYLE_VARIANTS = [
  {
    label: "Considered & minimal",
    detail:
      "generous negative space, single focal element, quiet composition, refined single-needle line work with subtle whip-shaded highlights"
  },
  {
    label: "Balanced & symbolic",
    detail:
      "focal motif framed by two supporting elements, mirrored symmetry, dot-work stippling in shadow areas, medium line weights"
  },
  {
    label: "Dynamic & story-forward",
    detail:
      "sense of movement, layered background texture, storytelling emphasis, bold heavy outlines with fine hatching detail, high tonal contrast"
  }
];

async function uploadImage(
  supa: any,
  userId: string,
  briefId: string,
  idx: number,
  b64: string
): Promise<string | null> {
  const buf = Buffer.from(b64, "base64");
  const path = `${userId}/${briefId}/direction-${idx + 1}.png`;
  const { error } = await supa.storage.from("concepts").upload(path, buf, {
    contentType: "image/png",
    upsert: true
  });
  if (error) {
    console.error("[storage upload]", error.message);
    return null;
  }
  const { data } = supa.storage.from("concepts").getPublicUrl(path);
  return data?.publicUrl ?? null;
}

export async function POST(req: Request) {
  const { brief_id, idx } = await req.json();
  if (!brief_id || typeof idx !== "number")
    return NextResponse.json({ error: "brief_id and idx required" }, { status: 400 });
  if (idx < 0 || idx >= STYLE_VARIANTS.length)
    return NextResponse.json({ error: "idx out of range" }, { status: 400 });

  const supa = createSupabaseServerClient();
  const {
    data: { user }
  } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: brief, error } = await supa
    .from("briefs")
    .select("*")
    .eq("id", brief_id)
    .single();
  if (error || !brief) return NextResponse.json({ error: "brief not found" }, { status: 404 });

  const variant = STYLE_VARIANTS[idx];
  const basePrompt = buildPrompt(brief as any);
  const prompt = buildTattooPrompt(basePrompt, variant, idx);

  const gen = await generateTattooImage(prompt, { size: "1024x1024", quality: "high" });

  let image_url: string | null = null;
  const meta: Record<string, unknown> = { variant: variant.label, detail: variant.detail };

  if (gen) {
    const uploaded = await uploadImage(supa, user.id, brief_id, idx, gen.b64);
    if (uploaded) {
      image_url = uploaded;
      meta.model = gen.model;
      meta.size = gen.size;
      meta.quality = "high";
    } else {
      image_url = `data:image/png;base64,${gen.b64}`;
      meta.model = gen.model;
      meta.upload_failed = true;
    }
  } else {
    meta.error = "generation_failed";
  }

  // Upsert the concept row (delete any old row at this idx first)
  await supa.from("concepts").delete().eq("brief_id", brief_id).eq("idx", idx);

  const row = {
    brief_id,
    user_id: user.id,
    idx,
    prompt,
    image_url,
    meta
  };
  const { data: inserted, error: insertErr } = await supa
    .from("concepts")
    .insert(row)
    .select("*")
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ concept: inserted });
}
