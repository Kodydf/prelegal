import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Build a fully static site into out/ so FastAPI can serve it.
  output: "export",
};

export default nextConfig;
