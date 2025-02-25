'use client';

import { useActionState } from 'react';
import { login } from '@/app/actions/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect } from 'react';

// Define our state type
interface LoginState {
  error?: string;
  success: boolean;
  redirectTo?: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState<LoginState>(
    login,
    {
      error: undefined,
      success: false,
      redirectTo: undefined,
    }
  );

  // Handle successful login with useEffect
  useEffect(() => {
    if (state?.success) {
      router.push(state.redirectTo || '/');
    }
  }, [state?.success, state?.redirectTo, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-black">
      <div className="max-w-md w-full p-6 space-y-6 bg-gray-900 rounded-lg">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Login</h1>
          <p className="text-gray-400">Welcome back!</p>
        </div>

        {state?.error && (
          <div className="p-3 bg-red-500/10 border border-red-500 rounded text-red-500 text-sm">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-400">
              Email
            </label>
            <input
              type="email"
              name="email"
              id="email"
              required
              className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-400">
              Password
            </label>
            <input
              type="password"
              name="password"
              id="password"
              required
              className="mt-1 block w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isPending ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="text-center text-sm text-gray-400">
          Don&apos;t have an account?{' '}
          <Link href="/register" className="text-blue-400 hover:underline">
            Register
          </Link>
        </div>
      </div>
    </div>
  );
}
