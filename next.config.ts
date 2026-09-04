import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    '10.200.162.143',
    '10.200.162.143:3000',
    '10.35.99.58',
    '10.35.99.58:3000',
    'localhost',
    'localhost:3000',
  ],
};

export default nextConfig;