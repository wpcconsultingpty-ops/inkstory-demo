import { draftFrom } from "@/components/brief-validation";
import type { BriefDraft } from "@/lib/brief";

// No account state, remote images, generation calls or entitlements in the demo.
const KEY = "inkstory.demo.v2";
let memory: DemoBrief[] = [];
let storageState: "checking" | "local" | "memory" = "checking";
let loaded = false;

export type DemoBrief = BriefDraft & {
  id: string;
  status: "draft" | "reviewed";
  preferred_layout: number | null;
  created_at: string;
  updated_at: string;
};

export const EXAMPLE_LAYOUTS = [
  { label: "Quiet focal point", description: "One focal shape with generous space around it.", question: "Which single element matters most, and what can be left out?" },
  { label: "Balanced grouping", description: "A central shape framed by two supporting shapes.", question: "Which elements should be central and which should support them?" },
  { label: "Flowing sequence", description: "A diagonal arrangement that suggests movement.", question: "How could the story follow the curve and movement of your chosen placement?" },
] as const;

export const SAMPLE_BRIEF: DemoBrief = {
  id: "sample",
  meaning: "A reminder to keep exploring and to make time for the outdoors. The piece should feel calm and open.",
  placement: "Inner forearm",
  size_cm: "Medium (8–15cm)",
  style: "Fine-line",
  palette: "Black-line only",
  key_elements: "Mountain outline, winding trail and a small sun",
  reference_notes: "Leave breathing room between elements. Ask the artist how much detail will age well at this size.",
  preferred_layout: null,
  status: "reviewed",
  created_at: "",
  updated_at: "",
};

function ensureLoaded() {
  if (typeof window === "undefined" || loaded) return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) throw new Error("Invalid local draft data");
    memory = parsed.filter((item) => item && typeof item.id === "string").map((item) => ({
      ...draftFrom(item),
      id: item.id,
      status: item.status === "reviewed" ? "reviewed" : "draft",
      preferred_layout: Number.isInteger(item.preferred_layout) && item.preferred_layout >= 0 && item.preferred_layout < 3 ? item.preferred_layout : null,
      created_at: typeof item.created_at === "string" ? item.created_at : "",
      updated_at: typeof item.updated_at === "string" ? item.updated_at : "",
    }));
    // Test writes as well as reads: quota/private modes may only block writes.
    window.localStorage.setItem(KEY, JSON.stringify(memory));
    storageState = "local";
  } catch {
    storageState = "memory";
  }
}

function persist() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(memory));
    storageState = "local";
  } catch {
    storageState = "memory";
  }
}

export function getDemoStorageState() {
  ensureLoaded();
  return storageState;
}

export function createDemoBrief(draft?: BriefDraft): DemoBrief {
  ensureLoaded();
  const now = new Date().toISOString();
  const id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const brief: DemoBrief = { ...draftFrom(draft), id, status: "draft", preferred_layout: null, created_at: now, updated_at: now };
  memory.unshift(brief);
  persist();
  return { ...brief };
}

export function updateDemoBrief(id: string, patch: Partial<BriefDraft> & { status?: "draft" | "reviewed"; preferred_layout?: number | null }): DemoBrief | null {
  ensureLoaded();
  const index = memory.findIndex((brief) => brief.id === id);
  if (index < 0) return null;
  memory[index] = { ...memory[index], ...patch, updated_at: new Date().toISOString() };
  persist();
  return { ...memory[index] };
}

export function getDemoBrief(id: string): DemoBrief | null {
  ensureLoaded();
  const brief = memory.find((item) => item.id === id);
  return brief ? { ...brief } : null;
}

export function listDemoBriefs(): DemoBrief[] {
  ensureLoaded();
  return memory.map((brief) => ({ ...brief })).sort((a, b) => b.updated_at.localeCompare(a.updated_at));
}

export function clearDemoData(): boolean {
  memory = [];
  loaded = true;
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.removeItem(KEY);
    // Also clear legacy local demo data; never import it into this pilot.
    window.localStorage.removeItem("inkstory.demo.v1");
    window.localStorage.removeItem("inkstory.demo.active");
    storageState = "local";
    return true;
  } catch {
    storageState = "memory";
    return false;
  }
}
