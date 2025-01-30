'use client'

import { useState } from 'react';
import { Server, ArrowDown, ArrowUp, Activity, MapPin, Wifi, RefreshCw } from 'lucide-react';


export default function SpeedTestNew() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<{
    download: number;
    upload: number;
    ping: number;
    serverName: string;
    location: string;
    isp: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastTestTime, setLastTestTime] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);

  const runTest = () => {
    setIsRunning(true);
    setResults(null);
    setError(null);
    setLastTestTime(null);
    setCurrentPhase(null);
    setProgress(0);
    
    const eventSource = new EventSource('/api/speedtest');
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.result) {
          setResults({
            download: data.result.download,
            upload: data.result.upload,
            ping: data.result.idleLatency,
            serverName: data.result.serverName,
            location: data.result.serverName.split(' - ')[1] || '',
            isp: data.result.isp
          });
          eventSource.close();
          setIsRunning(false);
          setLastTestTime(new Date().toLocaleTimeString());
        } else if (data.error) {
          console.error('Speed test error:', data.error);
          eventSource.close();
          setError(data.error);
          setIsRunning(false);
        }
      } catch (error) {
        console.error('Failed to parse speed test data:', error);
        eventSource.close();
        setError('Failed to parse speed test data');
        setIsRunning(false);
      }
    };

    eventSource.onerror = () => {
      console.error('Speed test connection failed');
      eventSource.close();
      setError('Speed test connection failed');
      setIsRunning(false);
    };
  };

  const handleStartTest = () => {
    runTest();
  };

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-label">Speed Test</h3>
        <RefreshCw 
          onClick={handleStartTest}
          className="w-2 h-2 btn-icon btn-icon-blue transform scale-25"
        />
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded mb-2 text-small">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {/* Server Info */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Server className="w-3 h-3 text-muted" />
            <h3 className="text-small">
              {results?.serverName || "Speed Test"}
            </h3>
          </div>
          {results && (
            <div className="flex items-center space-x-2 text-muted">
              <MapPin className="w-3 h-3" />
              <span>{results.location}</span>
            </div>
          )}
        </div>

        {/* Test Results */}
        <div className="flex-1 flex flex-col justify-center space-y-4">
          {results && (
            <>
              <div className="grid grid-cols-2 gap-2">
                {/* Download */}
                <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                  <div className="flex items-center space-x-1.5">
                    <ArrowDown className="w-3 h-3 text-blue-500 dark:text-blue-400" />
                    <span className="text-muted">Download</span>
                  </div>
                  <div className="flex items-baseline mt-1">
                    <span className="text-small font-semibold">
                      {results.download.toFixed(1)}
                    </span>
                    <span className="text-muted ml-1">Mbps</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1 mt-1">
                    <div
                      className="bg-blue-500 dark:bg-blue-400 h-1 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min((results.download / 1000) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Upload */}
                <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                  <div className="flex items-center space-x-1.5">
                    <ArrowUp className="w-3 h-3 text-green-500 dark:text-green-400" />
                    <span className="text-muted">Upload</span>
                  </div>
                  <div className="flex items-baseline mt-1">
                    <span className="text-small font-semibold">
                      {results.upload.toFixed(1)}
                    </span>
                    <span className="text-muted ml-1">Mbps</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1 mt-1">
                    <div
                      className="bg-green-500 dark:bg-green-400 h-1 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min((results.upload / 1000) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Ping & ISP */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                  <div className="flex items-center space-x-1.5">
                    <Activity className="w-3 h-3 text-yellow-500 dark:text-yellow-400" />
                    <span className="text-muted">Ping</span>
                  </div>
                  <div className="flex items-baseline mt-1">
                    <span className="text-small font-semibold">
                      {results.ping.toFixed(0)}
                    </span>
                    <span className="text-muted ml-1">ms</span>
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                  <div className="flex items-center space-x-1.5">
                    <Wifi className="w-3 h-3 text-purple-500 dark:text-purple-400" />
                    <span className="text-muted">ISP</span>
                  </div>
                  <div className="text-small mt-1 truncate">
                    {results.isp}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Progress */}
          {isRunning && (
            <div className="text-center">
              <div className="text-muted mb-2">{currentPhase}</div>
              <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full">
                <div 
                  className="h-full bg-blue-500 dark:bg-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Last Test Time */}
          {lastTestTime && !isRunning && (
            <div className="text-center text-muted">
              Last test: {lastTestTime}
            </div>
          )}
        </div>

        <button 
          onClick={runTest}
          disabled={isRunning}
          className={`btn ${isRunning ? 'btn-gray' : 'btn-blue'}`}
        >
          {isRunning ? 'Running Test...' : 'Start Speed Test'}
        </button>
      </div>
    </div>
  );
}