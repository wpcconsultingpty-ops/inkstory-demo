import type { BriefDraft } from "./brief";

// Browser-safe validation shared with the brief form. Keep the SQL validator in
// the pilot migration in sync. Lengths count Unicode code points, not bytes.
export const MAX_BRIEF_LENGTH = 6000;
export const MAX_JSON_BYTES = 16 * 1024;
export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
export const BRIEF_LIMITS = {
  meaning: 2000,
  placement: 120,
  size_cm: 120,
  style: 120,
  key_elements: 2000,
  palette: 120,
  reference_notes: 2000
} as const;

export class RequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = "RequestError";
  }
}

export function validateUUID(value: unknown, field = "brief_id"): string {
  if (
    typeof value !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ||
    value === "00000000-0000-0000-0000-000000000000"
  ) {
    throw new RequestError(400, `${field} must be a valid UUID.`);
  }
  return value.toLowerCase();
}

export function validateDirectionIndex(value: unknown): number {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 2) {
    throw new RequestError(400, "idx must be an integer from 0 to 2.");
  }
  return value;
}

export function validateBrief(value: unknown): BriefDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RequestError(400, "A complete brief is required.");
  }
  const input = value as Record<string, unknown>;
  const result = {} as BriefDraft;
  let total = 0;
  for (const key of Object.keys(BRIEF_LIMITS) as (keyof BriefDraft)[]) {
    const raw = input[key] ?? (key === "reference_notes" ? "" : undefined);
    if (typeof raw !== "string") throw new RequestError(400, `${key} must be text.`);
    const text = raw.trim();
    const length = Array.from(text).length;
    if (length < (key === "meaning" ? 10 : key === "reference_notes" ? 0 : 1)) {
      throw new RequestError(400, key === "meaning"
        ? "Meaning must contain at least 10 characters."
        : `${key} is required.`);
    }
    if (length > BRIEF_LIMITS[key]) {
      throw new RequestError(400, `${key} must be at most ${BRIEF_LIMITS[key]} characters.`);
    }
    if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(text)) {
      throw new RequestError(400, `${key} contains unsupported control characters.`);
    }
    total += length;
    result[key] = text;
  }
  if (total > MAX_BRIEF_LENGTH) {
    throw new RequestError(400, `The combined brief must be at most ${MAX_BRIEF_LENGTH} characters.`);
  }
  return result;
}

export function assertSameOrigin(req: Request): void {
  const origin = req.headers.get("origin");
  if (req.headers.get("sec-fetch-site") === "cross-site") {
    throw new RequestError(403, "Cross-site requests are not allowed.");
  }
  // Do not derive an allowed origin from user-controlled forwarding headers.
  if (origin !== null && origin !== new URL(req.url).origin) {
    throw new RequestError(403, "This request must come from the InkStory app.");
  }
}

export async function readLimitedBody(req: Request | Response, limit: number): Promise<Uint8Array> {
  const declaredLength = req.headers.get("content-length");
  if (declaredLength !== null) {
    if (!/^\d+$/.test(declaredLength)) throw new RequestError(400, "Invalid content length.");
    if (Number(declaredLength) > limit) throw new RequestError(413, "Request is too large.");
  }
  if (!req.body) return new Uint8Array();
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > limit) {
        await reader.cancel();
        throw new RequestError(413, "Request is too large.");
      }
      chunks.push(next.value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function readJsonObject(req: Request): Promise<Record<string, unknown>> {
  assertSameOrigin(req);
  const contentType = req.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
  if (contentType !== "application/json") {
    throw new RequestError(400, "Send a JSON request body.");
  }
  const bytes = await readLimitedBody(req, MAX_JSON_BYTES);
  try {
    const value: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("not an object");
    return value as Record<string, unknown>;
  } catch {
    throw new RequestError(400, "Malformed JSON request body.");
  }
}

export function requireGenerationEnabled(value: string | undefined): void {
  if (value !== "true") {
    throw new RequestError(503, "Image generation is paused for the invite-only free pilot.");
  }
}

export function conceptImageUrl(id: string): string {
  return `/api/concept-image/${validateUUID(id, "concept id")}`;
}

export type PrivateImageSource =
  | { kind: "object"; path: string }
  | { kind: "inline"; data: string; mime: "image/png" | "image/jpeg" | "image/webp" };

// Resolve only an owner's same-brief object in our bucket. NEVER fetch a stored
// URL: older rows were client-writable, so it could otherwise become an SSRF.
export function resolvePrivateImageSource(
  value: unknown, userId: string, briefId: string, supabaseUrl: string
): PrivateImageSource {
  const owner = validateUUID(userId, "owner");
  const brief = validateUUID(briefId);
  if (typeof value !== "string") throw new RequestError(404, "Image not found.");
  if (value.startsWith("data:")) {
    const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(value);
    if (!match || value.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 64) {
      throw new RequestError(404, "Image not found.");
    }
    return { kind: "inline", mime: match[1] as "image/png" | "image/jpeg" | "image/webp", data: match[2] };
  }
  let path = value;
  if (value.includes("..") || value.includes("\\") || /%(?:2e|2f|5c)/i.test(value)) {
    throw new RequestError(404, "Image not found.");
  }
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      const expected = new URL(supabaseUrl);
      if (url.origin !== expected.origin || url.username || url.password || url.hash) throw new Error("origin");
      const prefix = /^\/storage\/v1\/object\/(?:public|authenticated|sign)\/concepts\//;
      if (!prefix.test(url.pathname)) throw new Error("bucket");
      path = decodeURIComponent(url.pathname.replace(prefix, ""));
    } catch {
      throw new RequestError(404, "Image not found.");
    }
  }
  // Literal UUID folders and a single raster filename also reject encoded
  // traversal, nested paths, backslashes, data/SVG/HTML and foreign ownership.
  const prefix = `${owner}/${brief}/`;
  if (!path.startsWith(prefix) || !/^[a-zA-Z0-9][a-zA-Z0-9_-]*\.(png|jpe?g|webp)$/.test(path.slice(prefix.length))) {
    throw new RequestError(404, "Image not found.");
  }
  return { kind: "object", path };
}

export function rasterMime(bytes: Uint8Array): "image/png" | "image/jpeg" | "image/webp" | null {
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((b, i) => bytes[i] === b)) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "image/webp";
  return null;
}

export function decodeRasterBase64(b64: string, expectedMime?: string): Uint8Array {
  if (!b64 || b64.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 ||
      b64.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(b64) ||
      !/^[A-Za-z0-9+/]*={0,2}$/.test(b64)) {
    throw new RequestError(502, "The image provider returned an invalid image.");
  }
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  } catch {
    throw new RequestError(502, "The image provider returned an invalid image.");
  }
  const mime = rasterMime(bytes);
  if (bytes.length > MAX_IMAGE_BYTES || !mime || (expectedMime && mime !== expectedMime)) {
    throw new RequestError(502, "The image provider returned an invalid image.");
  }
  return bytes;
}
