'use client'

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

export default function PingChart() {
  const { pingData } = usePingData()
  const { isDarkMode } = useTheme();

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
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: {
          color: textColor,
        },
      },
      title: {
        display: false,
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          color: gridColor,
        },
        ticks: {
          color: textColor,
        },
      },
      x: {
        grid: {
          color: gridColor,
        },
        ticks: {
          color: textColor,
        },
      },
    },
  }

  return (
    <div className="h-[300px] p-4">
      <Line data={chartData} options={options} />
    </div>
  )
} 
