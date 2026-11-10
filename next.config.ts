import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  // Native modules must stay out of the bundle.
  serverExternalPackages: ["@napi-rs/canvas", "sharp", "heic-convert"],
  // Fonts are read from disk at runtime by the poster composer.
  outputFileTracingIncludes: { "/**": ["./assets/fonts/**"] },
  experimental: {
    // Guest photos from phones can be large; the API resizes them on arrival.
    serverActions: { bodySizeLimit: "15mb" },
    // Requests to /admin pass through proxy.ts, which caps bodies at 10MB by default; lab videos are larger.
    proxyClientMaxBodySize: "200mb",
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
          // Not a full script policy (the framework's inline scripts would need nonces); it closes framing, base-tag and plugin tricks.
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
          ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
        ],
      },
    ];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
