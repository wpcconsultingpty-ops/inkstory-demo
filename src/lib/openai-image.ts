// Real image generation via OpenAI gpt-image-1.
// Falls back to null on error so the caller can substitute the SVG placeholder.

const OPENAI_URL = "https://api.openai.com/v1/images/generations";

export type GeneratedImage = {
  b64: string;          // base64-encoded PNG
  size: string;         // e.g. "1024x1024"
  model: string;
};

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function generateTattooImage(
  prompt: string,
  opts: { size?: "1024x1024" | "1024x1792" | "1792x1024"; quality?: "low" | "medium" | "high" } = {}
): Promise<GeneratedImage | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const size = opts.size ?? "1024x1024";
  const quality = opts.quality ?? "low";

  // Retry once on 429 (rate limit) with a short backoff.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(OPENAI_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "gpt-image-1",
          prompt,
          size,
          quality,
          n: 1
        })
      });

      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("retry-after")) || 20;
        console.warn(`[openai-image] 429 rate limited, retry-after ${retryAfter}s, attempt ${attempt + 1}`);
        if (attempt === 0) {
          await sleep(Math.min(retryAfter, 30) * 1000);
          continue;
        }
        return null;
      }

      if (!res.ok) {
        const errText = await res.text();
        console.error("[openai-image] non-2xx", res.status, errText.slice(0, 200));
        return null;
      }

      const json = await res.json();
      const b64 = json?.data?.[0]?.b64_json;
      if (!b64) {
        console.error("[openai-image] no b64 in response", JSON.stringify(json).slice(0, 200));
        return null;
      }
      return { b64, size, model: "gpt-image-1" };
    } catch (e) {
      console.error("[openai-image] fetch failed", (e as Error).message);
      if (attempt === 0) {
        await sleep(3000);
        continue;
      }
      return null;
    }
  }
  return null;
}

// Fire multiple image requests with staggered start times to stay under
// OpenAI's per-minute image rate limit while keeping total latency low.
// Requests run in parallel but their starts are spaced by `staggerMs`.
export async function generateTattooImageSeries(
  prompts: string[],
  opts: {
    size?: "1024x1024" | "1024x1792" | "1792x1024";
    quality?: "low" | "medium" | "high";
    staggerMs?: number;
  } = {}
): Promise<(GeneratedImage | null)[]> {
  const stagger = opts.staggerMs ?? 2000;
  const jobs = prompts.map((prompt, i) =>
    sleep(i * stagger).then(() =>
      generateTattooImage(prompt, { size: opts.size, quality: opts.quality })
    )
  );
  return Promise.all(jobs);
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
