import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enables the `use cache` directive and cacheTag/updateTag, which is how
  // painting data stays fresh without a redeploy. See lib/paintings.ts.
  cacheComponents: true,

  images: {
    // ImageKit does the resizing, not Vercel. Keeps us off Vercel's image
    // optimization quota and lets one CDN handle every transformation.
    loader: "custom",
    loaderFile: "./lib/imagekit-loader.ts",
  },
};

export default nextConfig;
