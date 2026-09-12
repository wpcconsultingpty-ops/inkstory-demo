export function generationError(status: number): string {
  switch (status) {
    case 400: return "Check that all required brief fields are complete and within their limits. Edit your brief, save it, then try again.";
    case 401: return "Your session has expired or sign-in is required. Sign in again, then return to this brief.";
    case 403: return "This account does not have pilot generation access, or this preview cannot make an authorised request. Ask about early access on Facebook; if already invited, try in a full browser tab. Your saved brief is unchanged.";
    case 404: return "This brief is no longer available to your account. Return to your briefs and open it again.";
    case 409: return "This direction may already be generating or its request has expired. Wait, then refresh to check for a saved result before retrying.";
    case 429: return "The pilot image allowance has been reached. Wait for the rolling 24-hour allowance to become available, or ask on Facebook. Repeated retries will not increase the allowance.";
    case 503: return "Pilot generation is paused or unavailable. Keep or export your brief and try again later. You can ask about availability on Facebook.";
    default: return "We could not complete this generation request. Your saved brief remains available. Refresh to check for a result before trying again; a request may still count towards the pilot allowance.";
  }
}

/** Only known, same-app destinations are accepted; never protocol-relative URLs. */
export function safeReturnPath(value: string | null | undefined): string {
  if (!value || /[\\\u0000-\u0020\u007f]/.test(value) || !value.startsWith("/") || value.startsWith("//")) return "/dashboard";
  try {
    const url = new URL(value, "https://inkstory.local");
    if (url.origin !== "https://inkstory.local" || url.hash) return "/dashboard";
    if (url.pathname === "/dashboard") return "/dashboard";
    if (url.pathname === "/brief") {
      const id = url.searchParams.get("id");
      return id && /^[a-f0-9-]{36}$/i.test(id) ? `/brief?id=${encodeURIComponent(id)}` : "/brief";
    }
    if (/^\/concepts\/[a-f0-9-]{36}$/i.test(url.pathname)) return url.pathname;
    return "/dashboard";
  } catch {
    return "/dashboard";
  }
}

export function accountConfigured(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return false;
  try { return /^https?:$/.test(new URL(url).protocol); } catch { return false; }
}
