import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["nodejs-whisper", "fluent-ffmpeg"],
};

export default nextConfig;
