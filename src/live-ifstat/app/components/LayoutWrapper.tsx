'use client';

import { usePathname } from 'next/navigation';
import AuthLayout from '../layouts/AuthLayout';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Return children directly for login page
  if (pathname === '/login') {
    return children;
  }

  // Use AuthLayout for all other pages
  return <AuthLayout>{children}</AuthLayout>;
} 