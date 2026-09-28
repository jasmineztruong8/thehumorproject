import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Profile photos from our Supabase Storage bucket only
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ysucsqkyvsishalfqeld.supabase.co",
        pathname: "/storage/v1/object/public/avatars/**",
      },
    ],
  },
};

export default nextConfig;
