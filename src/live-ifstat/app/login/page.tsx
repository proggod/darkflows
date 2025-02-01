'use client';

import { FormEvent, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ThemeProvider } from '../contexts/ThemeContext';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Check if this is first-time setup
    fetch('/api/auth/check-setup')
      .then(res => res.json())
      .then(data => setIsFirstTime(data.isFirstTime))
      .catch(console.error);
  }, []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const password = formData.get('password') as string;

    if (isFirstTime) {
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters');
        return;
      }
    }

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        router.push('/');
        router.refresh();
      } else {
        setError('Invalid password');
      }
    } catch (error) {
      console.error('Login failed:', error);
      setError('Login failed. Please try again.');
    }
  }

  return (
    <ThemeProvider>
      <div className="min-h-screen flex items-center justify-center">
        <form onSubmit={handleSubmit} className="space-y-4 w-full max-w-sm p-4">
          <h1 className="text-2xl font-bold mb-4">
            {isFirstTime ? 'Create Admin Account' : 'Login'}
          </h1>
          {error && <p className="text-red-500">{error}</p>}
          <div>
            <label htmlFor="password" className="block mb-1">Password</label>
            <input
              type="password"
              id="password"
              name="password"
              required
              className="w-full p-2 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
            />
          </div>
          {isFirstTime && (
            <div>
              <label htmlFor="confirmPassword" className="block mb-1">Confirm Password</label>
              <input
                type="password"
                id="confirmPassword"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                className="w-full p-2 rounded bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100"
              />
            </div>
          )}
          <button
            type="submit"
            className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600"
          >
            {isFirstTime ? 'Create Account' : 'Login'}
          </button>
        </form>
      </div>
    </ThemeProvider>
  );
} 