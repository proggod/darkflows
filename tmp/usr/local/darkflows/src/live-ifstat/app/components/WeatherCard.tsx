'use client'

import { WeatherWidget } from './WeatherWidget'

export default function WeatherCard() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 h-[490px] flex flex-col">      
      <div className="flex flex-col h-full">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2 px-1">Weather</h3>
        
        <div className="flex-1 overflow-auto">
          <WeatherWidget />
        </div>
      </div>
    </div>
  )
} 