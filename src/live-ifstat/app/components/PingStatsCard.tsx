'use client'

import { useEffect, useState, useCallback } from 'react'
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
import { RefreshCw } from 'lucide-react'

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

type ServerType = 'PRIMARY' | 'SECONDARY'

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
  const { pingData: sharedPingData } = usePingData()
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const fetchStats = useCallback(async () => {
    if (!sharedPingData?.servers[server]) return;
    
    try {
      const serverData = sharedPingData.servers[server]
      const samples = JSON.parse(serverData.samples)
      const timestamp = Date.now()
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
      setError(null)
    } catch {
      setError('Error fetching ping stats')
    }
  }, [server, sharedPingData])

  useEffect(() => {
    if (mounted) {
      fetchStats()
      const interval = setInterval(fetchStats, 5000)
      return () => clearInterval(interval)
    }
  }, [fetchStats, mounted])

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

  const deviceLabel = server;

  if (!mounted) {
    return (
      <div className="p-3 h-full flex flex-col">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-label">{server}</h3>
        </div>
        <div className="text-center py-4 text-muted">Loading...</div>
      </div>
    )
  }

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-label">{deviceLabel}</h3>
          <div className="flex items-center gap-4">
            <span className="text-small">
              Current: <span style={{ color }}>{currentPing ? `${currentPing.toFixed(1)}ms` : '-'}</span>
            </span>
            <span className="text-small">
              Avg: <span style={{ color }}>{rollingAvg ? `${rollingAvg.toFixed(1)}ms` : '-'}</span>
            </span>
            <span className={`text-small ${packetLoss ? 'text-red-500' : 'text-green-500'}`}>
              {packetLoss ? 'Loss' : 'OK'}
            </span>
          </div>
        </div>
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

      <div className="flex-1 overflow-auto">
        <div className="h-full">
          <Line
            data={chartData}
            options={{
              ...options,
              maintainAspectRatio: false,
              scales: {
                ...options.scales,
                y: {
                  ...options.scales.y,
                  ticks: {
                    ...options.scales.y.ticks,
                    font: {
                      size: 10
                    }
                  }
                }
              }
            }}
            className="!w-full !h-full"
          />
        </div>
      </div>
    </div>
  );
};

export default PingStatsCard; 