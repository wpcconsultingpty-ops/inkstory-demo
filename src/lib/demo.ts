// Local-only demo mode. Nothing here hits Supabase — briefs, concepts, and
// mock-purchase orders live in the browser's localStorage. Great for hands-on
// demos where you don't want to require sign-in.

const KEY = "inkstory.demo.v1";

export type DemoBrief = {
  id: string;
  meaning: string | null;
  placement: string | null;
  size_cm: string | null;
  style: string | null;
  palette: string | null;
  key_elements: string | null;
  reference_notes: string | null;
  status: "draft" | "generated" | "mock_paid";
  created_at: string;
  updated_at: string;
};

export type DemoConcept = {
  id: string;
  brief_id: string;
  idx: number;
  prompt: string;
  image_url: string;
  meta: { variant?: string; placeholder?: boolean; model?: string; upload_failed?: boolean };
};

type DemoStore = {
  briefs: DemoBrief[];
  concepts: DemoConcept[];
};

function empty(): DemoStore {
  return { briefs: [], concepts: [] };
}

function read(): DemoStore {
  if (typeof window === "undefined") return empty();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw);
    return {
      briefs: Array.isArray(parsed.briefs) ? parsed.briefs : [],
      concepts: Array.isArray(parsed.concepts) ? parsed.concepts : []
    };
  } catch {
    return empty();
  }
}

function write(store: DemoStore) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(store));
}

const DEMO_FLAG = "inkstory.demo.active";

export function isDemoActive(): boolean {
  if (typeof window === "undefined") return false;
  return window.localStorage.getItem(DEMO_FLAG) === "1";
}

export function activateDemo() {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DEMO_FLAG, "1");
}

export function deactivateDemo() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(DEMO_FLAG);
}

function uid() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function createDemoBrief(): DemoBrief {
  const store = read();
  const now = new Date().toISOString();
  const brief: DemoBrief = {
    id: uid(),
    meaning: null,
    placement: null,
    size_cm: null,
    style: null,
    palette: null,
    key_elements: null,
    reference_notes: null,
    status: "draft",
    created_at: now,
    updated_at: now
  };
  store.briefs.unshift(brief);
  write(store);
  return brief;
}

export function updateDemoBrief(id: string, patch: Partial<DemoBrief>): DemoBrief | null {
  const store = read();
  const b = store.briefs.find((x) => x.id === id);
  if (!b) return null;
  Object.assign(b, patch, { updated_at: new Date().toISOString() });
  write(store);
  return b;
}

export function getDemoBrief(id: string): DemoBrief | null {
  return read().briefs.find((b) => b.id === id) ?? null;
}

export function listDemoBriefs(): DemoBrief[] {
  return read()
    .briefs.slice()
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function getDemoConcepts(briefId: string): DemoConcept[] {
  return read()
    .concepts.filter((c) => c.brief_id === briefId)
    .sort((a, b) => a.idx - b.idx);
}

// Instant SVG concepts — shown immediately, replaced by real images when the API returns.
export function generateDemoConcepts(briefId: string): DemoConcept[] {
  const store = read();
  const brief = store.briefs.find((b) => b.id === briefId);
  if (!brief) return [];

  store.concepts = store.concepts.filter((c) => c.brief_id !== briefId);

  const variants = [
    { label: "Considered & minimal", tone: "sparse geometric composition" },
    { label: "Balanced & symbolic", tone: "layered symbolic composition" },
    { label: "Dynamic & story-forward", tone: "flowing narrative composition" }
  ];

  for (let i = 0; i < 3; i++) {
    const v = variants[i];
    store.concepts.push({
      id: uid(),
      brief_id: briefId,
      idx: i,
      prompt: `${v.tone} — ${brief.meaning ?? ""}`,
      image_url: buildPlaceholderSvg(brief, i),
      meta: { variant: v.label, placeholder: true }
    });
  }

  brief.status = "generated";
  brief.updated_at = new Date().toISOString();
  write(store);
  return store.concepts.filter((c) => c.brief_id === briefId).sort((a, b) => a.idx - b.idx);
}

// Kick off real image generation via the demo API. Returns updated concepts on success,
// null on failure (caller keeps the SVG placeholders).
export async function generateDemoImagesRemote(briefId: string): Promise<DemoConcept[] | null> {
  const brief = getDemoBrief(briefId);
  if (!brief) return null;

  try {
    const res = await fetch("/api/demo-generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brief_id: briefId, brief })
    });
    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      console.warn("[demo] image API failed", res.status, errBody);
      return null;
    }
    const data = await res.json();
    if (!data?.concepts?.length) return null;

    const store = read();
    store.concepts = store.concepts.filter((c) => c.brief_id !== briefId);
    for (const c of data.concepts as DemoConcept[]) {
      if (c.image_url) store.concepts.push(c);
    }
    write(store);
    return getDemoConcepts(briefId);
  } catch (e) {
    console.warn("[demo] image API error", (e as Error).message);
    return null;
  }
}

export function markDemoBriefPurchased(briefId: string) {
  const store = read();
  const b = store.briefs.find((x) => x.id === briefId);
  if (b) {
    b.status = "mock_paid";
    b.updated_at = new Date().toISOString();
    write(store);
  }
}

export function clearDemoData() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  window.localStorage.removeItem(DEMO_FLAG);
}

function buildPlaceholderSvg(brief: DemoBrief, idx: number): string {
  // Deterministic SVG per direction — same style as the server-side generator.
  const hues = [28, 200, 340]; // warm gold, cool teal, mulberry
  const hue = hues[idx];
  const label = ["Considered & minimal", "Balanced & symbolic", "Dynamic & story-forward"][idx];
  const rings = idx + 2;

  const ringEls = Array.from({ length: rings }, (_, i) => {
    const r = 120 + i * 50;
    return `<circle cx="256" cy="256" r="${r}" fill="none" stroke="hsla(${hue}, 45%, 60%, ${0.35 + i * 0.15})" stroke-width="1.5" />`;
  }).join("");

  const runes = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const rx = 256 + Math.cos(a) * 220;
    const ry = 256 + Math.sin(a) * 220;
    return `<circle cx="${rx.toFixed(1)}" cy="${ry.toFixed(1)}" r="2.5" fill="hsl(${hue}, 55%, 70%)" />`;
  }).join("");

  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512' width='512' height='512'>
  <defs>
    <radialGradient id='g${idx}' cx='50%' cy='50%' r='50%'>
      <stop offset='0%' stop-color='hsl(${hue}, 30%, 22%)' />
      <stop offset='100%' stop-color='#0b0b0d' />
    </radialGradient>
  </defs>
  <rect width='512' height='512' fill='url(#g${idx})' />
  ${ringEls}
  ${runes}
  <path d='M 130 340 Q 256 220 382 340' fill='none' stroke='hsla(${hue}, 60%, 75%, 0.55)' stroke-width='2' />
  <path d='M 130 260 Q 256 380 382 260' fill='none' stroke='hsla(${hue}, 60%, 75%, 0.35)' stroke-width='1.5' />
  <text x='256' y='470' font-family='Georgia, serif' font-size='16' fill='hsla(0,0%,100%,0.7)' text-anchor='middle' font-style='italic'>${label}</text>
</svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
