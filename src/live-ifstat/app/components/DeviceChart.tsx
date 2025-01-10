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
import { useNetworkData } from '../contexts/NetworkDataContext'
import Modal from './Modal'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Title, Tooltip, Legend)

interface DeviceChartProps {
  device: string
  label?: string
  type?: 'primary' | 'secondary' | 'internal'
  egressBandwidth?: string
  ingressBandwidth?: string
  className?: string
  isModal?: boolean
}

const maxDataPoints = 60

export default function DeviceChart({ device, label, className = '', isModal = false }: DeviceChartProps) {
  const chartTypeKey = `chartType_${device}`
  const dataTypeKey = `dataType_${device}`
  
  const initialChartType = (typeof window !== 'undefined' && localStorage.getItem(chartTypeKey)) || 'line'
  const initialDataType = (typeof window !== 'undefined' && localStorage.getItem(dataTypeKey)) || 'both'
  
  const [chartType, setChartType] = useState<'line' | 'bar'>(initialChartType as 'line' | 'bar')
  const [dataType, setDataType] = useState<'input' | 'output' | 'both'>(initialDataType as 'input' | 'output' | 'both')
  
  const { data: dataPoints, connectionStatus, lastError } = useNetworkData(device)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(chartTypeKey, chartType)
      localStorage.setItem(dataTypeKey, dataType)
    }
  }, [chartType, dataType, chartTypeKey, dataTypeKey])

  // Convert KB/s to Mb/s
  const mbInData = dataPoints.map((d) => d.kbIn * 0.008)
  const mbOutData = dataPoints.map((d) => d.kbOut * 0.008)
  const labels = dataPoints.map((d) => d.timestamp)

  const datasets = []
  if (dataType === 'input' || dataType === 'both') {
    datasets.push({
      label: 'Mb/s In',
      data: mbInData,
      backgroundColor: 'rgba(54, 162, 235, 0.6)',
      borderColor: 'rgba(54, 162, 235, 1)',
      fill: chartType === 'line',
      tension: chartType === 'line' ? 0.3 : 0,
    })
  }
  if (dataType === 'output' || dataType === 'both') {
    datasets.push({
      label: 'Mb/s Out',
      data: mbOutData,
      backgroundColor: 'rgba(255, 99, 132, 0.6)',
      borderColor: 'rgba(255, 99, 132, 1)',
      fill: chartType === 'line',
      tension: chartType === 'line' ? 0.3 : 0,
    })
  }

  const chartData = {
    labels,
    datasets,
  }

  const displayName = label || device

  const chartOptions = {
    responsive: true,
    animation: { duration: 0 },
    scales: {
      x: { display: true },
      y: { display: true, beginAtZero: true },
    },
    plugins: {
      legend: { position: 'top' as const },
      title: { display: true, text: `Live Data for ${displayName}` },
    },
  }

  const [showModal, setShowModal] = useState(false)

  const chartContent = (
    <>
      {chartType === 'line' ? (
        <Line data={chartData} options={chartOptions} />
      ) : (
        <Bar data={chartData} options={chartOptions} />
      )}
    </>
  )

  if (isModal) {
    return chartContent
  }

  return (
    <>
      <div 
        className={`bg-white p-4 border rounded shadow cursor-pointer hover:shadow-lg transition-shadow ${className}`}
        onClick={() => setShowModal(true)}
      >
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{displayName} Throughput</h2>
            <div className="text-sm text-gray-600">
              Status: {connectionStatus} {lastError && `(${lastError})`}
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={dataType}
              onChange={(e) => setDataType(e.target.value as 'input' | 'output' | 'both')}
              className="border rounded p-1 text-sm text-gray-900"
            >
              <option value="both">Both</option>
              <option value="input">Input Only</option>
              <option value="output">Output Only</option>
            </select>
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value as 'line' | 'bar')}
              className="border rounded p-1 text-sm text-gray-900"
            >
              <option value="line">Line</option>
              <option value="bar">Bar</option>
            </select>
          </div>
        </div>

        {chartContent}

        <div className="text-sm mt-2 text-gray-800">
          <p>Last {maxDataPoints} samples in Mb/s</p>
          <p>Current data points: {dataPoints.length}</p>
        </div>
      </div>

      <Modal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        title={`${displayName} Throughput`}
      >
        <DeviceChart
          device={device}
          label={label}
          isModal={true}
          className="h-full"
        />
      </Modal>
    </>
  )
}

