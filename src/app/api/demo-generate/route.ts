import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "Anonymous image generation is disabled.",
      detail: "The demo makes no AI calls. Account generation requires verified email, enabled access and an available allowance. Public accounts have one lifetime reserved attempt; failures count and there are no retries."
    },
    { status: 403, headers: { "Cache-Control": "no-store" } }
  );
}
