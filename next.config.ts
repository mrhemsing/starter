import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "lindy.b-average.com",
    "soma.b-average.com",
    "soma1.b-average.com",
    "soma2.b-average.com",
    "soma3.b-average.com",
    "soma4.b-average.com",
    "127.0.0.1",
  ],
  images: {
    qualities: [75, 86],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "img.mlbstatic.com",
        pathname: "/mlb-photos/image/upload/**",
      },
      {
        protocol: "https",
        hostname: "img.mlbstatic.com",
        pathname: "/mlb-images/image/upload/**",
      },
      {
        protocol: "https",
        hostname: "img.youtube.com",
        pathname: "/vi/**",
      },
    ],
  },
  async redirects() {
    return [
      {
        source: "/slate/yesterday/:date",
        destination: "/starts/:date",
        statusCode: 301,
      },
      {
        source: "/slate/today/:date",
        destination: "/upcoming/:date",
        statusCode: 301,
      },
      {
        source: "/slate/tomorrow/:date",
        destination: "/upcoming/:date",
        statusCode: 301,
      },
      {
        source: "/slate/week/:date",
        destination: "/upcoming/week/:date",
        statusCode: 301,
      },
      {
        source: "/form",
        destination: "/heat-check",
        statusCode: 301,
      },
      {
        source: "/how-it-works",
        destination: "/methodology",
        statusCode: 301,
      },
    ];
  },
};

export default nextConfig;
