/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable Edge Runtime
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000']
    }
  },
  logging: {
    fetches: {
      fullUrl: true
    }
  },
  // Disable strict mode for now while debugging auth
  reactStrictMode: false,
  // Disable all caching
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
  // Disable static optimization
  staticPageGenerationTimeout: 0,
  // Disable image optimization caching
  images: {
    unoptimized: true,
  },
  // Disable route caching
  experimental: {
    // ... existing experimental config ...
    // Disable route caching
    serverActions: {
      allowedOrigins: ['localhost:3000']
    },
    // Disable static optimization
    optimizeCss: false,
    // Disable static page generation
    staticPageGenerationTimeout: 0,
  },
  typescript: {
    ignoreBuildErrors: true,
  }
}

module.exports = nextConfig 