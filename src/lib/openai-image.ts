// Real image generation via OpenAI gpt-image-1.
// Falls back to null on error so the caller can substitute the SVG placeholder.

const OPENAI_URL = "https://api.openai.com/v1/images/generations";

export type GeneratedImage = {
  b64: string;          // base64-encoded PNG
  size: string;         // e.g. "1024x1024"
  model: string;
};

export async function generateTattooImage(
  prompt: string,
  opts: { size?: "1024x1024" | "1024x1792" | "1792x1024"; quality?: "low" | "medium" | "high" } = {}
): Promise<GeneratedImage | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const size = opts.size ?? "1024x1024";
  const quality = opts.quality ?? "medium";

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
    return null;
  }
}

// Build a strong tattoo-specific prompt for a given direction.
export function buildTattooPrompt(
  base: string,
  direction: { label: string; detail: string },
  idx: number
): string {
  return [
    "Portfolio-quality tattoo concept illustration, isolated on plain off-white background.",
    base,
    `Direction ${idx + 1} — ${direction.label}: ${direction.detail}.`,
    "Clean confident linework, intentional negative space, no text, no watermarks, no signature, no frames, no borders.",
    "Composition centered, suitable for showing to a tattoo artist as a design reference."
  ].join(" ");
}
