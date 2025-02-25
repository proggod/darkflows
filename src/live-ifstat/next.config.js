/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable Edge Runtime
  experimental: {
    serverActions: true
  },
  // Disable strict mode for now while debugging auth
  reactStrictMode: false,
  headers: async () => {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, no-cache, must-revalidate, proxy-revalidate'
          },
          {
            key: 'Pragma',
            value: 'no-cache'
          },
          {
            key: 'Expires',
            value: '0'
          },
          {
            key: 'Access-Control-Allow-Credentials',
            value: 'true'
          }
        ]
      }
    ]
  },
  typescript: {
    ignoreBuildErrors: true,
  }
}

module.exports = nextConfig 