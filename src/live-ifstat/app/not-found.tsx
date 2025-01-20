import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <div className="text-center p-8 bg-white dark:bg-gray-800 rounded-lg shadow-lg">
        <h1 className="text-4xl font-bold text-gray-800 dark:text-gray-200 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700 dark:text-gray-300 mb-4">Page Not Found</h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">The page you&apos;re looking for doesn&apos;t exist or has been moved.</p>
        <Link 
          href="/"
          className="inline-block px-6 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
        >
          Return Home
        </Link>
      </div>
    </div>
  )
} 