/** Safe, caller-only advisory status. The reservation RPC is the authority. */
export type GenerationEntitlement = {
  tier: "allowlisted" | "public_free" | "blocked" | "unverified" | "anonymous";
  reason: "available" | "used" | "paused" | "not_enabled" | "global_quota" | "quota" | "blocked" | "unverified" | "anonymous";
  remaining: number;
  limit: number;
  can_generate: boolean;
};

export function parseGenerationEntitlement(value: unknown): GenerationEntitlement | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (!["allowlisted", "public_free", "blocked", "unverified", "anonymous"].includes(String(v.tier)) ||
      !["available", "used", "paused", "not_enabled", "global_quota", "quota", "blocked", "unverified", "anonymous"].includes(String(v.reason)) ||
      typeof v.remaining !== "number" || !Number.isInteger(v.remaining) ||
      typeof v.limit !== "number" || !Number.isInteger(v.limit) ||
      v.limit < 0 || v.limit > 100 || v.remaining < 0 || v.remaining > v.limit ||
      typeof v.can_generate !== "boolean" ||
      v.can_generate !== (v.reason === "available") ||
      (v.can_generate && (v.remaining === 0 || !["allowlisted", "public_free"].includes(String(v.tier)))) ||
      (v.tier === "public_free" && v.limit !== 1)) return null;
  // Never pass through unknown fields from the RPC response.
  return { tier: v.tier, reason: v.reason, remaining: v.remaining, limit: v.limit, can_generate: v.can_generate } as GenerationEntitlement;
}

export function entitlementMessage(value: GenerationEntitlement | null): string {
  if (!value) return "We could not confirm your image allowance. Generation is unavailable until your allowance can be checked. Your saved briefs and images remain available.";
  const allowance = value.tier === "allowlisted"
    ? `Allowlisted account: ${value.remaining} of ${value.limit} attempts remaining in your rolling 24-hour window. Failed attempts count.`
    : value.tier === "public_free"
      ? value.remaining === 0
        ? "Your one lifetime free generation attempt has been used across this account. It does not reset with time, a new brief or another direction. Failed or expired attempts count; no retries or automatic replacements. Contact InkStory on Facebook for manual review only."
        : "One lifetime free generation attempt available for this verified email account, across all briefs and directions. Reservation uses it even if generation fails or expires. No retries or automatic replacements; failures require manual review on Facebook."
      : "";
  const status: Record<GenerationEntitlement["reason"], string> = {
    available: "Availability is checked again when you confirm. The shared service limit also applies.",
    used: "",
    paused: "Image generation is currently paused.",
    not_enabled: "Public free generation is not currently enabled.",
    global_quota: "The shared rolling 24-hour service limit has been reached. No new attempt can be reserved right now.",
    quota: "Your rolling 24-hour allowance has been reached.",
    blocked: "Generation access for this account has been revoked or has expired. It does not fall back to a public free attempt. Contact InkStory on Facebook for manual review.",
    unverified: "A verified email account is required. Verify your email and sign in again. Restricted accounts cannot generate.",
    anonymous: "Sign up or sign in with a verified email account to check generation access.",
  };
  return [allowance, status[value.reason]].filter(Boolean).join(" ");
}

/** Read-only refresh after a user-confirmed request; never retries generation. */
export async function refreshGenerationEntitlement(): Promise<GenerationEntitlement | null> {
  try {
    const response = await fetch("/api/generation-entitlement", { credentials: "same-origin", cache: "no-store" });
    if (!response.ok) return null;
    return parseGenerationEntitlement(await response.json());
  } catch { return null; }
}
