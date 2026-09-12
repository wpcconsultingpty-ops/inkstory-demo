import { NextResponse } from "next/server";
import { buildPrompt } from "@/lib/brief";
import { buildTattooPrompt, generateTattooImage } from "@/lib/openai-image";
import {
  RequestError, conceptImageUrl, decodeRasterBase64, readJsonObject,
  validateBrief, validateDirectionIndex, validateUUID
} from "@/lib/security";
import { apiFailure, ownedBrief, pilotContext, rpcError } from "@/lib/pilot-server";

export const runtime = "nodejs";
export const maxDuration = 60;

const STYLE_VARIANTS = [
  {
    label: "Considered & minimal",
    detail: "generous negative space, single focal element, quiet composition, refined single-needle line work with subtle whip-shaded highlights"
  },
  {
    label: "Balanced & symbolic",
    detail: "focal motif framed by two supporting elements, mirrored symmetry, dot-work stippling in shadow areas, medium line weights"
  },
  {
    label: "Dynamic & story-forward",
    detail: "sense of movement, layered background texture, storytelling emphasis, bold heavy outlines with fine hatching detail, high tonal contrast"
  }
];

export async function POST(req: Request) {
  let release: (() => Promise<void>) | undefined;
  try {
    const body = await readJsonObject(req);
    const briefId = validateUUID(body.brief_id);
    const idx = validateDirectionIndex(body.idx);
    const { supa, user } = await pilotContext();
    await ownedBrief(supa, user.id, briefId);
    if (!process.env.OPENAI_API_KEY) throw new RequestError(503, "Image generation is unavailable.");

    // The RPC locks the singleton config row, checks ownership/invite/quotas,
    // issues a same-slot lease and charges BEFORE any provider call.
    const { data: reservation, error: reserveError } = await supa.rpc("pilot_reserve_generation", {
      p_brief_id: briefId, p_idx: idx
    });
    if (reserveError) rpcError(reserveError);
    if (!reservation || typeof reservation !== "object") rpcError(null);
    const reservationId = validateUUID(reservation.reservation_id, "reservation id");
    const path = `${user.id}/${briefId}/${reservationId}.png`;
    release = async () => {
      // Failure status releases only the slot; the rolling spend charge remains.
      const { error } = await supa.rpc("pilot_fail_generation", { p_reservation_id: reservationId });
      if (error) console.error("[pilot] Unable to release reservation; lease will expire.");
    };
    const brief = validateBrief(reservation.brief);
    const variant = STYLE_VARIANTS[idx];
    const prompt = buildTattooPrompt(buildPrompt(brief), variant, idx);
    const generated = await generateTattooImage(prompt, { size: "1024x1024", quality: "low" });
    const bytes = decodeRasterBase64(generated.b64, "image/png");
    const { error: uploadError } = await supa.storage.from("concepts").upload(path, bytes, {
      contentType: "image/png", upsert: false, cacheControl: "0"
    });
    if (uploadError) throw new RequestError(503, "Unable to save the image. Existing artwork has not been changed.");

    // Only this owned, unexpired reservation's uploaded object can be saved.
    // Existing artwork is replaced atomically on success, never deleted first.
    const { data: concept, error: saveError } = await supa.rpc("pilot_complete_generation", {
      p_reservation_id: reservationId,
      p_prompt: prompt,
      p_meta: { variant: variant.label, detail: variant.detail, model: generated.model, size: generated.size, quality: "low" }
    });
    if (saveError) rpcError(saveError);
    if (!concept || typeof concept !== "object" || !concept.id || !concept.image_url) rpcError(null);
    const imageUrl = conceptImageUrl(concept.id);
    release = undefined;
    return NextResponse.json(
      { concept: { ...concept, image_url: imageUrl, thumbnail_url: imageUrl } },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (release) {
      try { await release(); } catch { /* Still charged; the durable lease expires. */ }
    }
    return apiFailure(error);
  }
}
