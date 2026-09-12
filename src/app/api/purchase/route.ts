import { NextResponse } from "next/server";

// Intentionally unconditional: no authentication, provider or database writes.
export async function POST() {
  return NextResponse.json(
    {
      error: "Paid checkout is unavailable.",
      detail: "InkStory is an invite-only free pilot. No payment or order has been created. Real checkout must be implemented and verified separately."
    },
    { status: 410, headers: { "Cache-Control": "no-store" } }
  );
}
