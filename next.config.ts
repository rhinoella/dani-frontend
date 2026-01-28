import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "unsafe-none",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://accounts.google.com https://apis.google.com; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data: https://lh3.googleusercontent.com https://*.s3.amazonaws.com https://*.s3.eu-west-2.amazonaws.com; font-src 'self' data:; connect-src 'self' https://accounts.google.com https://api.ollama.ai http://localhost:8000 http://127.0.0.1:8000;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
