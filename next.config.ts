import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: true,
  partialPrefetching: true,
  // Native modules must stay out of the bundle.
  serverExternalPackages: ["@napi-rs/canvas", "sharp"],
  // Fonts are read from disk at runtime by the poster composer.
  outputFileTracingIncludes: { "/**": ["./assets/fonts/**"] },
  experimental: {
    // Guest photos from phones can be large; the API resizes them on arrival.
    serverActions: { bodySizeLimit: "15mb" },
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
