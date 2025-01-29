import React, { useEffect, useState } from 'react';
import { Cloud, CloudRain, Sun, CloudSun } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { useTheme } from '../../contexts/ThemeContext';

interface WeatherData {
  current_weather: {
    temperature: number;
    weathercode: number;
    windspeed: number;
    time: string;
  };
  hourly: {
    temperature_2m: number[];
    precipitation: number[];    wind_speed_10m: number[];
  };
  daily: {
    temperature_2m_max: number[];
    temperature_2m_min: number[];
  };
  timezone: string;
}

interface Location {
  latitude: number;
  longitude: number;
  cityName: string;
  zipCode?: string;
}

interface ZipResponse {
  places: Array<{
    latitude: string;
    longitude: string;
    "place name": string;
    "state abbreviation": string;
  }>;
}

const WeatherWidget = () => {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [location, setLocation] = useState<Location | null>(null);
  const [showZipInput, setShowZipInput] = useState(false);
  const [zipCode, setZipCode] = useState('');
  const [error, setError] = useState('');
  const { isDarkMode } = useTheme();

  const getWeatherIcon = (code: number) => {
    switch (code) {
      case 0:
        return <Sun className="w-8 h-8 text-yellow-400" />;
      case 1:
        return <CloudSun className="w-8 h-8 text-gray-300" />;
      case 2:
        return <Cloud className="w-8 h-8 text-gray-300" />;
      default:
        return <CloudRain className="w-8 h-8 text-gray-300" />;
    }
  };

  const getDayName = (index: number, timezone: string) => {
    const now = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long'
    });
    const todayInTimezone = days.indexOf(formatter.format(now));
    
    const targetDay = (todayInTimezone + index) % 7;
    return days[targetDay].slice(0, 3);
  };

  const celsiusToFahrenheit = (celsius: number) => {
    return (celsius * 9/5) + 32;
  };

  const getLocationFromZip = async (zip: string) => {
    try {
      const response = await fetch(`https://api.zippopotam.us/us/${zip}`);
      if (!response.ok) throw new Error('Invalid ZIP code');
      const data: ZipResponse = await response.json();
      
      const newLocation = {
        latitude: parseFloat(data.places[0].latitude),
        longitude: parseFloat(data.places[0].longitude),
        cityName: `${data.places[0]["place name"]}, ${data.places[0]["state abbreviation"]}`,
        zipCode: zip
      };

      localStorage.setItem('weatherLocation', JSON.stringify(newLocation));
      setLocation(newLocation);
      setShowZipInput(false);
      setError('');
    } catch {
      setError('Invalid ZIP code');
    }
  };

  const handleZipSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (zipCode.length === 5) {
      getLocationFromZip(zipCode);
    }
  };

  const getCurrentDateTime = (timezone: string) => {
    console.log('Getting current date/time for timezone:', timezone);
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'long',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
    
    const formatted = formatter.format(now);
    console.log('Formatted datetime:', formatted);
    return formatted;
  };

  useEffect(() => {
    const savedLocation = localStorage.getItem('weatherLocation');
    if (savedLocation) {
      try {
        setLocation(JSON.parse(savedLocation));
      } catch {
        getLocationFromZip('21817');
      }
    } else {
      getLocationFromZip('21817');
    }
  }, []);

  useEffect(() => {
    const fetchWeather = async () => {
      if (!location) {
        console.log('No location available for weather fetch');
        return;
      }
      console.log('Fetching weather for location:', location);
      
      try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${location.latitude}&longitude=${location.longitude}&hourly=temperature_2m,precipitation,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min,weathercode&current_weather=true&timezone=${encodeURIComponent('auto')}`;
        console.log('Fetching weather from:', url);
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Weather API error: ${response.status}`);
        }
        const data = await response.json();
        console.log('Weather data received with timezone:', data.timezone);
        setWeatherData(data);
        setLoading(false);
      } catch (error) {
        console.error('Error fetching weather data:', error);
        setError('Failed to load weather data');
        setLoading(false);
      }
    };

    if (location) {
      fetchWeather();
    }
  }, [location]);

  if (loading) {
    return (
      <div className={`p-6 ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'} rounded-lg shadow-lg`}>
        <div className="animate-pulse">Loading weather data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`p-6 ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'} rounded-lg shadow-lg`}>
        <div className={isDarkMode ? 'text-red-400' : 'text-red-600'}>{error}</div>
        <button 
          onClick={() => window.location.reload()} 
          className={`mt-2 ${isDarkMode ? 'text-blue-400 hover:text-blue-300' : 'text-blue-600 hover:text-blue-700'}`}
        >
          Retry
        </button>
      </div>
    );
  }

  if (!weatherData || !location) {
    return (
      <div className={`p-6 ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'} rounded-lg shadow-lg`}>
        <div className={isDarkMode ? 'text-yellow-400' : 'text-yellow-600'}>Waiting for location data...</div>
      </div>
    );
  }

  const { current_weather, hourly, daily } = weatherData;

  const hourlyData = hourly.temperature_2m.slice(0, 8).map((temp: number, index: number) => ({
    time: ['1 PM', '4 PM', '7 PM', '10 PM', '1 AM', '4 AM', '7 AM', '10 AM'][index],
    temp: Math.round(celsiusToFahrenheit(temp))
  }));

  return (
    <div className={`p-6 ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'} rounded-lg shadow-lg max-w-3xl mx-auto`}>
      {/* Location and Update */}
      <div className="flex justify-between items-center mb-2">
        <span className={isDarkMode ? 'text-blue-400' : 'text-blue-600'}>
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
                className={`${isDarkMode ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-900'} px-2 py-1 rounded w-24`}
                maxLength={5}
              />
              <button type="submit" className={isDarkMode ? 'text-blue-400' : 'text-blue-600'}>Update</button>
            </form>
          ) : (
            <button onClick={() => setShowZipInput(true)} className={isDarkMode ? 'text-blue-400' : 'text-blue-600'}>
              Change ZIP Code
            </button>
          )}
        </div>
      </div>
      {error && <div className={`${isDarkMode ? 'text-red-400' : 'text-red-600'} text-sm mb-2`}>{error}</div>}

      {/* Current Weather */}
      <div className="flex items-center gap-4 mb-2">
        <div className="flex items-center gap-2">
          {getWeatherIcon(current_weather.weathercode)}
          <span className="text-4xl">{Math.round(celsiusToFahrenheit(current_weather.temperature))}°</span>
          <span className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>F</span>
        </div>
        
        <div className="ml-auto text-right">
          <div className="text-xl">Weather</div>
          <div className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>
            {getCurrentDateTime(weatherData.timezone)}
          </div>
          <div className={isDarkMode ? 'text-gray-400' : 'text-gray-600'}>Cloudy</div>
        </div>
      </div>

      {/* Weather Details */}
      <div className={`flex justify-between px-4 mb-2 text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-600'}`}>
        <div>Precipitation: {hourly.precipitation[0]}%</div>
        <div>Humidity: 57%</div>
        <div>Wind: {Math.round(current_weather.windspeed)} mph</div>
      </div>

      {/* Temperature Graph */}
      <div className="mb-2">
        <div className={`h-48 ${isDarkMode ? 'bg-gray-800' : 'bg-gray-100'} rounded relative p-2`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart 
              data={hourlyData}
              margin={{ top: 10, right: 10, left: 10, bottom: 10 }}
            >
              <XAxis 
                dataKey="time" 
                stroke={isDarkMode ? '#9CA3AF' : '#4B5563'}
                tick={{ fill: isDarkMode ? '#9CA3AF' : '#4B5563', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                interval={0}
                textAnchor="middle"
                padding={{ left: 30, right: 30 }}
              />
              <YAxis 
                stroke={isDarkMode ? '#9CA3AF' : '#4B5563'}
                tick={{ fill: isDarkMode ? '#9CA3AF' : '#4B5563', fontSize: 12 }}
                domain={['dataMin - 2', 'dataMax + 2']}
                axisLine={false}
                tickLine={false}
              />
              <Line
                type="monotone"
                dataKey="temp"
                stroke={isDarkMode ? '#60A5FA' : '#2563EB'}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 7-Day Forecast */}
      <div className="grid grid-cols-7 gap-2">
        {daily.temperature_2m_max.slice(0, 7).map((maxTemp: number, i: number) => (
          <div key={i} className="text-sm flex flex-col items-center">
            <div className="text-gray-400">{getDayName(i, weatherData.timezone)}</div>
            <div className="my-2">
              {getWeatherIcon(i === 0 ? current_weather.weathercode : 0)}
            </div>
            <div>
              <span className="text-white">{Math.round(celsiusToFahrenheit(maxTemp))}°</span>
              <span className="text-gray-400"> {Math.round(celsiusToFahrenheit(daily.temperature_2m_min[i]))}°</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default WeatherWidget;