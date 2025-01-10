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
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
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

  const chartData = {
    labels: Array.from({ length: 22 }, (_, i) => i + 1),
    datasets: Object.entries(pingData.servers).map(([server, data]) => ({
      label: server,
      data: JSON.parse(data.samples),
      borderColor: server === 'PRIMARY' ? 'rgb(75, 192, 192)' : 'rgb(255, 99, 132)',
      backgroundColor: server === 'PRIMARY' ? 'rgba(75, 192, 192, 0.5)' : 'rgba(255, 99, 132, 0.5)',
      tension: 0.3,
    })),
  }

  const options = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Connection Ping Times',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        title: {
          display: true,
          text: 'Ping (ms)',
        },
      },
    },
  }

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <Line data={chartData} options={options} />
    </div>
  )
} 
