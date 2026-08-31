import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildPrompt } from "@/lib/brief";
import { buildTattooPrompt, generateTattooImage } from "@/lib/openai-image";

export const runtime = "nodejs";
export const maxDuration = 120;

const STYLE_VARIANTS = [
  { label: "Considered & minimal", detail: "generous negative space, single focal element, quiet composition" },
  { label: "Balanced & symbolic", detail: "focal motif framed by two supporting elements, mirrored symmetry" },
  { label: "Dynamic & story-forward", detail: "sense of movement, layered background texture, storytelling emphasis" }
];

// Simple in-memory IP rate limit — resets on cold start, which is fine for demo protection.
// Real abuse protection would use Upstash or Vercel KV; this stops accidental hammering.
const RATE = new Map<string, { n: number; t: number }>();
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_MAX = 5; // 5 demo generations per IP per hour

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
      { error: "demo rate limit reached", detail: "Sign in to keep generating without limits." },
      { status: 429 }
    );
  }

  const body = await req.json();
  const brief = body?.brief;
  const briefId = body?.brief_id ?? crypto.randomUUID();
  if (!brief || typeof brief !== "object") {
    return NextResponse.json({ error: "brief required" }, { status: 400 });
  }

  const basePrompt = buildPrompt(brief);
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supaAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supa = supaUrl && supaAnon ? createClient(supaUrl, supaAnon) : null;

  const jobs = STYLE_VARIANTS.map(async (variant, i) => {
    const prompt = buildTattooPrompt(basePrompt, variant, i);
    const gen = await generateTattooImage(prompt, { size: "1024x1024", quality: "medium" });

    let image_url: string | null = null;
    let meta: Record<string, unknown> = { variant: variant.label, detail: variant.detail };

    if (gen && supa) {
      const buf = Buffer.from(gen.b64, "base64");
      const path = `demo/${briefId}/direction-${i + 1}.png`;
      const { error } = await supa.storage.from("concepts").upload(path, buf, {
        contentType: "image/png",
        upsert: true
      });
      if (!error) {
        const { data } = supa.storage.from("concepts").getPublicUrl(path);
        image_url = data?.publicUrl ?? null;
        meta.model = gen.model;
      }
    }

    if (!image_url && gen) {
      // Storage upload failed — inline the b64 as a fallback so the demo still shows real art.
      image_url = `data:image/png;base64,${gen.b64}`;
      meta.model = gen.model;
      meta.upload_failed = true;
    }

    return { idx: i, prompt, image_url, meta };
  });

  const results = await Promise.all(jobs);

  // If EVERY generation failed, tell the caller so demo falls back to SVG.
  const anySucceeded = results.some((r) => r.image_url);
  if (!anySucceeded) {
    return NextResponse.json(
      { error: "image generation unavailable", detail: "Falling back to SVG previews." },
      { status: 503 }
    );
  }

  return NextResponse.json({
    ok: true,
    brief_id: briefId,
    concepts: results.map((r) => ({
      id: `${briefId}-${r.idx}`,
      brief_id: briefId,
      idx: r.idx,
      prompt: r.prompt,
      image_url: r.image_url,
      meta: r.meta
    }))
  });
}
