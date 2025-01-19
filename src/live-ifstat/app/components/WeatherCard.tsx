'use client'

import { WeatherWidget } from './WeatherWidget'

export default function WeatherCard() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 h-[490px] flex flex-col">      
      <div className="overflow-auto flex-grow -mx-4 -mt-4 -mb-2 px-0 py-0">
        <WeatherWidget />
      </div>
    </div>
  )
} 