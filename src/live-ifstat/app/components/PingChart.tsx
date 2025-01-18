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
  Filler
} from 'chart.js'
import { useTheme } from '../contexts/ThemeContext'

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

interface PingData {
  ping_delay_ms: number
  rolling_avg_ms: number
  packet_loss: boolean
  highest_ping: number
  lowest_ping: number
  samples: string
}

interface PingStatus {
  timestamp: string
  servers: {
    [key: string]: PingData
  }
}

export default function PingChart() {
  const [pingData, setPingData] = useState<PingStatus | null>(null)
  const { isDarkMode } = useTheme();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/ping-status')
        const data = await response.json()
        setPingData(data)
      } catch (err) {
        console.error('Failed to fetch ping data:', err)
      }
    }

    fetchData()
    const interval = setInterval(fetchData, 5000)
    return () => clearInterval(interval)
  }, [])

  if (!pingData) return null

  const textColor = isDarkMode ? '#e5e7eb' : '#111827';
  const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';

  const chartData = {
    labels: Array.from({ length: 22 }, (_, i) => i + 1),
    datasets: pingData && pingData.servers ? Object.entries(pingData.servers).map(([server, data]) => ({
      label: server,
      data: JSON.parse(data.samples),
      borderColor: server === 'PRIMARY' 
        ? isDarkMode ? 'rgba(75, 192, 192, 0.8)' : 'rgb(75, 192, 192)'
        : isDarkMode ? 'rgba(255, 99, 132, 0.8)' : 'rgb(255, 99, 132)',
      backgroundColor: server === 'PRIMARY'
        ? isDarkMode ? 'rgba(75, 192, 192, 0.3)' : 'rgba(75, 192, 192, 0.5)'
        : isDarkMode ? 'rgba(255, 99, 132, 0.3)' : 'rgba(255, 99, 132, 0.5)',
      tension: 0.3,
    })) : [],
  }
  
  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
        labels: { color: textColor }
      },
      title: {
        display: true,
        text: 'Connection Ping Times',
        color: textColor
      },
    },
    scales: {
      x: {
        grid: { color: gridColor },
        ticks: { color: textColor }
      },
      y: {
        beginAtZero: true,
        grid: { color: gridColor },
        ticks: { color: textColor },
        title: {
          display: true,
          text: 'Ping (ms)',
          color: textColor
        },
      },
    },
  }

  return (
    <div className="p-4">
      <Line data={chartData} options={options} />
    </div>
  )
} 
