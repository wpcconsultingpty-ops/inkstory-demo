/** Fail closed if a staging build is pointed at production or an unexpected DB. */
export function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
  if (process.env.NEXT_PUBLIC_INKSTORY_ENVIRONMENT === "staging") {
    const ref = process.env.NEXT_PUBLIC_INKSTORY_STAGING_REF;
    if (!ref || ref === "yawmspiblfzzsosyeboc" || url !== `https://${ref}.supabase.co`) {
      throw new Error("Staging database isolation check failed.");
    }
  }
  return { url, key };
}
