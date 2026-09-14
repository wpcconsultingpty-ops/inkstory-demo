export function generationError(status: number): string {
  switch (status) {
    case 400: return "Check that all required brief fields are complete and within their limits. Edit your brief, save it, then try again.";
    case 401: return "Your session has expired or sign-in is required. Sign in again, then return to this brief.";
    case 403: return "Generation needs a verified email account and enabled access. Revoked or expired memberships do not get a public allowance. Check your account status or ask on Facebook for manual review. Your saved brief is unchanged.";
    case 404: return "This brief is no longer available to your account. Return to your briefs and open it again.";
    case 409: return "Your lifetime attempt may already be used, or a request may be in progress or expired. Refresh only to check for a saved result and account status. Reserved public attempts do not reset; failures require manual review on Facebook, not a retry.";
    case 429: return "An account or shared rolling 24-hour service limit has been reached. Check your allowance status. A used public lifetime attempt never resets with the rolling window.";
    case 503: return "Generation is paused or unavailable, or the image could not be saved. Keep or export your brief and check for a saved result. If a request was reserved, the attempt remains used. Contact InkStory on Facebook for manual review; do not retry a reserved public attempt.";
    default: return "We could not complete this generation request. Your saved brief remains available. Refresh to check for a saved result. A reserved attempt counts even if it fails or expires; no public retries, manual review on Facebook only.";
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
