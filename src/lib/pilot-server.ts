import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "./supabase/server";
import { RequestError, requireGenerationEnabled, validateBrief } from "./security";
import { parseGenerationEntitlement, type GenerationEntitlement } from "./generation-entitlement";

export async function readGenerationEntitlement(
  supa: Awaited<ReturnType<typeof createSupabaseServerClient>>
): Promise<GenerationEntitlement | null> {
  try {
    const { data, error } = await supa.rpc("pilot_generation_entitlement");
    if (error) return null;
    const entitlement = parseGenerationEntitlement(data);
    if (entitlement?.can_generate && process.env.INKSTORY_GENERATION_ENABLED !== "true") {
      return { ...entitlement, reason: "paused", can_generate: false };
    }
    return entitlement;
  } catch { return null; }
}

export async function pilotContext() {
  const supa = await createSupabaseServerClient();
  const { data: { user }, error } = await supa.auth.getUser();
  if (error || !user) throw new RequestError(401, "Sign in to continue.");
  requireGenerationEnabled(process.env.INKSTORY_GENERATION_ENABLED);
  return { supa, user };
}

export function rpcError(error: { message?: string } | null): never {
  // No raw SQL, provider payload, prompt, token, or storage details in responses.
  const message = error?.message ?? "";
  const known: [string, number, string][] = [
    ["pilot_unauthorized", 401, "Sign in to continue."],
    ["pilot_disabled", 503, "Image generation is paused."],
    ["pilot_not_invited", 403, "Public free generation is not enabled for this account."],
    ["pilot_email_unverified", 403, "A verified email account is required. Restricted accounts cannot generate."],
    ["pilot_access_revoked", 403, "Generation access has been revoked or has expired. Contact InkStory for manual review."],
    ["pilot_lifetime_used", 409, "Your one lifetime free generation attempt has been used. Failed or expired attempts count. No retries; contact InkStory for manual review only."],
    ["pilot_global_quota", 429, "The shared rolling 24-hour service limit has been reached. No new attempt was reserved."],
    ["pilot_quota", 429, "This allowlisted account has reached its rolling 24-hour image allowance."],
    ["pilot_busy", 409, "This direction is already generating. Please wait before trying again."],
    ["pilot_lease", 409, "This generation reservation has expired or is no longer active."],
    ["pilot_not_found", 404, "Brief not found."],
    ["pilot_invalid_brief", 400, "Complete the required brief fields within the character limits."],
    ["pilot_invalid_index", 400, "idx must be an integer from 0 to 2."]
  ];
  for (const [code, status, text] of known) {
    if (message === code) throw new RequestError(status, text);
  }
  throw new RequestError(503, "Pilot services are unavailable. Existing artwork has not been removed.");
}

export function apiFailure(error: unknown) {
  const known = error instanceof RequestError;
  return NextResponse.json(
    { error: known ? error.message : "Generation could not be confirmed. Check for a saved result. Reserved attempts still count; contact InkStory for manual review." },
    { status: known ? error.status : 503, headers: { "Cache-Control": "no-store" } }
  );
}

export async function ownedBrief(
  supa: Awaited<ReturnType<typeof createSupabaseServerClient>>, userId: string, briefId: string
) {
  const { data, error } = await supa.from("briefs")
    .select("id,user_id,meaning,placement,size_cm,style,key_elements,palette,reference_notes,status")
    .eq("id", briefId).eq("user_id", userId).maybeSingle();
  if (error) throw new RequestError(503, "Unable to read the brief. Please try again later.");
  if (!data) throw new RequestError(404, "Brief not found.");
  return validateBrief(data);
}
