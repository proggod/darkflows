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
}

const SystemMonitor: React.FC = () => {
  const [sysData, setSysData] = useState<SysData | null>(null);
  const [serverInfo, setServerInfo] = useState<ServerInfo | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus | null>(null);
  const [devices, setDevices] = useState<NetworkDevice[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Fetch devices first
    const fetchDevices = async () => {
      try {
        const response = await fetch('/api/devices');
        const data = await response.json();
        setDevices(data.devices || []);
      } catch {
        // Error handling is preserved but without logging
      }
    };

    fetchDevices();

    // Fetch server info once
    fetch('/api/server-info')
      .then(res => res.json())
      .then(data => {
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
      .catch(() => {/* Error handling preserved but without logging */})
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

    // Set up SSE for real-time stats
    const eventSource = new EventSource('/api/sys-stats');

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setSysData(data);
      } catch {
        // Error handling preserved but without logging
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
    };

    // Set up interval to refresh connection status
    const intervalId = setInterval(() => {
      fetch('/api/connection-status')
        .then(res => res.json())
        .then(updateConnectionStatus)
        .catch(() => {/* Error handling preserved but without logging */})
        .finally(() => setLoading(false));
    }, NETWORK_UPDATE_INTERVAL);

    return () => {
      eventSource.close();
      clearInterval(intervalId);
    };
  }, []);

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

  // Get the label for the active connection
  const activeDevice = devices.find(device => device.type?.toUpperCase() === connectionStatus?.active)
  const activeLabel = activeDevice?.label || activeDevice?.name || connectionStatus?.active || 'Unknown'

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
          className="w-2 h-2 btn-icon btn-icon-blue transform scale-25"
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