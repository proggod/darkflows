/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable Edge Runtime
  experimental: {
    serverActions: true
  },
  logging: {
    fetches: {
      fullUrl: true
    }
  },
  // Disable strict mode for now while debugging auth
  reactStrictMode: false,
  headers: async () => [
    {
      source: '/:path*',  // Apply to ALL routes, not just API
      headers: [
        { key: 'Cache-Control', value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0' },
        { key: 'Pragma', value: 'no-cache' },
        { key: 'Expires', value: '0' },
        { key: 'Surrogate-Control', value: 'no-store' },
      ]
    },
    {
      source: '/api/:path*',
      headers: [
        {
          key: 'X-Accel-Buffering',
          value: 'no',
        },
      ],
    },
  ],
  typescript: {
    ignoreBuildErrors: true,
  }
}

module.exports = nextConfig 