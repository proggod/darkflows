'use client'

import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  TooltipItem,
  Filler
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface IfstatData {
  timestamp: string
  interface: string
  kbIn: number
  kbOut: number
}

const NetworkStats = ({ data, color }: { data: IfstatData[], color: string }) => (
  <>
    <span className="text-gray-600 dark:text-gray-300">
      Incoming: <span style={{ color }}>{data.length > 0 ? (data[data.length - 1].kbIn * 0.008).toFixed(1) : '0.0'} Mb/s</span>
    </span>
    <span className="text-gray-600 dark:text-gray-300">
      Outgoing: <span style={{ color: '#f97316' }}>{data.length > 0 ? (data[data.length - 1].kbOut * 0.008).toFixed(1) : '0.0'} Mb/s</span>
    </span>
  </>
);

const NetworkStatsCard = ({ 
  color,
  label,
  data
}: { 
  color: string;
  label: string;
  data: IfstatData[];
}) => {
  // Only render chart if we have data
  if (!data || data.length === 0) {
    return (
      <div className="h-full bg-gray-50 dark:bg-gray-800 rounded-lg p-3 shadow-sm transition-colors duration-200">
        <div className="flex flex-col h-full">
          <div className="px-1 pb-2">
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">
              {label} Network Throughput
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Waiting for data...
            </p>
          </div>
        </div>
      </div>
    );
  }

  const mbInData = data.map((d) => d.kbIn * 0.008)
  const mbOutData = data.map((d) => d.kbOut * 0.008)
  const labels = data.map((d) => d.timestamp)

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Mb/s In',
        data: mbInData,
        borderColor: color,
        backgroundColor: color + '33',
        tension: 0.3,
        fill: true
      },
      {
        label: 'Mb/s Out',
        data: mbOutData,
        borderColor: '#f97316',
        backgroundColor: '#f97316' + '1A',
        tension: 0.3,
        fill: true
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: false
      },
      tooltip: {
        enabled: true,
        callbacks: {
          title: () => '',
          label: (context: TooltipItem<'line'>) => `${(context.raw as number).toFixed(1)} Mb/s`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        grid: {
          display: true
        }
      },
      x: {
        display: false,
        grid: {
          display: false
        }
      }
    }
  };

  return (
    <div className="h-full bg-gray-50 dark:bg-gray-800 rounded-lg p-3 shadow-sm transition-colors duration-200">
      <div className="flex flex-col h-full">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2 px-1">{label} Network Stats</h3>
        
        <div className="flex-1 overflow-auto">
          <div className="h-full">
            <Line
              data={chartData}
              options={options}
              className="!w-full !h-full"
            />
          </div>
        </div>
        <div className="flex justify-between text-xs mt-1 px-1">
          <NetworkStats
            data={data}
            color={color}
          />
        </div>
      </div>
    </div>
  );
};

export default NetworkStatsCard; 