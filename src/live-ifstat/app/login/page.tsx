'use client';

import { FormEvent, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    fetch('/api/auth/check-setup')
      .then(res => res.json())
      .then(data => setIsFirstTime(data.isFirstTime))
      .catch(error => {
        console.error('Failed to check setup status:', error);
      });
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    console.log('=== Login Form Submission START ===');

    const formData = new FormData(e.currentTarget);
    const password = formData.get('password') as string;

    try {
      if (isFirstTime) {
        console.log('First time setup flow...');
        // Validation checks
        if (password !== confirmPassword) {
          console.log('Password mismatch');
          setError('Passwords do not match');
          setIsLoading(false);
          return;
        }
        
        console.log('Saving credentials...');
        const setupResponse = await fetch('/api/auth/save-credentials', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });

        console.log('Save credentials response:', {
          ok: setupResponse.ok,
          status: setupResponse.status
        });

        if (!setupResponse.ok) {
          throw new Error('Failed to save credentials');
        }

        console.log('Updating system passwords...');
        const systemResponse = await fetch('/api/auth/update-system-passwords', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password })
        });

        console.log('System passwords update response:', {
          ok: systemResponse.ok,
          status: systemResponse.status
        });

        if (!systemResponse.ok) {
          throw new Error('Failed to update system passwords');
        }
      }

      console.log('Attempting login...');
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
        credentials: 'include'
      });

      const data = await response.json();
      console.log('Login response:', {
        ok: response.ok,
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
        data
      });

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      if (data.success) {
        console.log('Login successful, redirecting...');
        router.push('/');
        router.refresh();
      } else {
        console.log('Login failed:', data);
        setError('Invalid credentials');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(error instanceof Error ? error.message : 'Login failed');
    } finally {
      setIsLoading(false);
      console.log('=== Login Form Submission END ===');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
      <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md w-96">
        <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
          {isFirstTime ? 'Setup Password' : 'Login'}
        </h1>
        
        <div className="mb-4">
          <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
            Password
          </label>
          <input
            type="password"
            name="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            required
            minLength={isFirstTime ? 8 : undefined}
          />
        </div>

        {isFirstTime && (
          <div className="mb-4">
            <label className="block text-gray-700 dark:text-gray-300 text-sm font-bold mb-2">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-2 border rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              required
            />
          </div>
        )}

        {error && (
          <div className="mb-4 text-red-500 dark:text-red-400 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 disabled:opacity-50"
        >
          {isLoading ? 'Loading...' : (isFirstTime ? 'Create Password' : 'Login')}
        </button>
      </form>
    </div>
  );
} 