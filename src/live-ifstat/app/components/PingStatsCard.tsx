'use client'

import { useEffect, useState } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TooltipItem,
  Filler
} from 'chart.js'
import { usePingData } from '../contexts/PingDataContext'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface NetworkDevice {
  name: string;
  type?: 'primary' | 'secondary' | 'internal';
  label?: string;
}

type ServerType = 'PRIMARY' | 'SECONDARY'

const PingStats = ({ data, dataKey, hasPacketLoss }: { 
  data: { [key: string]: number }[], 
  dataKey: string,
  hasPacketLoss: boolean 
}) => (
  <>
    <span className="text-gray-600 dark:text-gray-300">
      Highest Ping: {Math.max(...data.map(item => item[dataKey]))}ms
    </span>
    <span className="text-gray-600 dark:text-gray-300">
      Lowest Ping: {Math.min(...data.map(item => item[dataKey]))}ms
    </span>
    <span className={`font-medium ${hasPacketLoss ? 'text-red-500 dark:text-red-400' : 'text-green-500 dark:text-green-400'}`}>
      {hasPacketLoss ? 'Packet Loss' : 'No Loss'}
    </span>
  </>
);

const PingStatsCard = ({ 
  color,
  server
}: { 
  color: string
  server: ServerType 
}) => {
  const [pingData, setPingData] = useState<{ x: number; value: number }[]>([])
  const [currentPing, setCurrentPing] = useState<number>(0)
  const [rollingAvg, setRollingAvg] = useState<number>(0)
  const [packetLoss, setPacketLoss] = useState<boolean>(false)
  const [devices, setDevices] = useState<NetworkDevice[]>([])
  const { pingData: sharedPingData } = usePingData()

  useEffect(() => {
    // Fetch devices first
    const fetchDevices = async () => {
      try {
        const response = await fetch('/api/devices');
        const data = await response.json();
        setDevices(data.devices || []);
      } catch (error) {
        console.error('Failed to fetch devices:', error);
      }
    };

    fetchDevices();
  }, [])

  useEffect(() => {
    if (sharedPingData?.servers[server]) {
      const serverData = sharedPingData.servers[server]
      const samples = JSON.parse(serverData.samples)
      const timestamp = Date.now();
      const formattedData = samples.map((value: number, index: number) => ({
        x: index,
        value: value,
        key: `${server}-${timestamp}-${index}`,
        uniqueId: `${server}-${timestamp}-${index}`
      }))

      setPingData(formattedData)
      setCurrentPing(serverData.ping_delay_ms)
      setRollingAvg(serverData.rolling_avg_ms)
      setPacketLoss(serverData.packet_loss)
    }
  }, [sharedPingData, server])

  const maxPing = Math.max(...pingData.map(d => d.value), currentPing, rollingAvg)
  const yAxisMax = Math.ceil(maxPing / 25) * 25

  const chartData = {
    labels: pingData.map((_, index) => index),
    datasets: [
      {
        label: 'Ping Latency',
        data: pingData.map(d => d.value),
        borderColor: color,
        backgroundColor: color + '33',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.1
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: false
      },
      tooltip: {
        enabled: true,
        callbacks: {
          title: () => '',
          label: (context: TooltipItem<'line'>) => `${context.raw}ms`
        }
      }
    },
    scales: {
      y: {
        min: 0,
        max: yAxisMax,
        ticks: {
          stepSize: yAxisMax / 4
        }
      },
      x: {
        display: false,
        grid: {
          display: false
        }
      }
    }
  };

  // Get the label for the connection type
  const deviceLabel = devices.find(device => device.type?.toUpperCase() === server)?.label || server;

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-800 rounded-lg p-3 shadow-sm transition-colors duration-200">
      <div className="flex flex-col h-full">
        <div className="px-1 pb-2">
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {deviceLabel} Connection Latency
          </h3>
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400">
            <span>Current: {currentPing}ms</span>
            <span>Average: {rollingAvg}ms</span>
          </div>
        </div>
        <div className="flex-1 min-h-0">
          <div className="h-full">
            <Line
              data={chartData}
              options={options}
              className="!w-full !h-full"
            />
          </div>
        </div>
        <div className="flex justify-between text-xs mt-1 px-1">
          <PingStats
            data={pingData}
            dataKey="value"
            hasPacketLoss={packetLoss}
          />
        </div>
      </div>
    </div>
  );
};

export default PingStatsCard; 