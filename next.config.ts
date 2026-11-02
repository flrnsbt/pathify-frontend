import type { NextConfig } from "next";

const isStaticExport = process.env.OUTPUT_MODE === "export";

const nextConfig: NextConfig = {
  output: isStaticExport ? "export" : undefined,
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
