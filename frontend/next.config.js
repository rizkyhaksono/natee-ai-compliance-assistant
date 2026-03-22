/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8050/api/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
