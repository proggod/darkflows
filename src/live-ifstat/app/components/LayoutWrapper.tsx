'use client';

import { usePathname } from 'next/navigation';
import AuthLayout from '../layouts/AuthLayout';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  if (isLoginPage) {
    return children;
  }

  return <AuthLayout>{children}</AuthLayout>;
} 