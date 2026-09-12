import { RequestError, decodeRasterBase64, readLimitedBody, requireGenerationEnabled } from "./security";

// This helper may only be called AFTER a durable pilot reservation. No automatic
// retries: an ambiguous network failure can still have incurred provider cost.

const OPENAI_URL = "https://api.openai.com/v1/images/generations";

export type GeneratedImage = {
  b64: string;          // base64-encoded PNG
  size: string;         // e.g. "1024x1024"
  model: string;
};

export async function generateTattooImage(
  prompt: string,
  opts: { size?: "1024x1024" | "1024x1536" | "1536x1024"; quality?: "low" | "medium" | "high" } = {}
): Promise<GeneratedImage> {
  requireGenerationEnabled(process.env.INKSTORY_GENERATION_ENABLED);
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new RequestError(503, "Image generation is unavailable.");

  const size = opts.size ?? "1024x1024";
  const quality = opts.quality ?? "low";

  try {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      signal: AbortSignal.timeout(45_000),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-image-1",
        prompt,
        size,
        quality,
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
    const bytes = await readLimitedBody(res, 12 * 1024 * 1024);
    const json = JSON.parse(new TextDecoder().decode(bytes));
    const b64 = json?.data?.[0]?.b64_json;
    if (typeof b64 !== "string") throw new RequestError(502, "The image provider did not return an image.");
    decodeRasterBase64(b64, "image/png");
    return { b64, size, model: "gpt-image-1" };
  } catch (error) {
    if (error instanceof RequestError && error.status !== 413 && error.status !== 400) throw error;
    throw new RequestError(502, "Image generation failed or timed out. The reserved pilot allowance remains counted.");
  }
}

// Build a strong tattoo-specific prompt for a given direction.
export function buildTattooPrompt(
  base: string,
  direction: { label: string; detail: string },
  idx: number
): string {
  return [
    "Portfolio-grade tattoo concept illustration for a real tattoo artist reference.",
    "Rendered as if drawn in a professional tattoo artist's sketchbook: clean warm off-white paper background, no environment, no product photography styling.",
    base,
    `Direction ${idx + 1} — ${direction.label}: ${direction.detail}.`,
    "Tattoo-flash aesthetic. Use confident linework of varying weight (0.3mm to 1.2mm equivalent). Include appropriate tattoo shading techniques: dot-work stippling for graduated tone, whip-shading for soft transitions, and fine parallel hatching for texture. High tonal contrast where the composition calls for it. Sharp deliberate edges on all glyphs, letterforms, and geometric elements. Preserve intentional negative space so the piece reads clearly at tattoo scale.",
    "Strict constraints: no text captions, no watermarks, no signature, no frames or borders, no color swatches, no realistic photography, no 3D rendering, no soft blurry edges. Centered composition, single subject group only."
  ].join(" ");
}
