'use client'

// Network status update interval in milliseconds
const NETWORK_UPDATE_INTERVAL = 10000; // 30 seconds

import { useState, useEffect } from 'react';
import { Cpu, Box, HardDrive, Wifi, RefreshCw } from 'lucide-react';

interface SysData {
  timestamp: string;
  cpu: number;
  memFree: number;
  totalMemMB: number;
  percentFree: number;
}

interface ServerInfo {
  cpuModel: string;
  osName: string;
  osVersion: string;
  disk: number;
  uptime?: string;
  diskTotal: number;
  diskAvailable: number;
}

interface ConnectionStatus {
  active: string;
}

interface NetworkDevice {
  name: string;
  type?: 'primary' | 'secondary' | 'internal';
  label?: string;
  id?: string;
}

const SystemMonitor: React.FC = () => {
  console.log('SystemMonitor: Component rendering');

  const [sysData, setSysData] = useState<SysData | null>(null);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [devices, setDevices] = useState<NetworkDevice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [sseConnected, setSseConnected] = useState(false);

  useEffect(() => {
    console.log('SystemMonitor: Main useEffect running');

    // Fetch devices first
    const fetchDevices = async () => {
      console.log('SystemMonitor: Fetching devices');
      try {
        const response = await fetch('/api/devices');
        console.log('SystemMonitor: Devices response status:', response.status);
        const data = await response.json();
        console.log('SystemMonitor: Devices data:', data);
        
        // Add validation and default value
        if (!data || !Array.isArray(data.devices)) {
          console.warn('SystemMonitor: Invalid devices data format, using empty array');
          setDevices([]);
          return;
        }
        
        setDevices(data.devices);
      } catch (err) {
        console.error('SystemMonitor: Error fetching devices:', err);
        setDevices([]); // Set empty array on error
      }
    };

    fetchDevices();

    // Fetch server info once
    console.log('SystemMonitor: Fetching server info');
    fetch('/api/server-info')
      .then(res => {
        console.log('SystemMonitor: Server info response status:', res.status);
        return res.json();
      })
      .then(data => {
        console.log('SystemMonitor: Server info data:', data);
        setServerInfo({
          cpuModel: data.serverInfo.cpuModel,
          osName: data.serverInfo.osName,
          osVersion: data.serverInfo.osVersion,
          disk: data.systemStats.disk,
          uptime: data.serverInfo.uptime,
          diskTotal: data.serverInfo.diskTotal,
          diskAvailable: data.serverInfo.diskAvailable
        });
      })
      .catch((err) => {
        console.error('SystemMonitor: Error fetching server info:', err);
      })
      .finally(() => setLoading(false));

    // Fetch connection status
    const updateConnectionStatus = (data: ConnectionStatus) => {
      setConnectionStatus(data);
    };

    fetch('/api/connection-status')
      .then(res => res.json())
      .then(updateConnectionStatus)
      .catch(() => {/* Error handling preserved but without logging */})
      .finally(() => setLoading(false));

    let retryTimeout: NodeJS.Timeout;
    let eventSource: EventSource | null = null;

    const setupSSE = () => {
      console.log('SystemMonitor: Setting up SSE connection');
      try {
        const timestamp = new Date().getTime();
        const url = `/api/sys-stats?t=${timestamp}`;
        console.log('SystemMonitor: SSE URL:', url);
        
        eventSource = new EventSource(url);
        
        eventSource.onopen = () => {
          console.log('SystemMonitor: SSE connection opened');
          setSseConnected(true);
          setError(null);
        };

        eventSource.onmessage = (event) => {
          console.log('SystemMonitor: SSE message received:', event.data);
          try {
            const data = JSON.parse(event.data);
            console.log('SystemMonitor: Parsed SSE data:', data);
            setSysData(data);
          } catch (err) {
            console.error('SystemMonitor: Error parsing SSE data:', err);
            setError('Failed to parse system stats data');
          }
        };

        eventSource.onerror = (err) => {
          console.error('SystemMonitor: SSE error:', err);
          console.log('SystemMonitor: EventSource readyState:', eventSource?.readyState);
          setSseConnected(false);
          setError('Lost connection to system stats. Retrying...');
          eventSource?.close();
          
          retryTimeout = setTimeout(() => {
            console.log('SystemMonitor: Attempting to reconnect SSE');
            setupSSE();
          }, 5000);
        };
      } catch (err) {
        console.error('SystemMonitor: Error in setupSSE:', err);
        setError('Failed to connect to system stats');
        setSseConnected(false);
      }
    };

    setupSSE();

    // Set up interval to refresh connection status
    const intervalId = setInterval(() => {
      fetch('/api/connection-status')
        .then(res => res.json())
        .then(updateConnectionStatus)
        .catch(() => {/* Error handling preserved but without logging */})
        .finally(() => setLoading(false));
    }, NETWORK_UPDATE_INTERVAL);

    // Cleanup
    return () => {
      console.log('SystemMonitor: Cleaning up');
      clearTimeout(retryTimeout);
      if (eventSource) {
        console.log('SystemMonitor: Closing EventSource');
        eventSource.close();
      }
      clearInterval(intervalId);
    };
  }, []);

  // Add debug logging for state changes
  useEffect(() => {
    console.log('SystemMonitor: sysData updated:', sysData);
  }, [sysData]);

  useEffect(() => {
    console.log('SystemMonitor: serverInfo updated:', serverInfo);
  }, [serverInfo]);

  useEffect(() => {
    console.log('SystemMonitor: error state updated:', error);
  }, [error]);

  const getBarWidth = (percentage: number) => {
    if (percentage <= 0) return 'w-0';
    if (percentage <= 10) return 'w-1/12';
    if (percentage <= 20) return 'w-2/12';
    if (percentage <= 30) return 'w-3/12';
    if (percentage <= 40) return 'w-4/12';
    if (percentage <= 50) return 'w-6/12';
    if (percentage <= 60) return 'w-7/12';
    if (percentage <= 70) return 'w-8/12';
    if (percentage <= 80) return 'w-9/12';
    if (percentage <= 90) return 'w-10/12';
    return 'w-full';
  };

  const getBarColor = (value: number, type: string) => {
    if (type === 'disk' && value > 60) return 'bg-yellow-500';
    if (value > 80) return 'bg-red-500';
    if (value > 60) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // Calculate memory usage percentage
  const memoryUsage = sysData ? 100 - sysData.percentFree : 0;

  // Modify the active device lookup to be more defensive
  const getActiveLabel = () => {
    if (!Array.isArray(devices) || !connectionStatus?.active) {
      return 'Unknown';
    }

    const activeDevice = devices.find(device => 
      device && device.type && device.type.toUpperCase() === connectionStatus.active
    );

    return activeDevice?.label || activeDevice?.name || connectionStatus.active || 'Unknown';
  };

  const activeLabel = getActiveLabel();

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/sys-stats');
      const data = await response.json();
      setSysData(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-label">System Monitor</h3>
        <RefreshCw 
          onClick={fetchStats}
          className={`w-2 h-2 btn-icon btn-icon-blue transform scale-25 
            ${!sseConnected ? 'animate-spin' : ''}`}
        />
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded mb-2 text-small">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-4 text-muted">Loading system stats...</div>
      ) : (
        <div className="flex-1 overflow-auto">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="w-16 text-small flex items-center">
                <Wifi className="w-3 h-3 mr-1" />ISP:
              </span>
              <div className="flex justify-between flex-1">
                <span className="text-muted">{activeLabel}</span>
                <span className="text-muted">{serverInfo?.uptime || 'Unknown'}</span>
              </div>
            </div>

            <div className="flex items-center">
              <span className="w-16 text-small flex items-center">
                <Cpu className="w-3 h-3 mr-1" />CPU:
              </span>
              <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full">
                <div className={`h-full ${getBarColor(sysData?.cpu || 0, 'cpu')} rounded-full ${getBarWidth(sysData?.cpu || 0)}`} />
              </div>
              <span className="ml-2 text-muted min-w-[32px] text-right">{sysData?.cpu?.toFixed(1) || 0}%</span>
            </div>

            <div>
              <div className="flex items-center">
                <span className="w-16 text-small flex items-center">
                  <Box className="w-3 h-3 mr-1" />Memory:
                </span>
                <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full">
                  <div className={`h-full ${getBarColor(memoryUsage, 'memory')} rounded-full ${getBarWidth(memoryUsage)}`} />
                </div>
                <span className="ml-2 text-muted min-w-[32px] text-right">{memoryUsage.toFixed(1)}%</span>
              </div>
              <div className="text-muted pl-16 mt-0.5">
                {sysData ? `${(sysData.memFree / 1024).toFixed(1)} GB free of ${(sysData.totalMemMB / 1024).toFixed(1)} GB` : 'Loading...'}
              </div>
            </div>

            <div>
              <div className="flex items-center">
                <span className="w-16 text-small flex items-center">
                  <HardDrive className="w-3 h-3 mr-1" />Disk:
                </span>
                <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full">
                  <div className={`h-full ${getBarColor(serverInfo?.disk || 0, 'disk')} rounded-full ${getBarWidth(serverInfo?.disk || 0)}`} />
                </div>
                <span className="ml-2 text-muted min-w-[32px] text-right">{serverInfo?.disk || 0}%</span>
              </div>
              <div className="text-muted pl-16 mt-0.5">
                {serverInfo && typeof serverInfo.diskAvailable === 'number' && typeof serverInfo.diskTotal === 'number' 
                  ? `${serverInfo.diskAvailable.toFixed(1)} GB free of ${serverInfo.diskTotal.toFixed(1)} GB` 
                  : 'Loading...'}
              </div>
            </div>

            <div className="text-muted">
              {serverInfo ? `${serverInfo.osName} ${serverInfo.osVersion}` : 'Loading OS info...'}
            </div>

            <div className="text-muted">
              {serverInfo?.cpuModel || 'Loading CPU info...'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default SystemMonitor;