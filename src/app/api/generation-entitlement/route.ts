import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { apiFailure, readGenerationEntitlement } from "@/lib/pilot-server";
import { RequestError } from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Read-only status works while generation is paused, without a provider key.
export async function GET() {
  try {
    const supa = await createSupabaseServerClient();
    const { data: { user }, error } = await supa.auth.getUser();
    if (error || !user) throw new RequestError(401, "Sign in to check your image allowance.");
    const entitlement = await readGenerationEntitlement(supa);
    if (!entitlement) throw new RequestError(503, "Image allowance could not be confirmed.");
    return NextResponse.json(entitlement, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) { return apiFailure(error); }
}
