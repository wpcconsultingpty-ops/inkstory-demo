import { RequestError, decodeRasterBase64, readLimitedBody, requireGenerationEnabled } from "./security";

// This helper may only be called AFTER a durable pilot reservation. No automatic
// retries: an ambiguous network failure can still have incurred provider cost.

const OPENAI_URL = "https://api.openai.com/v1/images/generations";
const MODEL = "gpt-image-2.5-flare";
// Only the documented resolution of this alias is accepted, never an arbitrary
// dated model or a fallback. Request policy stays the fixed Flare alias.
const MODEL_SNAPSHOT = "gpt-image-2.5-flare-2026-09-08";
const SIZE = "1024x1536";
const QUALITY = "high";
const MAX_PROVIDER_TIMEOUT_MS = 180_000;
const LEASE_SAFETY_MARGIN_MS = 30_000;
const MIN_PROVIDER_WINDOW_MS = 45_000;

export type GeneratedImage = {
  b64: string;          // base64-encoded PNG
  size: typeof SIZE;
  model: typeof MODEL | typeof MODEL_SNAPSHOT;
  quality: typeof QUALITY;
};

export function providerTimeoutForLease(expiresAt: unknown, now = Date.now()): number {
  // Trust only the durable RPC's timestamp, never a client duration. PostgreSQL
  // JSON timestamps may have microseconds and an explicit +00:00 timezone.
  if (typeof expiresAt !== "string" ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(expiresAt)) {
    throw new RequestError(409, "A valid generation reservation is required. No image request was sent.");
  }
  const remaining = Date.parse(expiresAt) - now - LEASE_SAFETY_MARGIN_MS;
  if (!Number.isFinite(remaining) || remaining < MIN_PROVIDER_WINDOW_MS) {
    throw new RequestError(409, "The generation reservation has too little time remaining. No image request was sent.");
  }
  return Math.min(MAX_PROVIDER_TIMEOUT_MS, Math.floor(remaining));
}

export async function generateTattooImage(
  prompt: string,
  opts: { expiresAt: unknown }
): Promise<GeneratedImage> {
  requireGenerationEnabled(process.env.INKSTORY_GENERATION_ENABLED);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new RequestError(503, "Image generation is unavailable.");
  // Compute immediately before fetch, after reservation and prompt assembly.
  // Leave time for validation, private upload and atomic completion.
  const timeoutMs = providerTimeoutForLease(opts?.expiresAt);

  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: MODEL,
        prompt,
        size: SIZE,
        quality: QUALITY,
        output_format: "png",
        n: 1
      })
    });

    if (res.status === 429) {
      await res.body?.cancel();
      throw new RequestError(503, "The image provider is busy. The reserved pilot allowance remains counted.");
    }

    if (!res.ok) {
      await res.body?.cancel();
      throw new RequestError(502, "Image generation failed. Existing artwork has not been changed.");
    }
    if (res.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") {
      await res.body?.cancel();
      throw new RequestError(502, "The image provider returned an invalid response.");
    }
    const bytes = await readLimitedBody(res, 12 * 1024 * 1024);
    const json = JSON.parse(new TextDecoder().decode(bytes));
    if (!json || !Array.isArray(json.data) || json.data.length !== 1) {
      throw new RequestError(502, "The image provider did not return exactly one image.");
    }
    // New API response fields are optional. When returned, they must agree
    // with our fixed policy; never silently save misleading output metadata.
    for (const [key, expected] of Object.entries({ size: SIZE, quality: QUALITY, output_format: "png" })) {
      if (json[key] !== undefined && json[key] !== expected) {
        throw new RequestError(502, "The image provider returned an unexpected output format.");
      }
    }
    let model: GeneratedImage["model"] = MODEL;
    if (json.model !== undefined) {
      if (json.model !== MODEL && json.model !== MODEL_SNAPSHOT) {
        throw new RequestError(502, "The image provider returned an unexpected model.");
      }
      model = json.model;
    }
    const b64 = json?.data?.[0]?.b64_json;
    if (typeof b64 !== "string") throw new RequestError(502, "The image provider did not return an image.");
    decodeRasterBase64(b64, "image/png");
    return { b64, size: SIZE, model, quality: QUALITY };
  } catch (error) {
    if (error instanceof RequestError && error.status !== 413 && error.status !== 400) throw error;
    throw new RequestError(502, "Image generation failed or timed out. The reserved pilot allowance remains counted.");
  }
}
