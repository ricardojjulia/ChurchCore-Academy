import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The e2e suite builds into its own directory so it never overwrites the dev server's .next.
  distDir: process.env.NEXT_DIST_DIR ?? ".next",
  allowedDevOrigins: ["127.0.0.1"],
  outputFileTracingRoot: fileURLToPath(new URL("./", import.meta.url)),
  async headers() {
    return [
      {
        source: "/student-sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/student" },
        ],
      },
    ];
  },
};

export default nextConfig;
