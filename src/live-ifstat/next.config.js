/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable Edge Runtime
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000']
    },
    // Disable static optimization
    optimizeCss: false,
    // Increase timeouts for the build process
    staticWorkerTimeout: 120000, // 2 minutes in milliseconds
    staticGenerationTimeout: 120000, // 2 minutes in milliseconds
  },
  // Moved from experimental.serverComponentsExternalPackages 
  serverExternalPackages: ['sharp'],
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
  // Change from 0 to a reasonable timeout value
  staticPageGenerationTimeout: 120000, // 2 minutes in milliseconds
  // Disable image optimization caching
  images: {
    unoptimized: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  }
}

module.exports = nextConfig 