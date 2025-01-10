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

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

interface IfstatData {
  timestamp: string
  kbIn: number
  kbOut: number
}

const maxDataPoints = 60

export default function HomePage() {
  const [dataPoints, setDataPoints] = useState<IfstatData[]>([])

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

  // Convert KB/s to Mb/s for display (optional)
  const mbInData = dataPoints.map((d) => d.kbIn * 0.008)
  const mbOutData = dataPoints.map((d) => d.kbOut * 0.008)
  const labels = dataPoints.map((d) => d.timestamp)

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Mb/s In',
        data: mbInData,
        borderColor: 'rgba(54, 162, 235, 1)',
        backgroundColor: 'rgba(54, 162, 235, 0.2)',
        tension: 0.3,
      },
      {
        label: 'Mb/s Out',
        data: mbOutData,
        borderColor: 'rgba(255, 99, 132, 1)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
        tension: 0.3,
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
      title: { display: true, text: 'Live ifstat Data (eth0) - Line Chart in Mb/s' },
    },
  }

  // Create 6 identical boxes for demonstration
  const boxes = Array.from({ length: 6 }, (_, i) => (
    <div key={i} className="bg-white p-4 border rounded shadow">
      <h2 className="mb-4 text-lg font-semibold">Chart {i + 1}</h2>
      <Line data={chartData} options={chartOptions} />
    </div>
  ))

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <h1 className="text-2xl font-bold mb-8 text-center">Network Throughput (eth0)</h1>
      <div 
        className="
          grid 
          grid-cols-1 
          md:grid-cols-1 
          lg:grid-cols-2 
          xl:grid-cols-3 
          2xl:grid-cols-3 
          gap-8
        "
      >
        {boxes}
      </div>
      <p className="text-center mt-4">Displaying last {maxDataPoints} samples of Mb/s In and Out.</p>
    </div>
  )
}
