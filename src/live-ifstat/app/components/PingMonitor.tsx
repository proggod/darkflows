import PingChart from './PingChart'
import PingStats from './PingStats'

export default function PingMonitor() {
  return (
    <div className="bg-white rounded-lg shadow-lg">
      <PingChart />
      <PingStats />
    </div>
  )
} 