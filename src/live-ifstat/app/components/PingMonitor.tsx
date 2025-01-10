import PingChart from './PingChart'
import PingStats from './PingStats'

export default function PingMonitor() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <PingChart />
      <PingStats />
    </div>
  )
} 