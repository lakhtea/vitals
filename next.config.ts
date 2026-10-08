import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // migrate() reads ./drizzle through fs at runtime, which build-time tracing
  // cannot see. Without this the serverless bundle on Vercel ships no
  // migrations and the first query fails on an empty database.
  outputFileTracingIncludes: {
    "/*": ["drizzle/**/*"],
  },
};

export default nextConfig;
