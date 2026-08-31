import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildPrompt } from "@/lib/brief";
import { buildTattooPrompt, generateTattooImage } from "@/lib/openai-image";

export const runtime = "nodejs";
export const maxDuration = 120;

const STYLE_VARIANTS = [
  {
    label: "Considered & minimal",
    detail: "generous negative space, single focal element, quiet composition"
  },
  {
    label: "Balanced & symbolic",
    detail: "focal motif framed by two supporting elements, mirrored symmetry"
  },
  {
    label: "Dynamic & story-forward",
    detail: "sense of movement, layered background texture, storytelling emphasis"
  }
];

// SVG placeholder used only when the image API is unavailable.
function conceptSVG(idx: number, brief: any): string {
  const palette = [
    { bg: "#0e0e12", ink: "#f3ead8", accent: "#c9a26b" },
    { bg: "#12100c", ink: "#e9dfc3", accent: "#a78154" },
    { bg: "#0a0d10", ink: "#e3e8ee", accent: "#8fa4b5" }
  ][idx % 3];
  const variant = STYLE_VARIANTS[idx % 3];

  const seed = String((brief?.meaning || "") + (brief?.style || "") + idx)
    .split("")
    .reduce((a: number, c: string) => (a * 31 + c.charCodeAt(0)) | 0, 7);
  const r = (n: number) => {
    const x = Math.sin(seed + n) * 10000;
    return x - Math.floor(x);
  };

  const rings = Array.from({ length: 3 }, (_, i) => {
    const rad = 120 + i * 60 + r(i) * 30;
    return `<circle cx="512" cy="512" r="${rad}" fill="none" stroke="${palette.accent}" stroke-opacity="${0.15 + i * 0.08}" stroke-width="1.2"/>`;
  }).join("");

  const runes = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const rad = 320;
    const x = 512 + Math.cos(a) * rad;
    const y = 512 + Math.sin(a) * rad;
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(2 + r(i) * 2).toFixed(1)}" fill="${palette.accent}" opacity="0.6"/>`;
  }).join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
    <defs><radialGradient id="g" cx="50%" cy="42%" r="70%"><stop offset="0%" stop-color="${palette.bg}"/><stop offset="100%" stop-color="#000"/></radialGradient></defs>
    <rect width="1024" height="1024" fill="url(#g)"/>
    ${rings}
    ${runes}
    <text x="512" y="928" text-anchor="middle" font-family="Georgia, serif" font-size="30" fill="${palette.ink}" opacity="0.85">Direction ${idx + 1} · ${variant.label}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

async function uploadImage(supa: any, userId: string, briefId: string, idx: number, b64: string): Promise<string | null> {
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
  const { brief_id } = await req.json();
  if (!brief_id) return NextResponse.json({ error: "brief_id required" }, { status: 400 });

  const supa = createSupabaseServerClient();
  const {
    data: { user }
  } = await supa.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { data: brief, error } = await supa.from("briefs").select("*").eq("id", brief_id).single();
  if (error || !brief) return NextResponse.json({ error: "brief not found" }, { status: 404 });

  await supa.from("concepts").delete().eq("brief_id", brief_id);

  const basePrompt = buildPrompt(brief as any);

  // Generate all three in parallel to keep latency down.
  const jobs = STYLE_VARIANTS.map(async (variant, i) => {
    const prompt = buildTattooPrompt(basePrompt, variant, i);
    const gen = await generateTattooImage(prompt, { size: "1024x1024", quality: "medium" });

    let image_url: string;
    let meta: Record<string, unknown> = { variant: variant.label, detail: variant.detail };

    if (gen) {
      const uploaded = await uploadImage(supa, user.id, brief_id, i, gen.b64);
      if (uploaded) {
        image_url = uploaded;
        meta.model = gen.model;
        meta.size = gen.size;
      } else {
        // Upload failed — inline data URL fallback (still a real image, just larger payload).
        image_url = `data:image/png;base64,${gen.b64}`;
        meta.model = gen.model;
        meta.upload_failed = true;
      }
    } else {
      image_url = conceptSVG(i, brief);
      meta.placeholder = true;
    }

    return { i, prompt, image_url, meta };
  });

  const results = await Promise.all(jobs);
  const rows = results
    .sort((a, b) => a.i - b.i)
    .map((r) => ({
      brief_id,
      user_id: user.id,
      idx: r.i,
      prompt: r.prompt,
      image_url: r.image_url,
      meta: r.meta
    }));

  const { data: inserted } = await supa.from("concepts").insert(rows).select("*");

  await supa.from("briefs").update({ status: "concepts_ready" }).eq("id", brief_id);

  return NextResponse.json({ ok: true, concepts: inserted });
}
