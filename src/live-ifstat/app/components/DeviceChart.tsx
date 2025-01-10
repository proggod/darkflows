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
import { useTheme } from '../contexts/ThemeContext'

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

export default function DeviceChart({ device, label, className = '', isModal = false }: DeviceChartProps) {
  const chartTypeKey = `chartType_${device}`
  const dataTypeKey = `dataType_${device}`
  const { isDarkMode } = useTheme();
  
  const initialChartType = (typeof window !== 'undefined' && localStorage.getItem(chartTypeKey)) || 'line'
  const initialDataType = (typeof window !== 'undefined' && localStorage.getItem(dataTypeKey)) || 'both'
  
  const [chartType, setChartType] = useState<'line' | 'bar'>(initialChartType as 'line' | 'bar')
  const [dataType, setDataType] = useState<'input' | 'output' | 'both'>(initialDataType as 'input' | 'output' | 'both')
  const [showModal, setShowModal] = useState(false)
  
  const { data, connectionStatus, lastError } = useNetworkData(device)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(chartTypeKey, chartType)
      localStorage.setItem(dataTypeKey, dataType)
    }
  }, [chartType, dataType, chartTypeKey, dataTypeKey])

  const textColor = isDarkMode ? '#e5e7eb' : '#111827'
  const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'

  // Convert KB/s to Mb/s
  const mbInData = data.map((d) => d.kbIn * 0.008)
  const mbOutData = data.map((d) => d.kbOut * 0.008)
  const labels = data.map((d) => d.timestamp)

  const datasets = []
  if (dataType === 'input' || dataType === 'both') {
    datasets.push({
      label: 'Mb/s In',
      data: mbInData,
      backgroundColor: isDarkMode ? 'rgba(54, 162, 235, 0.3)' : 'rgba(54, 162, 235, 0.6)',
      borderColor: isDarkMode ? 'rgba(54, 162, 235, 0.8)' : 'rgba(54, 162, 235, 1)',
      fill: chartType === 'line',
      tension: chartType === 'line' ? 0.3 : 0,
    })
  }
  if (dataType === 'output' || dataType === 'both') {
    datasets.push({
      label: 'Mb/s Out',
      data: mbOutData,
      backgroundColor: isDarkMode ? 'rgba(255, 99, 132, 0.3)' : 'rgba(255, 99, 132, 0.6)',
      borderColor: isDarkMode ? 'rgba(255, 99, 132, 0.8)' : 'rgba(255, 99, 132, 1)',
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
      x: {
        display: true,
        grid: { color: gridColor },
        ticks: { color: textColor }
      },
      y: {
        display: true,
        beginAtZero: true,
        grid: { color: gridColor },
        ticks: { color: textColor }
      },
    },
    plugins: {
      legend: {
        position: 'top' as const,
        labels: { color: textColor }
      },
      title: {
        display: true,
        text: `Live Data for ${displayName}`,
        color: textColor
      },
    },
  }

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

  const latestData = data[data.length - 1] || { kbIn: 0, kbOut: 0 }

  return (
    <>
      <div 
        className={`bg-white dark:bg-gray-800 p-4 rounded-lg shadow-sm cursor-pointer hover:shadow-md transition-shadow ${className}`}
        onClick={() => setShowModal(true)}
      >
        <div className="flex justify-between items-center mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">{displayName} Throughput</h2>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Status: {connectionStatus} {lastError && `(${lastError})`}
            </div>
          </div>
          <div className="flex gap-2">
            <select
              value={dataType}
              onChange={(e) => setDataType(e.target.value as 'input' | 'output' | 'both')}
              className="border rounded p-1 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 dark:border-gray-600"
              onClick={(e) => e.stopPropagation()}
            >
              <option value="both">Both</option>
              <option value="input">Input Only</option>
              <option value="output">Output Only</option>
            </select>
            <select
              value={chartType}
              onChange={(e) => setChartType(e.target.value as 'line' | 'bar')}
              className="border rounded p-1 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-700 dark:border-gray-600"
              onClick={(e) => e.stopPropagation()}
            >
              <option value="line">Line</option>
              <option value="bar">Bar</option>
            </select>
          </div>
        </div>

        {chartContent}

        <div className="text-sm mt-2 text-gray-800 dark:text-gray-300">
          <p>Last {data.length} samples in Mb/s</p>
          <p>Current: ↓ {(latestData.kbIn * 0.008).toFixed(1)} Mb/s ↑ {(latestData.kbOut * 0.008).toFixed(1)} Mb/s</p>
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

