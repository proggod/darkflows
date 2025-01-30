'use client'

import WeatherWidget from './WeatherWidget'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useState, useRef } from 'react'

export default function WeatherCard() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const weatherWidgetRef = useRef<{ fetchWeather: () => Promise<void> }>(null)

  const fetchWeather = async () => {
    try {
      setLoading(true)
      setError(null)
      // Call fetchWeather on the WeatherWidget instance
      await weatherWidgetRef.current?.fetchWeather()
    } catch {
      setError('Failed to fetch weather data')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-lg shadow-sm p-3 h-full flex flex-col">
      <div className="flex flex-col h-full">
        <div className="flex justify-between items-center mb-2">
          <h3 className="text-label">Weather</h3>
          <RefreshIcon 
            onClick={fetchWeather}
            className="w-2 h-2 btn-icon btn-icon-blue transform scale-25"
          />
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded mb-2 text-small">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-4 text-muted">Loading weather data...</div>
        ) : (
          <div className="flex-1 overflow-auto">
            <WeatherWidget ref={weatherWidgetRef} />
          </div>
        )}
      </div>
    </div>
  )
} 