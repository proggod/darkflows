'use client';

import React from "react";
import Sidebar from './components/Sidebar';
import { EditModeButton } from './contexts/EditModeContext';
import { useTheme } from './contexts/ThemeContext';

function ThemeToggle() {
  const { isDarkMode, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="p-2 rounded-full bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
      title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
    >
      {isDarkMode ? (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-yellow-400">
          <circle cx="12" cy="12" r="5"/>
          <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>
        </svg>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-900">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      )}
    </button>
  );
}

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="antialiased bg-gray-100 dark:bg-gray-900 text-gray-900 dark:text-gray-100">
      <div className="fixed top-2 right-4 z-50 flex items-center gap-2">
        <EditModeButton />
        <ThemeToggle />
      </div>
      <Sidebar />
      {children}
    </div>
  );
} 