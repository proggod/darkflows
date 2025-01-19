'use client'

import { useState, useEffect } from 'react'
import { Cloud, CloudRain, Sun, CloudSun } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts'
import { useTheme } from '@/contexts/ThemeContext'

type MetricType = 'temperature' | 'precipitation' | 'wind'
type TempUnit = 'F' | 'C'

interface WeatherData {
  current_weather: {
    temperature: number
    weathercode: number
    windspeed: number
    time: string
  }
  hourly: {
    temperature_2m: number[]
    precipitation: number[]
    wind_speed_10m: number[]
    time: string[]
  }
  daily: {
    temperature_2m_max: number[]
    temperature_2m_min: number[]
    weathercode: number[]
    time: string[]
  }
  timezone: string
}

interface Location {
  latitude: string
  longitude: string
  cityName: string
}

export function WeatherWidget() {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [location, setLocation] = useState<Location | null>(null)
  const [showZipInput, setShowZipInput] = useState(false)
  const [zipCode, setZipCode] = useState('')
  const [error, setError] = useState('')
  const [selectedMetric, setSelectedMetric] = useState<MetricType>('temperature')
  const [tempUnit, setTempUnit] = useState<TempUnit>('F')
  const { isDarkMode } = useTheme()

  useEffect(() => {
    // Load preferences from localStorage on client-side
    const savedMetric = localStorage.getItem('selectedMetric') as MetricType
    const savedTempUnit = localStorage.getItem('tempUnit') as TempUnit
    
    if (savedMetric) setSelectedMetric(savedMetric)
    if (savedTempUnit) setTempUnit(savedTempUnit)
  }, [])

  // Save preferences to localStorage
  useEffect(() => {
    localStorage.setItem('selectedMetric', selectedMetric)
  }, [selectedMetric])

  useEffect(() => {
    localStorage.setItem('tempUnit', tempUnit)
  }, [tempUnit])

  const handleMetricChange = (metric: MetricType) => {
    setSelectedMetric(metric)
  }

  const formatTemp = (celsius: number) => {
    return tempUnit === 'F' ? Math.round(celsiusToFahrenheit(celsius)) : Math.round(celsius)
  }

  const getWeatherIcon = (code: number) => {
    switch (code) {
      case 0:
        return <Sun className="w-8 h-8 text-yellow-400" />
      case 1:
      case 2:
        return <CloudSun className="w-8 h-8 text-gray-300" />
      case 3:
        return <Cloud className="w-8 h-8 text-gray-300" />
      default:
        return <CloudRain className="w-8 h-8 text-gray-300" />
    }
  }

  const getWeatherDescription = (code: number): string => {
    switch (code) {
      case 0: return 'Clear sky'
      case 1: return 'Mainly clear'
      case 2: return 'Partly cloudy'
      case 3: return 'Overcast'
      case 45:
      case 48: return 'Foggy'
      case 51:
      case 53:
      case 55: return 'Drizzle'
      case 61:
      case 63:
      case 65: return 'Rain'
      case 71:
      case 73:
      case 75: return 'Snow'
      case 77: return 'Snow grains'
      case 80:
      case 81:
      case 82: return 'Rain showers'
      case 85:
      case 86: return 'Snow showers'
      case 95: return 'Thunderstorm'
      case 96:
      case 99: return 'Thunderstorm with hail'
      default: return 'Unknown'
    }
  }

  const getCurrentDateTime = (timezone: string) => {
    const now = new Date()
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
    return formatter.format(now)
  }

  const getLocationFromZip = async (zip: string) => {
    try {
      const response = await fetch('/api/weather', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ zipCode: zip })
      })
      
      if (!response.ok) throw new Error('Invalid ZIP code')
      const data = await response.json()
      
      localStorage.setItem('weatherLocation', JSON.stringify(data))
      setLocation(data)
      setShowZipInput(false)
      setError('')
    } catch {
      setError('Invalid ZIP code')
    }
  }

  const handleZipSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (zipCode.length === 5) {
      getLocationFromZip(zipCode)
    }
  }

  useEffect(() => {
    const savedLocation = localStorage.getItem('weatherLocation')
    if (savedLocation) {
      try {
        setLocation(JSON.parse(savedLocation))
      } catch {
        getLocationFromZip('21817')
      }
    } else {
      getLocationFromZip('21817')
    }
  }, [])

  useEffect(() => {
    const fetchWeather = async () => {
      if (!location) return
      
      try {
        const params = new URLSearchParams({
          lat: location.latitude,
          lon: location.longitude
        })
        const response = await fetch(`/api/weather?${params}`)
        if (!response.ok) {
          throw new Error('Failed to fetch weather data')
        }
        const data = await response.json()
        setWeatherData(data)
        setLoading(false)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load weather data')
        setLoading(false)
      }
    }

    if (location) {
      fetchWeather()
      const interval = setInterval(fetchWeather, 5 * 60 * 1000)
      return () => clearInterval(interval)
    }
  }, [location])

  const celsiusToFahrenheit = (celsius: number) => {
    return (celsius * 9/5) + 32
  }

  const getDayName = (index: number, timezone: string) => {
    const now = new Date()
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long'
    })
    const todayInTimezone = days.indexOf(formatter.format(now))
    
    const targetDay = (todayInTimezone + index) % 7
    return days[targetDay].slice(0, 3)
  }

  const getMetricData = () => {
    if (!weatherData) return []
    
    const currentHour = new Date().getHours()
    const startIndex = currentHour
    const endIndex = startIndex + 8

    switch (selectedMetric) {
      case 'temperature':
        return weatherData.hourly.temperature_2m
          .slice(startIndex, endIndex)
          .map((temp, i) => ({
            time: new Date(weatherData.hourly.time[startIndex + i]).toLocaleTimeString('en-US', { hour: 'numeric' }),
            value: formatTemp(temp)
          }))
      case 'precipitation':
        return weatherData.hourly.precipitation
          .slice(startIndex, endIndex)
          .map((precip, i) => ({
            time: new Date(weatherData.hourly.time[startIndex + i]).toLocaleTimeString('en-US', { hour: 'numeric' }),
            value: Math.round(precip * 100)
          }))
      case 'wind':
        return weatherData.hourly.wind_speed_10m
          .slice(startIndex, endIndex)
          .map((wind, i) => ({
            time: new Date(weatherData.hourly.time[startIndex + i]).toLocaleTimeString('en-US', { hour: 'numeric' }),
            value: Math.round(wind)
          }))
    }
  }

  const getMetricLabel = () => {
    switch (selectedMetric) {
      case 'temperature':
        return `°${tempUnit}`
      case 'precipitation':
        return '%'
      case 'wind':
        return 'mph'
    }
  }

  if (loading) {
    return (
      <div className="h-full">
        <div className={`h-full ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'} rounded-lg shadow-sm flex items-center justify-center`}>
          <div className="animate-pulse">Loading weather data...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full">
        <div className={`h-full ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'} rounded-lg shadow-sm flex items-center justify-center`}>
          <div>
            <div className={isDarkMode ? 'text-red-400' : 'text-red-600'}>{error}</div>
            <button 
              onClick={() => window.location.reload()} 
              className={`mt-2 ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!weatherData || !location) {
    return null
  }

  const { current_weather } = weatherData
  const chartData = getMetricData()

  return (
    <div className="h-full">
      <div className={`h-full ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'} rounded-lg shadow-sm flex flex-col`}>
        {/* Current Weather Header */}
        <div className="flex items-start justify-between p-3">
          <div className="flex items-center gap-2">
            {getWeatherIcon(current_weather.weathercode)}
            <span className="text-4xl font-light">
              {formatTemp(current_weather.temperature)}
            </span>
            <div className="text-xs text-gray-500 mt-1">
              <span className="flex gap-2">
                <button 
                  onClick={() => setTempUnit('F')}
                  className={`${tempUnit === 'F' ? 'text-blue-500 font-medium' : ''}`}
                >
                  °F
                </button>
                |
                <button 
                  onClick={() => setTempUnit('C')}
                  className={`${tempUnit === 'C' ? 'text-blue-500 font-medium' : ''}`}
                >
                  °C
                </button>
              </span>
              <div className="mt-0.5">
                <div>Precipitation: {weatherData.hourly.precipitation[0]}%</div>
                <div>Humidity: 76%</div>
                <div>Wind: {Math.round(current_weather.windspeed)} mph</div>
              </div>
            </div>
          </div>
          <div className="text-right">
            {showZipInput ? (
              <form onSubmit={handleZipSubmit} className="mb-0.5">
                <input
                  type="text"
                  value={zipCode}
                  onChange={(e) => setZipCode(e.target.value)}
                  placeholder="Enter ZIP code"
                  className={`${isDarkMode ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'} px-2 py-0.5 rounded w-20 text-xs`}
                  maxLength={5}
                />
              </form>
            ) : (
              <button 
                onClick={() => setShowZipInput(true)}
                className="text-xl font-medium hover:text-gray-500 transition-colors"
              >
                {location.cityName}
              </button>
            )}
            <div className="text-xs text-gray-500">{getCurrentDateTime(weatherData.timezone)}</div>
            <div className="text-xs text-gray-500">{getWeatherDescription(current_weather.weathercode)}</div>
          </div>
        </div>

        {/* Metric Selector */}
        <div className="flex gap-3 px-3 border-b border-gray-700">
          <button
            onClick={() => handleMetricChange('temperature')}
            className={`pb-1 px-1 text-xs ${selectedMetric === 'temperature' ? 'border-b-2 border-yellow-500' : ''}`}
          >
            Temperature
          </button>
          <button
            onClick={() => handleMetricChange('precipitation')}
            className={`pb-1 px-1 text-xs ${selectedMetric === 'precipitation' ? 'border-b-2 border-blue-500' : ''}`}
          >
            Precipitation
          </button>
          <button
            onClick={() => handleMetricChange('wind')}
            className={`pb-1 px-1 text-xs ${selectedMetric === 'wind' ? 'border-b-2 border-green-500' : ''}`}
          >
            Wind
          </button>
        </div>

        {/* Chart */}
        <div className="flex-grow px-3 py-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
              <XAxis 
                dataKey="time" 
                stroke={isDarkMode ? '#9CA3AF' : '#4B5563'}
                fontSize={10}
                tickMargin={5}
              />
              <YAxis 
                stroke={isDarkMode ? '#9CA3AF' : '#4B5563'}
                fontSize={10}
                tickFormatter={(value) => `${value}${getMetricLabel()}`}
                width={35}
              />
              <Line 
                type="monotone" 
                dataKey="value" 
                stroke={
                  selectedMetric === 'temperature' ? '#F59E0B' :
                  selectedMetric === 'precipitation' ? '#3B82F6' :
                  '#10B981'
                }
                strokeWidth={1.5}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Daily Forecast */}
        <div className="grid grid-cols-7 gap-1 text-center px-3 pb-2 mx-auto max-w-3xl w-full">
          {weatherData.daily.weathercode.slice(0, 7).map((code, index) => (
            <div key={index} className="flex flex-col items-center">
              <div className="text-xs text-gray-500">{getDayName(index, weatherData.timezone)}</div>
              <div className="my-0.5">{getWeatherIcon(code)}</div>
              <div className="text-xs">
                {formatTemp(weatherData.daily.temperature_2m_max[index])}°{' '}
                <span className="text-gray-500">
                  {formatTemp(weatherData.daily.temperature_2m_min[index])}°
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
} 