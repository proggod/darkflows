'use client'

import { useEffect, useState } from 'react'
import { Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js'

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend)

interface IfstatData {
  timestamp: string
  kbIn: number
  kbOut: number
}

export default function BarChartPage() {
  const [dataPoints, setDataPoints] = useState<IfstatData[]>([])
  const maxDataPoints = 60 // keep the last 60 readings

  useEffect(() => {
    const es = new EventSource('/api/ifstat-stream')
    es.onmessage = (e) => {
      try {
        const newData: IfstatData = JSON.parse(e.data)
        setDataPoints((prev) => {
          const updated = [...prev, newData]
          if (updated.length > maxDataPoints) {
            updated.shift()
          }
          return updated
        })
      } catch (err) {
        console.error('Error parsing SSE data:', err)
      }
    }

    es.onerror = (err) => {
      console.error('SSE error:', err)
      es.close()
    }

    return () => {
      es.close()
    }
  }, [])

  const labels = dataPoints.map((d) => d.timestamp)
  const kbInData = dataPoints.map((d) => d.kbIn)
  const kbOutData = dataPoints.map((d) => d.kbOut)

  const chartData = {
    labels,
    datasets: [
      {
        label: 'KB/s In',
        data: kbInData,
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
      },
      {
        label: 'KB/s Out',
        data: kbOutData,
        backgroundColor: 'rgba(255, 99, 132, 0.6)',
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
      title: { display: true, text: 'Live ifstat Data (eth0) - Bar Chart' },
    },
  }

  return (
    <div style={{ width: '80%', margin: '0 auto', marginTop: '50px' }}>
      <h1>Network Throughput (enp3s0) - Bar Chart</h1>
      <Bar data={chartData} options={chartOptions} />
      <p>Displaying last {maxDataPoints} samples of KB/s In and Out.</p>
    </div>
  )
}
