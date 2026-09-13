/** @type {import('next').NextConfig} */
if (process.env.NEXT_PUBLIC_INKSTORY_ENVIRONMENT === "staging") {
  const ref = process.env.NEXT_PUBLIC_INKSTORY_STAGING_REF;
  const controlledStagingGeneration =
    process.env.INKSTORY_GENERATION_ENABLED === "true" &&
    process.env.INKSTORY_CONTROLLED_STAGING_TEST === "true" &&
    ref === "ekeewaqospfceracerkl" &&
    (process.env.VERCEL_PROJECT_ID === undefined ||
      process.env.VERCEL_PROJECT_ID === "prj_KZL8MikMxfpdq9SiiMquOWt6Y2y9");
  if (!ref || ref === "yawmspiblfzzsosyeboc" ||
      process.env.NEXT_PUBLIC_SUPABASE_URL !== `https://${ref}.supabase.co` ||
      (process.env.INKSTORY_GENERATION_ENABLED !== "false" && !controlledStagingGeneration)) {
    throw new Error("Staging must use an isolated database and disabled generation unless the controlled staging test is explicitly enabled for the approved projects.");
  }
}
const nextConfig = {
  reactStrictMode: true,
  distDir: process.env.INKSTORY_BUILD_DIR || ".next",
  // All images are local preview artwork or authenticated same-origin responses.
  images: { unoptimized: true, remotePatterns: [] },
  poweredByHeader: false,
  experimental: { cpus: 2 },
  async headers() {
    return [{
      source: "/:path*",
      headers: [
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ...(process.env.NEXT_PUBLIC_INKSTORY_ENVIRONMENT === "staging"
          ? [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }]
          : [])
      ]
    }];
  }
};
module.exports = nextConfig;
