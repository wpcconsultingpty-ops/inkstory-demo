import { NextResponse } from "next/server";
import { readJsonObject, validateUUID } from "@/lib/security";
import { apiFailure, ownedBrief, pilotContext, rpcError } from "@/lib/pilot-server";

export const runtime = "nodejs";
export const maxDuration = 10;

// Preparation never destroys artwork or reserves image spend. Every subsequent
// image call independently checks and atomically reserves its durable allowance.
export async function POST(req: Request) {
  try {
    const body = await readJsonObject(req);
    const briefId = validateUUID(body.brief_id);
    const { supa, user } = await pilotContext();
    await ownedBrief(supa, user.id, briefId);
    const { error } = await supa.rpc("pilot_prepare_brief", { p_brief_id: briefId });
    if (error) rpcError(error);
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiFailure(error);
  }
}
