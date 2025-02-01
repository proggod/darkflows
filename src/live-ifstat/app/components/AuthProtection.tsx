'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export default function AuthProtection({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Don't check auth on login page
    if (pathname === '/login') {
      setIsLoading(false);
      return;
    }

    fetch('/api/auth/check')
      .then(res => res.json())
      .then(data => {
        if (!data.authenticated) {
          router.push('/login');
        } else {
          setIsLoading(false);
        }
      })
      .catch(() => router.push('/login'));
  }, [router, pathname]);

  if (isLoading && pathname !== '/login') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-300">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
} 