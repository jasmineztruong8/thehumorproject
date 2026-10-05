import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Profile photos and uploaded/meme images from our Supabase Storage only
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ysucsqkyvsishalfqeld.supabase.co",
        pathname: "/storage/v1/object/public/avatars/**",
      },
      {
        protocol: "https",
        hostname: "ysucsqkyvsishalfqeld.supabase.co",
        pathname: "/storage/v1/object/public/images/**",
      },
    ],
  },
};

export default nextConfig;
