import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildPrompt } from "@/lib/brief";

export const runtime = "nodejs";
export const maxDuration = 60;

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

// Renders a tasteful SVG "concept card" placeholder specific to each direction.
// This runs in-node, no external calls. Real AI image generation swaps in later
// by pointing image_url at the model output instead of this SVG data URL.
function conceptSVG(idx: number, brief: any): string {
  const palette = [
    { bg: "#0e0e12", ink: "#f3ead8", accent: "#c9a26b" },
    { bg: "#12100c", ink: "#e9dfc3", accent: "#a78154" },
    { bg: "#0a0d10", ink: "#e3e8ee", accent: "#8fa4b5" }
  ][idx % 3];
  const variant = STYLE_VARIANTS[idx % 3];

  // Deterministic hash from brief for subtle per-brief variation.
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

  const arcs = Array.from({ length: 3 }, (_, i) => {
    const rad = 200 + i * 40;
    return `<path d="M ${512 - rad},512 A ${rad},${rad} 0 0 1 ${512 + rad},512" fill="none" stroke="${palette.ink}" stroke-opacity="${0.12 + i * 0.05}" stroke-width="1"/>`;
  }).join("");

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
    <defs>
      <radialGradient id="g" cx="50%" cy="42%" r="70%">
        <stop offset="0%" stop-color="${palette.bg}" stop-opacity="1"/>
        <stop offset="100%" stop-color="#000" stop-opacity="1"/>
      </radialGradient>
    </defs>
    <rect width="1024" height="1024" fill="url(#g)"/>
    ${rings}
    ${arcs}
    ${runes}
    <text x="512" y="928" text-anchor="middle" font-family="Georgia, serif" font-size="30" fill="${palette.ink}" opacity="0.85">Direction ${idx + 1} · ${variant.label}</text>
    <text x="512" y="972" text-anchor="middle" font-family="Inter, system-ui, sans-serif" font-size="18" fill="${palette.ink}" opacity="0.45">${escape(brief?.style || "InkStory concept")}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function escape(s: string) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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

  const concepts: any[] = [];
  for (let i = 0; i < 3; i++) {
    const variant = STYLE_VARIANTS[i];
    const prompt = `${buildPrompt(brief as any)} Direction ${i + 1}: ${variant.detail}.`;
    const image_url = conceptSVG(i, brief);

    const { data: inserted } = await supa
      .from("concepts")
      .insert({
        brief_id,
        user_id: user.id,
        idx: i,
        prompt,
        image_url,
        meta: { variant: variant.label, detail: variant.detail, placeholder: true }
      })
      .select("*")
      .single();
    concepts.push(inserted);
  }

  await supa.from("briefs").update({ status: "concepts_ready" }).eq("id", brief_id);

  return NextResponse.json({ ok: true, concepts });
}
