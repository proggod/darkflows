'use client';

import { FormEvent, useState, useEffect } from 'react';
import { ThemeProvider } from '../contexts/ThemeContext';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Check if this is first-time setup
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
    console.log('Starting login/setup process...');

    if (isFirstTime) {
      if (password !== confirmPassword) {
        setError('Passwords do not match');
        setIsLoading(false);
        return;
      }
      if (password.length < 8) {
        setError('Password must be at least 8 characters');
        setIsLoading(false);
        return;
      }
    }

    try {
      if (isFirstTime) {
        console.log('First time setup - creating account...');
        const loginResponse = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });

        const loginData = await loginResponse.json();
        console.log('Setup response:', {
          status: loginResponse.status,
          ok: loginResponse.ok,
          data: loginData
        });

        if (!loginResponse.ok) {
          throw new Error(loginData.error || 'Setup failed');
        }
      } else {
        console.log('Normal login...');
        const loginResponse = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password }),
        });

        const loginData = await loginResponse.json();
        console.log('Login response:', {
          status: loginResponse.status,
          ok: loginResponse.ok,
          data: loginData
        });

        if (!loginResponse.ok) {
          throw new Error(loginData.error || 'Login failed');
        }
      }

      console.log('Success, redirecting...');
      window.location.href = '/';
    } catch (error) {
      console.error('Login/setup failed:', error);
      if (error instanceof Error) {
        console.error('Error details:', error.message);
      }
      setError(isFirstTime ? 'Failed to create account' : 'Invalid password');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <ThemeProvider>
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="max-w-md w-full space-y-8 p-8 bg-gray-800 rounded-lg shadow-lg">
          <div>
            <h2 className="mt-6 text-center text-3xl font-bold text-white">
              {isFirstTime ? 'Create Admin Account' : 'DarkFlows Router'}
            </h2>
            <p className="mt-2 text-center text-sm text-gray-400">
              {isFirstTime ? 'Set your admin password' : 'Please enter your password to continue'}
            </p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-700 bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {isFirstTime && (
              <div>
                <label htmlFor="confirmPassword" className="sr-only">
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  required
                  className="appearance-none rounded relative block w-full px-3 py-2 border border-gray-700 bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            )}

            <div>
              <button
                type="submit"
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                disabled={isLoading}
              >
                {isLoading ? 'Please wait...' : (isFirstTime ? 'Create Account' : 'Log in')}
              </button>
            </div>

            {error && (
              <div className="text-red-500 text-sm text-center mt-2">
                {error}
              </div>
            )}
          </form>
        </div>
      </div>
    </ThemeProvider>
  );
} 