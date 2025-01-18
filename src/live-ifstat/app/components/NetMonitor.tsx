'use client'
import { MoreVertical, Bell, Cpu, Box, HardDrive, Wifi } from 'lucide-react';

interface SystemMonitorProps {
  name: string;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  agentVersion: string;
  hasNotification: boolean;
}

const SystemMonitor = ({ 
  hasNotification 
}: SystemMonitorProps) => {
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
    return 'bg-green-500';
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 shadow-sm transition-colors duration-200 h-card">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          <div className={`w-1.5 h-1.5 rounded-full bg-green-500`}/>
          <span className="text-xs font-medium text-gray-700 dark:text-gray-200">Connection Status</span>
        </div>
        <div className="flex items-center space-x-1">
          {hasNotification && <Bell className="w-3 h-3 text-gray-500 dark:text-gray-400" />}
          <MoreVertical className="w-3 h-3 text-gray-500 dark:text-gray-400" />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="w-16 text-xs text-gray-500 dark:text-gray-300 flex items-center">
            <Wifi className="w-3 h-3 mr-1" />Network:</span>
          <div className="flex justify-between flex-1">
            <span className="text-xs text-gray-500 dark:text-gray-300">PRIMARY</span>
            <span className="text-xs text-gray-500 dark:text-gray-300">3 Days Uptime</span>
          </div>
        </div>

        <div className="flex items-center">
          <span className="w-16 text-xs text-gray-500 dark:text-gray-300 flex items-center">
            <Cpu className="w-3 h-3 mr-1" />Upload:</span>
          <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full">
            <div className={`h-full ${getBarColor(10, 'cpu')} rounded-full ${getBarWidth(10)}`} />
          </div>
          <span className="ml-2 text-xs text-gray-500 dark:text-gray-300 min-w-[32px] text-right">10%</span>
        </div>

        <div className="flex items-center">
          <span className="w-16 text-xs text-gray-500 dark:text-gray-300 flex items-center">
            <Box className="w-3 h-3 mr-1" />Download:</span>
          <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full">
            <div className={`h-full ${getBarColor(30, 'memory')} rounded-full ${getBarWidth(30)}`} />
          </div>
          <span className="ml-2 text-xs text-gray-500 dark:text-gray-300 min-w-[32px] text-right">30%</span>
        </div>

        <div className="flex items-center">
          <span className="w-16 text-xs text-gray-500 dark:text-gray-300 flex items-center">
            <HardDrive className="w-3 h-3 mr-1" />Disk:</span>
          <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full">
            <div className={`h-full ${getBarColor(50, 'disk')} rounded-full ${getBarWidth(50)}`} />
          </div>
          <span className="ml-2 text-xs text-gray-500 dark:text-gray-300 min-w-[32px] text-right">50%</span>
        </div>

        <div className="flex items-center">
          <span className="text-xs text-gray-500 dark:text-gray-300">Debian GNU/Linux 12 (bookworm)</span>
        </div>



        <div className="flex items-center">
          <span className="text-xs text-gray-500 dark:text-gray-300">Intel(R) Celeron(R) N5105 @ 2.00GHz (4 cores)</span>
        </div>



      </div>
    </div>
  );
}

export default SystemMonitor;