import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Only proxy API requests in development — in production, the frontend
  // calls the API directly via NEXT_PUBLIC_API_URL
  ...(process.env.NODE_ENV !== "production" && {
    rewrites: async () => [
      {
        source: "/api/v1/:path*",
        destination: "http://localhost:4000/api/v1/:path*",
      },
    ],
  }),
};

export default nextConfig;
