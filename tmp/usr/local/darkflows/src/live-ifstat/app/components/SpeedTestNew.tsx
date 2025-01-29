'use client'

import { useState } from 'react';
import { Server, ArrowDown, ArrowUp, Activity, MapPin, Wifi } from 'lucide-react';


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

  const runTest = () => {
    setIsRunning(true);
    setResults(null);
    
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
        } else if (data.error) {
          console.error('Speed test error:', data.error);
          eventSource.close();
          setIsRunning(false);
        }
      } catch (error) {
        console.error('Failed to parse speed test data:', error);
        eventSource.close();
        setIsRunning(false);
      }
    };

    eventSource.onerror = () => {
      console.error('Speed test connection failed');
      eventSource.close();
      setIsRunning(false);
    };
  };


  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 shadow-sm transition-colors duration-200 h-card">
      <div className="flex flex-col h-full">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2 px-1">Speed Test</h3>
        
        <div className="flex-1 overflow-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Server className="w-3 h-3 text-gray-500 dark:text-gray-400" />
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">
                {results?.serverName || "Speed Test"}
              </h3>
            </div>
            {results && (
              <div className="flex items-center space-x-2 text-xs text-gray-500 dark:text-gray-400">
                <MapPin className="w-3 h-3" />
                <span>{results.location}</span>
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col justify-center space-y-4">
            {results && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                    <div className="flex items-center space-x-1.5">
                      <ArrowDown className="w-3 h-3 text-blue-500 dark:text-blue-400" />
                      <span className="text-xs text-gray-500 dark:text-gray-300">Download</span>
                    </div>
                    <div className="flex items-baseline mt-1">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-100">
                        {results.download.toFixed(1)}
                      </span>
                      <span className="text-xs ml-1 text-gray-500 dark:text-gray-400">Mbps</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1 mt-1">
                      <div
                        className="bg-blue-500 dark:bg-blue-400 h-1 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min((results.download / 1000) * 100, 100)}%` }}
                      />
                    </div>
                  </div>

                  <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                    <div className="flex items-center space-x-1.5">
                      <ArrowUp className="w-3 h-3 text-green-500 dark:text-green-400" />
                      <span className="text-xs text-gray-500 dark:text-gray-300">Upload</span>
                    </div>
                    <div className="flex items-baseline mt-1">
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-100">
                        {results.upload.toFixed(1)}
                      </span>
                      <span className="text-xs ml-1 text-gray-500 dark:text-gray-400">Mbps</span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1 mt-1">
                      <div
                        className="bg-green-500 dark:bg-green-400 h-1 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min((results.upload / 1000) * 100, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Activity className="w-3 h-3 text-purple-500 dark:text-purple-400" />
                    <span className="text-xs text-gray-500 dark:text-gray-300">Ping: </span>
                    <span className="text-sm font-semibold text-gray-700 dark:text-gray-100">
                      {results.ping.toFixed(0)}
                      <span className="text-xs ml-1 text-gray-500 dark:text-gray-400">ms</span>
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Wifi className="w-3 h-3 text-gray-500 dark:text-gray-400" />
                    <span className="text-xs text-gray-500 dark:text-gray-300">{results.isp}</span>
                  </div>
                </div>
              </>
            )}

            <button 
              onClick={runTest}
              disabled={isRunning}
              className={`h-6 px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                isRunning 
                  ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-blue-500 dark:bg-blue-600 text-white hover:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400'
              }`}
            >
              {isRunning ? 'Running Test...' : 'Start Speed Test'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}