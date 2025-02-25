'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function AuthProtection({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (pathname === '/login') {
      setIsLoading(false);
      return;
    }

    fetch('/api/auth/check')
      .then(res => res.json())
      .then(data => {
        if (!data.authenticated) {
          router.push('/login');
        }
        setIsLoading(false);
      })
      .catch(() => {
        router.push('/login');
      });
  }, [pathname, router]);

  if (isLoading && pathname !== '/login') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600 dark:text-gray-300">Loading...</div>
      </div>
    );
  }

  return <>{children}</>;
} 