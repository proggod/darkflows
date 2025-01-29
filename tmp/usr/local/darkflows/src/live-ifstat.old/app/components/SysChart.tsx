'use client'

import { useEffect, useState } from 'react'
import { Line, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend)

interface SysData {
  timestamp: string
  cpu: number
  memFree: number
  totalMemMB: number
  percentFree: number
}

interface SysChartProps {
  metric: 'cpu' | 'mem'
}

const maxDataPoints = 60

export default function SysChart({ metric }: SysChartProps) {
  const [dataPoints, setDataPoints] = useState<SysData[]>([])

  // Local storage for chart type preference
  const storageKey = `chartType_${metric}`
  const initialChartType = (typeof window !== 'undefined' && localStorage.getItem(storageKey)) || 'line'
  const [chartType, setChartType] = useState<'line' | 'bar'>(initialChartType as 'line' | 'bar')

  useEffect(() => {
    const es = new EventSource(`/api/sys-stats`)
    es.onmessage = (e) => {
      try {
        const newData: SysData = JSON.parse(e.data)
        setDataPoints((prev) => {
          const updated = [...prev, newData]
          if (updated.length > maxDataPoints) {
            updated.shift()
          }
          return updated
        })
      } catch (err) {
        console.error('Error parsing SSE data for sys-stats:', err)
      }
    }

    es.onerror = (err) => {
      console.error('SSE error for sys-stats:', err)
      es.close()
    }

    return () => {
      es.close()
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, chartType)
    }
  }, [chartType, storageKey])

  const labels = dataPoints.map((d) => d.timestamp)

  if (metric === 'cpu') {
    // CPU chart
    const cpuData = dataPoints.map((d) => d.cpu)
    const latestCpu = dataPoints.length > 0 ? dataPoints[dataPoints.length - 1].cpu : 0
    const chartData = {
      labels,
      datasets: [
        {
          label: 'CPU Load (%)',
          data: cpuData,
          backgroundColor: 'rgba(75, 192, 192, 0.6)',
          borderColor: 'rgba(75, 192, 192, 1)',
          fill: chartType === 'line',
          tension: chartType === 'line' ? 0.3 : 0
        },
      ],
    }

    const chartOptions = {
      responsive: true,
      animation: { duration: 0 },
      scales: {
        x: { display: true },
        y: { display: true, beginAtZero: true },
      },
      plugins: {
        legend: { position: 'top' as const },
        title: {
          display: true,
          text: 'CPU Load'
        },
      },
    }

    return (
      <div className="bg-white p-4 border rounded shadow">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold text-gray-900">
            CPU Load: {latestCpu.toFixed(1)}%
          </h2>
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value as 'line' | 'bar')}
            className="border rounded p-1 text-sm text-gray-900"
          >
            <option value="line">Line</option>
            <option value="bar">Bar</option>
          </select>
        </div>
        {chartType === 'line' ? (
          <Line data={chartData} options={chartOptions} />
        ) : (
          <Bar data={chartData} options={chartOptions} />
        )}
        <p className="text-sm mt-2 text-gray-800">Last {maxDataPoints} samples</p>
      </div>
    )

  } else {
    // Memory chart
    const memFreeData = dataPoints.map((d) => d.memFree)
    const percentFreeData = dataPoints.map((d) => d.percentFree)
    const latest = dataPoints[dataPoints.length - 1]
    const totalMemMB = latest ? latest.totalMemMB : 0
    const latestPercentFree = latest ? latest.percentFree : 0
    const latestMemFree = latest ? latest.memFree : 0

    const chartData = {
      labels,
      datasets: [
        {
          label: 'Free Memory (MB)',
          data: memFreeData,
          backgroundColor: 'rgba(54, 162, 235, 0.6)',
          borderColor: 'rgba(54, 162, 235, 1)',
          yAxisID: 'yMemory',
          fill: chartType === 'line',
          tension: chartType === 'line' ? 0.3 : 0
        },
        {
          label: 'Percent Free (%)',
          data: percentFreeData,
          backgroundColor: 'rgba(255, 206, 86, 0.6)',
          borderColor: 'rgba(255, 206, 86, 1)',
          yAxisID: 'yPercent',
          fill: chartType === 'line',
          tension: chartType === 'line' ? 0.3 : 0
        },
      ],
    }

    const chartOptions = {
      responsive: true,
      animation: { duration: 0 },
      scales: {
        x: { display: true },
        yMemory: { 
          display: true, 
          beginAtZero: true, 
          type: 'linear', 
          position: 'left' 
        },
        yPercent: {
          display: true,
          beginAtZero: true,
          type: 'linear',
          position: 'right',
          grid: {
            drawOnChartArea: false
          }
        },
      },
      plugins: {
        legend: { position: 'top' as const },
        title: {
          display: true,
          text: `Free Memory / % Free (Total: ${totalMemMB} MB)`
        },
      },
    }

    return (
      <div className="bg-white p-4 border rounded shadow">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Memory Usage</h2>
            <div className="text-sm text-gray-600">
              Free: {latestMemFree.toFixed(0)} MB ({latestPercentFree.toFixed(1)}%)
            </div>
          </div>
          <select
            value={chartType}
            onChange={(e) => setChartType(e.target.value as 'line' | 'bar')}
            className="border rounded p-1 text-sm text-gray-900"
          >
            <option value="line">Line</option>
            <option value="bar">Bar</option>
          </select>
        </div>
        {chartType === 'line' ? (
          <Line data={chartData} options={{...chartOptions, scales: {
            x: { display: true },
            y: { 
              display: true, 
              beginAtZero: true, 
              type: 'linear' as const, 
              position: 'left' 
            },
            y2: {
              display: true,
              beginAtZero: true,
              type: 'linear' as const,
              position: 'right',
              grid: {
                drawOnChartArea: false
              }
            },
          }}} />
        ) : (
          <Bar data={chartData} options={{...chartOptions, scales: {
            x: { display: true },
            y: { 
              display: true, 
              beginAtZero: true, 
              type: 'linear' as const, 
              position: 'left' 
            },
            y2: {
              display: true,
              beginAtZero: true,
              type: 'linear' as const,
              position: 'right',
              grid: {
                drawOnChartArea: false
              }
            },
          }}} />
        )}
        <p className="text-sm mt-2 text-gray-800">
          Last {maxDataPoints} samples
        </p>
      </div>
    )
  }
}
