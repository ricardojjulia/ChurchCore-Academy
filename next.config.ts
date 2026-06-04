import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
