import ServerInfo from './ServerInfo'
import StatusBox from './StatusBox'

export default function ServerStatus() {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg">
      <ServerInfo />
      <StatusBox />
    </div>
  )
} 