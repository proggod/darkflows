'use client'

import { useState, useEffect, forwardRef, useImperativeHandle, useMemo, useCallback } from 'react'
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

const WeatherWidget = forwardRef((props, ref) => {
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
    localStorage.setItem('selectedMetric', metric)
  }

  const handleTempUnitChange = (unit: TempUnit) => {
    setTempUnit(unit)
    localStorage.setItem('tempUnit', unit)
  }

  const formatTemp = useCallback((celsius: number) => {
    return tempUnit === 'F' ? Math.round(celsiusToFahrenheit(celsius)) : Math.round(celsius)
  }, [tempUnit])

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

  const fetchWeather = useCallback(async () => {
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
      throw err
    }
  }, [location])

  // Expose fetchWeather method to parent component
  useImperativeHandle(ref, () => ({
    fetchWeather
  }))

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

  const getMetricData = useCallback(() => {
    if (!weatherData) return [];
    
    const currentHour = new Date().getHours();
    const startIndex = currentHour;
    const endIndex = startIndex + 8;

    const data = (() => {
      switch (selectedMetric) {
        case 'temperature':
          return weatherData.hourly.temperature_2m
            .slice(startIndex, endIndex)
            .map((temp, i) => ({
              time: new Date(weatherData.hourly.time[startIndex + i])
                .toLocaleTimeString('en-US', { hour: 'numeric' }),
              value: formatTemp(temp)
            }));
        case 'precipitation':
          return weatherData.hourly.precipitation
            .slice(startIndex, endIndex)
            .map((precip, i) => ({
              time: new Date(weatherData.hourly.time[startIndex + i])
                .toLocaleTimeString('en-US', { hour: 'numeric' }),
              value: Math.round(precip)
            }));
        case 'wind':
          return weatherData.hourly.wind_speed_10m
            .slice(startIndex, endIndex)
            .map((wind, i) => ({
              time: new Date(weatherData.hourly.time[startIndex + i])
                .toLocaleTimeString('en-US', { hour: 'numeric' }),
              value: Math.round(wind)
            }));
      }
    })();

    return data;
  }, [weatherData, selectedMetric, formatTemp]);

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

  // Update chartData dependencies
  const chartData = useMemo(() => {
    if (!weatherData) return null;
    return getMetricData();
  }, [weatherData, getMetricData]);

 
  useEffect(() => {
    if (location) {
      fetchWeather();
    }
  }, [location, fetchWeather]);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">Loading weather data...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="text-red-600 dark:text-red-400">{error}</div>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
        >
          Retry
        </button>
      </div>
    )
  }

  if (!weatherData || !location) {
    return (
      <div className="p-6">
        <div className="text-yellow-600 dark:text-yellow-400">Waiting for location data...</div>
      </div>
    )
  }

  const { current_weather } = weatherData

  return (
    <div className="flex flex-col h-full">
      {/* Location and Update */}
      <div className="flex justify-between items-center mb-2 px-3">
        <span className="text-label">
          {location.cityName} ({weatherData.timezone})
        </span>
        <div className="flex gap-2">
          {showZipInput ? (
            <form onSubmit={handleZipSubmit} className="flex gap-2">
              <input
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                placeholder="Enter ZIP code"
                className="input w-24"
                maxLength={5}
              />
              <button 
                type="submit" 
                className="btn btn-blue"
              >
                Update
              </button>
            </form>
          ) : (
            <button 
              onClick={() => setShowZipInput(true)} 
              className="btn btn-blue"
            >
              Change ZIP Code
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="h-full flex flex-col">
          {/* Current Weather Header */}
          <div className="flex items-start justify-between p-3">
            <div className="flex items-center gap-2">
              {getWeatherIcon(current_weather.weathercode)}
              <span className="text-4xl font-light text-gray-900 dark:text-gray-100">
                {formatTemp(current_weather.temperature)}
              </span>
              <div className="text-muted mt-1">
                <span className="flex gap-2">
                  <button 
                    onClick={() => handleTempUnitChange('F')}
                    className={`btn-icon ${tempUnit === 'F' ? 'btn-icon-blue' : 'text-muted'}`}
                  >
                    °F
                  </button>
                  |
                  <button 
                    onClick={() => handleTempUnitChange('C')}
                    className={`btn-icon ${tempUnit === 'C' ? 'btn-icon-blue' : 'text-muted'}`}
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
              <div className="text-muted">{getCurrentDateTime(weatherData.timezone)}</div>
              <div className="text-muted">{getWeatherDescription(current_weather.weathercode)}</div>
            </div>
          </div>

          {/* Metric Selector */}
          <div className="flex gap-3 px-3 border-b border-gray-700">
            <button
              onClick={() => handleMetricChange('temperature')}
              className={`btn ${
                selectedMetric === 'temperature' 
                  ? 'btn-blue' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              Temperature
            </button>
            <button
              onClick={() => handleMetricChange('precipitation')}
              className={`btn ${
                selectedMetric === 'precipitation' 
                  ? 'btn-blue' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              Precipitation
            </button>
            <button
              onClick={() => handleMetricChange('wind')}
              className={`btn ${
                selectedMetric === 'wind' 
                  ? 'btn-blue' 
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              Wind
            </button>
          </div>

          {/* Chart */}
          {chartData && (
            <div className="flex-grow px-3 py-2 h-[200px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart 
                  data={chartData}
                  margin={{ top: 10, right: 10, left: 0, bottom: 10 }}
                >
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
                    strokeWidth={2}
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Daily Forecast */}
          <div className="grid grid-cols-7 gap-1 text-center px-3 pb-2 mx-auto max-w-3xl w-full">
            {weatherData.daily.weathercode.slice(0, 7).map((code, index) => (
              <div key={index} className="flex flex-col items-center">
                <div className="text-muted">{getDayName(index, weatherData.timezone)}</div>
                <div className="my-0.5">{getWeatherIcon(code)}</div>
                <div className="text-small">
                  {formatTemp(weatherData.daily.temperature_2m_max[index])}°{' '}
                  <span className="text-muted">
                    {formatTemp(weatherData.daily.temperature_2m_min[index])}°
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
})

WeatherWidget.displayName = 'WeatherWidget'

export default WeatherWidget 