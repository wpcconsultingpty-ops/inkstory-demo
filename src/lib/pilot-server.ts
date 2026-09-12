import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "./supabase/server";
import { RequestError, requireGenerationEnabled, validateBrief } from "./security";

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
    ["pilot_disabled", 503, "Image generation is paused for the invite-only free pilot."],
    ["pilot_not_invited", 403, "This account has not been invited to the free pilot."],
    ["pilot_quota", 429, "The pilot image allowance has been reached. Try again after the rolling 24-hour window."],
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
    { error: known ? error.message : "Pilot services are unavailable. Please try again later." },
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
