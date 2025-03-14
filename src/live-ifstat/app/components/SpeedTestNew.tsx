'use client'

import { useState, useEffect } from 'react';
import { Server, ArrowDown, ArrowUp, Activity, MapPin, Wifi, RefreshCw, Globe, Zap } from 'lucide-react';

export default function SpeedTestNew() {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<{
    download: number;
    upload: number;
    ping: number;
    jitter: number;
    serverName: string;
    location: string;
    isp: string;
    ip: string;
    coordinates: [number, number];
    distance: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastTestTime, setLastTestTime] = useState<string | null>(null);
  const [currentPhase, setCurrentPhase] = useState<string | null>(null);
  const [progress, setProgress] = useState<number>(0);
  const [progressDots, setProgressDots] = useState<number>(0);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [liveData, setLiveData] = useState<{
    ip?: string;
    isp?: string;
    location?: [number, number];
    server?: string;
    ping?: number;
    jitter?: number;
    download?: number;
    upload?: number;
  }>({});

  // Animation for progress dots
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isRunning) {
      interval = setInterval(() => {
        setProgressDots(prev => (prev + 1) % 4);
      }, 500);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);

  const runTest = () => {
    setIsRunning(true);
    setResults(null);
    setError(null);
    setLastTestTime(null);
    setCurrentPhase('Initializing test...');
    setProgress(0);
    setDownloadProgress(0);
    setUploadProgress(0);
    setLiveData({});
    
    const eventSource = new EventSource('/api/speedtest-cli');
    
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.complete) {
          // Test completed
          setResults({
            download: data.download,
            upload: data.upload,
            ping: data.ping,
            jitter: data.jitter,
            serverName: data.serverName,
            location: data.location,
            isp: data.isp,
            ip: data.ip,
            coordinates: data.coordinates,
            distance: data.distance
          });
          eventSource.close();
          setIsRunning(false);
          setLastTestTime(new Date().toLocaleTimeString());
          setCurrentPhase(null);
        } else if (data.error) {
          console.error('Speed test error:', data.error);
          eventSource.close();
          setError(data.error);
          setIsRunning(false);
        } else if (data.phase) {
          // Update current phase and progress
          setCurrentPhase(data.phase);
          
          // Update live data as it comes in
          setLiveData(prev => ({...prev, ...data}));
          
          // Handle progress updates
          if (data.phase === 'Finding fastest server') {
            setProgress(10);
          } else if (data.phase === 'Testing ping') {
            setProgress(20);
          } else if (data.phase === 'Determining line type') {
            setProgress(30);
          } else if (data.phase === 'Testing download speed') {
            setProgress(40 + (data.progressPercent || 0) * 0.4);
            setDownloadProgress(data.progressPercent || 0);
          } else if (data.phase === 'Testing upload speed') {
            setProgress(80 + (data.progressPercent || 0) * 0.2);
            setUploadProgress(data.progressPercent || 0);
          }
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

  // Helper to render progress dots animation
  const renderDots = () => {
    return '.'.repeat(progressDots);
  };

  // Helper to format speed values
  const formatSpeed = (speed: number | undefined) => {
    if (speed === undefined) return "0.00";
    return speed < 100 ? speed.toFixed(2) : speed.toFixed(1);
  };

  // Helper to get phase icon
  const getPhaseIcon = () => {
    if (!currentPhase) return null;
    
    if (currentPhase.includes('Initializing')) {
      return <Zap className="w-4 h-4 text-yellow-500 animate-pulse" />;
    } else if (currentPhase.includes('Finding fastest server')) {
      return <Globe className="w-4 h-4 text-blue-500 animate-spin" />;
    } else if (currentPhase.includes('ping') || currentPhase.includes('jitter')) {
      return <Activity className="w-4 h-4 text-yellow-500 animate-pulse" />;
    } else if (currentPhase.includes('download')) {
      return <ArrowDown className="w-4 h-4 text-blue-500 animate-bounce" />;
    } else if (currentPhase.includes('upload')) {
      return <ArrowUp className="w-4 h-4 text-green-500 animate-bounce" />;
    }
    
    return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />;
  };

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-label">Speed Test</h3>
        <RefreshCw 
          onClick={handleStartTest}
          className={`w-2 h-2 btn-icon btn-icon-blue transform scale-25 ${isRunning ? 'animate-spin' : ''}`}
        />
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded mb-2 text-small">
          {error}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {/* Server Info */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Server className="w-3 h-3 text-muted" />
            <h3 className="text-small">
              {results?.serverName || liveData.server || "Speed Test"}
            </h3>
          </div>
          {(results || liveData.location) && (
            <div className="flex items-center space-x-2 text-muted">
              <MapPin className="w-3 h-3" />
              <span className="text-[9px]">{results?.location || (liveData.location ? `${liveData.location[0].toFixed(2)}, ${liveData.location[1].toFixed(2)}` : '')}</span>
            </div>
          )}
        </div>

        {/* Current Phase Indicator (only during test) */}
        {isRunning && currentPhase && (
          <div className="mb-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <div className="flex items-center space-x-2">
              {getPhaseIcon()}
              <span className="text-small font-medium">{currentPhase}{renderDots()}</span>
            </div>
            <div className="mt-2 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className="h-full bg-blue-500 dark:bg-blue-600 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <div className="space-y-3">
          {/* IP and ISP Info (shown during test and after) */}
          {(liveData.ip || results) && (
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                <div className="flex items-center space-x-1.5">
                  <Wifi className="w-3 h-3 text-purple-500 dark:text-purple-400" />
                  <span className="text-muted">ISP</span>
                </div>
                <div className="text-[9px] mt-1 truncate">
                  {results?.isp || liveData.isp || "Detecting..."}
                </div>
              </div>
              
              <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700">
                <div className="flex items-center space-x-1.5">
                  <Globe className="w-3 h-3 text-indigo-500 dark:text-indigo-400" />
                  <span className="text-muted">IP</span>
                </div>
                <div className="text-[9px] mt-1 truncate">
                  {results?.ip || liveData.ip || "Detecting..."}
                </div>
              </div>
            </div>
          )}

          {/* Animated Graphics - Centered in the middle of the card */}
          {isRunning && (
            <div className="flex justify-center my-4">
              {currentPhase?.includes('download') && (
                <div className="relative w-24 h-24">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <ArrowDown className="w-8 h-8 text-blue-500 animate-bounce" />
                  </div>
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle
                      className="text-gray-200"
                      strokeWidth="4"
                      stroke="currentColor"
                      fill="transparent"
                      r="44"
                      cx="48"
                      cy="48"
                    />
                    <circle
                      className="text-blue-500"
                      strokeWidth="4"
                      strokeDasharray={276}
                      strokeDashoffset={276 - (downloadProgress / 100) * 276}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="transparent"
                      r="44"
                      cx="48"
                      cy="48"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-small font-bold text-blue-600">
                      {downloadProgress.toFixed(0)}%
                    </span>
                  </div>
                </div>
              )}
              
              {currentPhase?.includes('upload') && (
                <div className="relative w-24 h-24">
                  <div className="absolute inset-0 flex items-center justify-center">
                    <ArrowUp className="w-8 h-8 text-green-500 animate-bounce" />
                  </div>
                  <svg className="w-24 h-24 transform -rotate-90">
                    <circle
                      className="text-gray-200"
                      strokeWidth="4"
                      stroke="currentColor"
                      fill="transparent"
                      r="44"
                      cx="48"
                      cy="48"
                    />
                    <circle
                      className="text-green-500"
                      strokeWidth="4"
                      strokeDasharray={276}
                      strokeDashoffset={276 - (uploadProgress / 100) * 276}
                      strokeLinecap="round"
                      stroke="currentColor"
                      fill="transparent"
                      r="44"
                      cx="48"
                      cy="48"
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-small font-bold text-green-600">
                      {uploadProgress.toFixed(0)}%
                    </span>
                  </div>
                </div>
              )}
              
              {currentPhase && !currentPhase.includes('download') && !currentPhase.includes('upload') && (
                <div className="flex items-center space-x-2">
                  {getPhaseIcon()}
                  <div className="h-1 w-16 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full animate-pulse-width"></div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Results Display */}
          {(results || (isRunning && (liveData.download || liveData.upload || liveData.ping))) && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {/* Download */}
                <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
                  {currentPhase?.includes('download') && (
                    <div className="absolute inset-0 bg-blue-100 dark:bg-blue-900 opacity-20 animate-pulse"></div>
                  )}
                  <div className="flex items-center space-x-1.5">
                    <ArrowDown className={`w-3 h-3 text-blue-500 dark:text-blue-400 ${currentPhase?.includes('download') ? 'animate-bounce' : ''}`} />
                    <span className="text-muted">Download</span>
                  </div>
                  <div className="flex items-baseline mt-1">
                    <span className="text-small font-semibold">
                      {formatSpeed(results?.download || liveData.download)}
                    </span>
                    <span className="text-muted ml-1">Mbps</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1 mt-1">
                    <div
                      className="bg-blue-500 dark:bg-blue-400 h-1 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${results 
                          ? Math.min((results.download / 1000) * 100, 100) 
                          : isRunning && currentPhase?.includes('download') 
                            ? downloadProgress 
                            : 0}%` 
                      }}
                    />
                  </div>
                </div>

                {/* Upload */}
                <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
                  {currentPhase?.includes('upload') && (
                    <div className="absolute inset-0 bg-green-100 dark:bg-green-900 opacity-20 animate-pulse"></div>
                  )}
                  <div className="flex items-center space-x-1.5">
                    <ArrowUp className={`w-3 h-3 text-green-500 dark:text-green-400 ${currentPhase?.includes('upload') ? 'animate-bounce' : ''}`} />
                    <span className="text-muted">Upload</span>
                  </div>
                  <div className="flex items-baseline mt-1">
                    <span className="text-small font-semibold">
                      {formatSpeed(results?.upload || liveData.upload)}
                    </span>
                    <span className="text-muted ml-1">Mbps</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-1 mt-1">
                    <div
                      className="bg-green-500 dark:bg-green-400 h-1 rounded-full transition-all duration-300"
                      style={{ 
                        width: `${results 
                          ? Math.min((results.upload / 1000) * 100, 100) 
                          : isRunning && currentPhase?.includes('upload') 
                            ? uploadProgress 
                            : 0}%` 
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Ping & Jitter */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
                  {currentPhase?.includes('ping') && (
                    <div className="absolute inset-0 bg-yellow-100 dark:bg-yellow-900 opacity-20 animate-pulse"></div>
                  )}
                  <div className="flex items-center space-x-1.5">
                    <Activity className={`w-3 h-3 text-yellow-500 dark:text-yellow-400 ${currentPhase?.includes('ping') ? 'animate-pulse' : ''}`} />
                    <span className="text-muted">Ping</span>
                  </div>
                  <div className="flex items-baseline mt-1">
                    <span className="text-small font-semibold">
                      {results?.ping?.toFixed(0) || liveData.ping?.toFixed(0) || "0"}
                    </span>
                    <span className="text-muted ml-1">ms</span>
                  </div>
                </div>

                <div className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 relative overflow-hidden">
                  {currentPhase?.includes('jitter') && (
                    <div className="absolute inset-0 bg-orange-100 dark:bg-orange-900 opacity-20 animate-pulse"></div>
                  )}
                  <div className="flex items-center space-x-1.5">
                    <Activity className={`w-3 h-3 text-orange-500 dark:text-orange-400 ${currentPhase?.includes('jitter') ? 'animate-pulse' : ''}`} />
                    <span className="text-muted">Jitter</span>
                  </div>
                  <div className="flex items-baseline mt-1">
                    <span className="text-small font-semibold">
                      {results?.jitter?.toFixed(0) || liveData.jitter?.toFixed(0) || "0"}
                    </span>
                    <span className="text-muted ml-1">ms</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Last Test Time */}
          {lastTestTime && !isRunning && (
            <div className="text-center text-muted text-[9px] mt-2">
              Last test: {lastTestTime}
            </div>
          )}
        </div>

        <button 
          onClick={runTest}
          disabled={isRunning}
          className={`btn ${isRunning ? 'btn-gray' : 'btn-blue'} mt-4 w-full`}
        >
          {isRunning ? 'Running Test...' : 'Start Speed Test'}
        </button>
      </div>
    </div>
  );
}