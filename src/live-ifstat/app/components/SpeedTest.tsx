'use client'

import { useState } from 'react'

export default function SpeedTest() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<{
    download: number;
    upload: number;
    ping: number;
  } | null>(null);

  const runTest = async () => {
    setIsRunning(true);
    try {
      const response = await fetch('/api/speedtest');
      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error('Failed to run speed test:', error);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="p-4 rounded-lg bg-white dark:bg-gray-800 shadow-sm">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Speed Test</h3>
        <button
          onClick={runTest}
          disabled={isRunning}
          className={`px-4 py-2 rounded text-white transition-colors ${
            isRunning
              ? 'bg-gray-400 dark:bg-gray-600 cursor-not-allowed'
              : 'bg-blue-600 dark:bg-blue-700 hover:bg-blue-700 dark:hover:bg-blue-800'
          }`}
        >
          {isRunning ? 'Running...' : 'Run Test'}
        </button>
      </div>
      
      {results && (
        <div className="space-y-4">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Download</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">{results.download.toFixed(1)} Mbps</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-green-600 dark:bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min((results.download / 1000) * 100, 100)}%` }}
              />
            </div>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Upload</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">{results.upload.toFixed(1)} Mbps</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-blue-600 dark:bg-blue-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min((results.upload / 1000) * 100, 100)}%` }}
              />
            </div>
          </div>
          
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Ping</span>
              <span className="text-sm text-gray-600 dark:text-gray-400">{results.ping.toFixed(0)} ms</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-yellow-600 dark:bg-yellow-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${Math.min((results.ping / 100) * 100, 100)}%` }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 