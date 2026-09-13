import { NextResponse } from "next/server";
import { buildGenerationPlan, validateGenerationPrompt, validateOutputMode } from "@/lib/generation-plan";
import { generateTattooImage } from "@/lib/openai-image";
import {
  RequestError, conceptImageUrl, decodeRasterBase64, readJsonObject,
  validateBrief, validateDirectionIndex, validateUUID
} from "@/lib/security";
import { apiFailure, ownedBrief, pilotContext, rpcError } from "@/lib/pilot-server";

export const runtime = "nodejs";
export const maxDuration = 240;

export async function POST(req: Request) {
  let release: (() => Promise<void>) | undefined;
  try {
    const body = await readJsonObject(req);
    const briefId = validateUUID(body.brief_id);
    const idx = validateDirectionIndex(body.idx);
    const outputMode = validateOutputMode(body.output_mode);
    // New output is on-body only, enforced before auth or reservation.
    // No client prompt, model, quality, count, size or timeout can bypass policy.
    if (Object.keys(body).some((key) => !["brief_id", "idx", "output_mode"].includes(key))) {
      throw new RequestError(400, "Only brief_id, idx and output_mode are accepted.");
    }
    const { supa, user } = await pilotContext();
    const savedBrief = await ownedBrief(supa, user.id, briefId);
    // Preflight the complete prompt against the SQL save ceiling BEFORE any
    // charge. The reserved snapshot is compiled and checked again below to
    // close a concurrent-edit race without ever truncating avoidance notes.
    validateGenerationPrompt(buildGenerationPlan(savedBrief, idx, outputMode).prompt);
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
    const plan = buildGenerationPlan(brief, idx, outputMode);
    validateGenerationPrompt(plan.prompt);
    const generated = await generateTattooImage(plan.prompt, { expiresAt: reservation.expires_at });
    const bytes = decodeRasterBase64(generated.b64, "image/png");
    const { error: uploadError } = await supa.storage.from("concepts").upload(path, bytes, {
      contentType: "image/png", upsert: false, cacheControl: "0"
    });
    if (uploadError) throw new RequestError(503, "Unable to save the image. Existing artwork has not been changed.");

    // Only this owned, unexpired reservation's uploaded object can be saved.
    // Existing artwork is replaced atomically on success, never deleted first.
    const { data: concept, error: saveError } = await supa.rpc("pilot_complete_generation", {
      p_reservation_id: reservationId,
      p_prompt: plan.prompt,
      p_meta: {
        variant: plan.label,
        detail: plan.description,
        output_mode: plan.outputMode,
        prompt_version: plan.promptVersion,
        model: generated.model,
        size: generated.size,
        quality: generated.quality
      }
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
