/** @type {import('next').NextConfig} */
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
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
      ]
    }];
  }
};
module.exports = nextConfig;
