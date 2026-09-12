import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    {
      error: "Anonymous image generation is disabled.",
      detail: "The demo uses sample artwork only and makes no paid AI calls. Generation is limited to invited, signed-in pilot participants."
    },
    { status: 403, headers: { "Cache-Control": "no-store" } }
  );
}
