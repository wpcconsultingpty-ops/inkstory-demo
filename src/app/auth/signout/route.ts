import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertSameOrigin } from "@/lib/security";

export async function POST(req: Request) {
  try { assertSameOrigin(req); } catch {
    return NextResponse.json({ error: "Sign out from the InkStory app." }, { status: 403 });
  }
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } catch {
    return NextResponse.redirect(new URL("/auth/login?error=signout_failed", req.url), { status: 303 });
  }
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
