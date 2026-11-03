import type { NextConfig } from "next";

// Initialize OpenNext Cloudflare dev platform for local development
let devInitialized = false;
if (process.env.NODE_ENV !== "production") {
  try {
    // Use a synchronous approach: the dev platform is initialized by wrangler
    // when running `opennextjs-cloudflare preview`. For `next dev`, the
    // Cloudflare bindings are available via .dev.vars through Wrangler.
    devInitialized = true;
  } catch {
    // Fallback: dev platform not available
  }
}

const isStaticExport = process.env.OUTPUT_MODE === "export";

const nextConfig: NextConfig = {
  output: "standalone",
  cacheComponents: isStaticExport ? undefined : true,
  partialPrefetching: isStaticExport ? undefined : true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  ...(isStaticExport
    ? {}
    : {
        async headers() {
          return [
            {
              source: "/wasm/:path*",
              headers: [
                { key: "Content-Type", value: "application/wasm" },
                {
                  key: "Cache-Control",
                  value: "public, max-age=31536000, immutable",
                },
                { key: "Access-Control-Allow-Origin", value: "*" },
              ],
            },
          ];
        },
      }),
};

export default nextConfig;
