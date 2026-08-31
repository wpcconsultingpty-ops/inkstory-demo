import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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

// Simple in-memory IP rate limit — resets on cold start, which is fine for demo protection.
const RATE = new Map<string, { n: number; t: number }>();
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_MAX = 15; // Now per-image, so higher budget: 15 images/hr = 5 briefs/hr

function rateLimit(ip: string): boolean {
  const now = Date.now();
  const cur = RATE.get(ip);
  if (!cur || now - cur.t > RATE_WINDOW_MS) {
    RATE.set(ip, { n: 1, t: now });
    return true;
  }
  if (cur.n >= RATE_MAX) return false;
  cur.n += 1;
  return true;
}

export async function POST(req: Request) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!rateLimit(ip)) {
    return NextResponse.json(
      {
        error: "demo rate limit reached",
        detail: "The public demo is limited to 5 briefs per hour per browser. Sign in with your email to keep generating."
      },
      { status: 429 }
    );
  }

  const body = await req.json();
  const brief = body?.brief;
  const briefId = body?.brief_id;
  const idx = body?.idx;
  if (!brief || typeof brief !== "object") {
    return NextResponse.json({ error: "brief required" }, { status: 400 });
  }
  if (!briefId) return NextResponse.json({ error: "brief_id required" }, { status: 400 });
  if (typeof idx !== "number" || idx < 0 || idx >= STYLE_VARIANTS.length) {
    return NextResponse.json({ error: "idx out of range" }, { status: 400 });
  }

  const variant = STYLE_VARIANTS[idx];
  const basePrompt = buildPrompt(brief);
  const prompt = buildTattooPrompt(basePrompt, variant, idx);

  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supa = supaUrl && supaAnon ? createClient(supaUrl, supaAnon) : null;

  const gen = await generateTattooImage(prompt, { size: "1024x1024", quality: "high" });

  let image_url: string | null = null;
  const meta: Record<string, unknown> = { variant: variant.label, detail: variant.detail };

  if (gen && supa) {
    const buf = Buffer.from(gen.b64, "base64");
    const path = `demo/${briefId}/direction-${idx + 1}.png`;
    const { error } = await supa.storage.from("concepts").upload(path, buf, {
      contentType: "image/png",
      upsert: true
    });
    if (!error) {
      const { data } = supa.storage.from("concepts").getPublicUrl(path);
      image_url = data?.publicUrl ?? null;
      meta.model = gen.model;
      meta.quality = "high";
    }
  }

  if (!image_url && gen) {
    image_url = `data:image/png;base64,${gen.b64}`;
    meta.model = gen.model;
    meta.upload_failed = true;
  }

  if (!image_url) {
    return NextResponse.json(
      { error: "image generation unavailable", detail: "OpenAI didn't return an image." },
      { status: 503 }
    );
  }

  return NextResponse.json({
    ok: true,
    concept: {
      id: `${briefId}-${idx}`,
      brief_id: briefId,
      idx,
      prompt,
      image_url,
      meta
    }
  });
}
