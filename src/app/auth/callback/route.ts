import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { accountConfigured, safeReturnPath } from "@/components/pilot-client";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const next = safeReturnPath(url.searchParams.get("next"));
  const failure = new URL("/auth/login", url.origin);
  failure.searchParams.set("error", "callback_failed");
  failure.searchParams.set("next", next);
  if (!code || !accountConfigured()) return NextResponse.redirect(failure);
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(failure);
  } catch {
    return NextResponse.redirect(failure);
  }
  return NextResponse.redirect(new URL(next, url.origin));
}
