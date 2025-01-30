'use client';

import { useState, useEffect } from 'react';

export default function Clock() {
  const [mounted, setMounted] = useState(false);
  const [time, setTime] = useState<string>('');
  const [date, setDate] = useState<string>('');

  useEffect(() => {
    setMounted(true);
    const updateTime = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      }));
      setDate(now.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      }));
    };

    updateTime(); // Initial update
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Show nothing until mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="p-3 h-full flex flex-col">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-label">Clock</h3>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-label">Clock</h3>
      </div>
      <div className="flex-1 flex flex-col items-center justify-center">
        <div className="text-4xl font-medium text-gray-700 dark:text-gray-200">
          {time}
        </div>
        <div className="text-muted mt-1">
          {date}
        </div>
      </div>
    </div>
  );
} 