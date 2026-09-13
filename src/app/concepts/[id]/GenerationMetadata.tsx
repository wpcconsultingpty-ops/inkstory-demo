import { GENERATION_DIRECTIONS } from "@/lib/generation-plan";

// Historical formats describe saved images, not choices for new generation.
export type SavedOutputMode = "on_body" | "artwork";
const SAVED_OUTPUT_LABELS: Record<SavedOutputMode, string> = {
  on_body: "On-body mockup",
  artwork: "Artwork only",
};

export type ConceptMeta = {
  variant?: string;
  output_mode?: SavedOutputMode;
  prompt_version?: string;
  model?: string;
  size?: string;
  quality?: string;
};

export type Concept = {
  id: string;
  idx: number;
  image_url: string | null;
  meta: ConceptMeta | null;
  created_at?: string;
};

const LEGACY_DIRECTIONS = ["Considered & minimal", "Balanced & symbolic", "Dynamic & story-forward"];
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

/** Public display fields only. Never pass through prompts, detail text or object paths. */
export function sanitiseConceptMeta(value: unknown): ConceptMeta {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const safe: ConceptMeta = {};
  const labels: readonly string[] = [...GENERATION_DIRECTIONS.map((direction) => direction.label), ...LEGACY_DIRECTIONS];
  if (typeof raw.variant === "string" && raw.variant.length <= 80 && labels.includes(raw.variant)) safe.variant = raw.variant;
  if (raw.output_mode === "on_body" || raw.output_mode === "artwork") safe.output_mode = raw.output_mode;
  if (typeof raw.model === "string" && /^[a-z0-9][a-z0-9.-]{0,79}$/i.test(raw.model)) safe.model = raw.model;
  if (typeof raw.prompt_version === "string" && /^[a-z0-9][a-z0-9._-]{0,63}$/i.test(raw.prompt_version)) safe.prompt_version = raw.prompt_version;
  if (typeof raw.size === "string" && ["1024x1024", "1024x1536", "1536x1024", "auto"].includes(raw.size)) safe.size = raw.size;
  if (typeof raw.quality === "string" && ["low", "medium", "high", "auto"].includes(raw.quality)) safe.quality = raw.quality;
  return safe;
}

/** Used for both owner-page rows and API results; the stored image location never escapes. */
export function privateConcept(value: unknown): Concept | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || !UUID.test(raw.id) || typeof raw.idx !== "number" || !Number.isInteger(raw.idx) || raw.idx < 0 || raw.idx > 2) return null;
  return {
    id: raw.id,
    idx: raw.idx,
    image_url: typeof raw.image_url === "string" && raw.image_url.length > 0 ? `/api/concept-image/${encodeURIComponent(raw.id)}` : null,
    meta: sanitiseConceptMeta(raw.meta),
    ...(typeof raw.created_at === "string" && /^\d{4}-\d{2}-\d{2}T[\d:.+-]+Z?$/.test(raw.created_at) && raw.created_at.length <= 40 ? { created_at: raw.created_at } : {}),
  };
}

export function savedOutputLabel(meta: ConceptMeta | null): string {
  const safe = sanitiseConceptMeta(meta);
  return safe.output_mode ? SAVED_OUTPUT_LABELS[safe.output_mode] : "Legacy image · output format not recorded";
}

export function savedDirectionLabel(meta: ConceptMeta | null): string {
  return sanitiseConceptMeta(meta).variant ?? "Saved direction not recorded";
}

export default function GenerationMetadata({ meta }: { meta: ConceptMeta | null }) {
  const saved = sanitiseConceptMeta(meta);
  return (
    <div className="mt-3 space-y-1 text-xs text-ink-muted" data-testid="saved-image-metadata">
      <p className="text-accent-soft">{savedOutputLabel(saved)}</p>
      <p>{savedDirectionLabel(saved)}</p>
      <p>{[saved.size?.replace("x", " × "), saved.quality ? `${saved.quality} quality` : null].filter(Boolean).join(" · ") || "Image settings not recorded"}</p>
      {(saved.model || saved.prompt_version) && (
        <details>
          <summary className="min-h-11 cursor-pointer py-2">Saved generation settings</summary>
          {saved.model && <p>Model: {saved.model}</p>}
          {saved.prompt_version && <p>Prompt version: {saved.prompt_version}</p>}
        </details>
      )}
    </div>
  );
}
