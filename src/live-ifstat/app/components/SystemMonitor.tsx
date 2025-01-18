'use client'

// Network status update interval in milliseconds
const NETWORK_UPDATE_INTERVAL = 10000; // 30 seconds

import { useState, useEffect } from 'react';
import { MoreVertical, Bell, Cpu, Box, HardDrive, Wifi } from 'lucide-react';

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
      .catch(() => {/* Error handling preserved but without logging */});

    // Fetch connection status
    const updateConnectionStatus = (data: ConnectionStatus) => {
      setConnectionStatus(data);
    };

    fetch('/api/connection-status')
      .then(res => res.json())
      .then(updateConnectionStatus)
      .catch(() => {/* Error handling preserved but without logging */});

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
        .catch(() => {/* Error handling preserved but without logging */});
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
  const activeDevice = connectionStatus?.active === 'PRIMARY' || connectionStatus?.active === 'SECONDARY' ?
    // If active is PRIMARY/SECONDARY, find device by type
    devices.find(device => device.type?.toUpperCase() === connectionStatus.active) :
    // Otherwise find by interface name
    devices.find(device => device.name === connectionStatus?.active);
    
  const activeLabel = activeDevice?.label || connectionStatus?.active || 'Unknown';

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 shadow-sm transition-colors duration-200 h-card">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center space-x-2">
          <div className={`w-1.5 h-1.5 rounded-full bg-green-500`}/>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-200">System Information</span>
        </div>
        <div className="flex items-center space-x-1">
          <Bell className="w-3 h-3 text-gray-500 dark:text-gray-400" />
          <MoreVertical className="w-3 h-3 text-gray-500 dark:text-gray-400" />
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <span className="w-16 text-xs text-gray-500 dark:text-gray-300 flex items-center">
            <Wifi className="w-3 h-3 mr-1" />ISP:</span>
          <div className="flex justify-between flex-1">
            <span className="text-xs text-gray-400 dark:text-gray-400">{activeLabel}</span>
            <span className="text-xs text-gray-400 dark:text-gray-400">{serverInfo?.uptime || 'Unknown'}</span>
          </div>
        </div>

        <div className="flex items-center">
          <span className="w-16 text-xs text-gray-500 dark:text-gray-300 flex items-center">
            <Cpu className="w-3 h-3 mr-1" />CPU:</span>
          <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full">
            <div className={`h-full ${getBarColor(sysData?.cpu || 0, 'cpu')} rounded-full ${getBarWidth(sysData?.cpu || 0)}`} />
          </div>
          <span className="ml-2 text-xs text-gray-400 dark:text-gray-400 min-w-[32px] text-right">{sysData?.cpu?.toFixed(1) || 0}%</span>
        </div>

        <div>
          <div className="flex items-center">
            <span className="w-16 text-xs text-gray-500 dark:text-gray-300 flex items-center">
              <Box className="w-3 h-3 mr-1" />Memory:</span>
            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full">
              <div className={`h-full ${getBarColor(memoryUsage, 'memory')} rounded-full ${getBarWidth(memoryUsage)}`} />
            </div>
            <span className="ml-2 text-xs text-gray-400 dark:text-gray-400 min-w-[32px] text-right">{memoryUsage.toFixed(1)}%</span>
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-400 pl-16 mt-0.5">
            {sysData ? `${(sysData.memFree / 1024).toFixed(1)} GB free of ${(sysData.totalMemMB / 1024).toFixed(1)} GB` : 'Loading...'}
          </div>
        </div>

        <div>
          <div className="flex items-center">
            <span className="w-16 text-xs text-gray-500 dark:text-gray-300 flex items-center">
              <HardDrive className="w-3 h-3 mr-1" />Disk:</span>
            <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full">
              <div className={`h-full ${getBarColor(serverInfo?.disk || 0, 'disk')} rounded-full ${getBarWidth(serverInfo?.disk || 0)}`} />
            </div>
            <span className="ml-2 text-xs text-gray-400 dark:text-gray-400 min-w-[32px] text-right">{serverInfo?.disk || 0}%</span>
          </div>
          <div className="text-xs text-gray-400 dark:text-gray-400 pl-16 mt-0.5">
            {serverInfo && typeof serverInfo.diskAvailable === 'number' && typeof serverInfo.diskTotal === 'number' 
              ? `${serverInfo.diskAvailable.toFixed(1)} GB free of ${serverInfo.diskTotal.toFixed(1)} GB` 
              : 'Loading...'}
          </div>
        </div>

        <div className="text-xs text-gray-400 dark:text-gray-400">
          {serverInfo ? `${serverInfo.osName} ${serverInfo.osVersion}` : 'Loading OS info...'}
        </div>

        <div className="text-xs text-gray-400 dark:text-gray-400">
          {serverInfo?.cpuModel || 'Loading CPU info...'}
        </div>
      </div>
    </div>
  );
}

export default SystemMonitor;