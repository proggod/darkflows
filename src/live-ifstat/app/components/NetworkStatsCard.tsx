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
import { RefreshCw } from 'lucide-react'

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
    <span className="text-small">
      Incoming: <span style={{ color }}>{data.length > 0 ? (data[data.length - 1].kbIn * 0.008).toFixed(1) : '0.0'} Mb/s</span>
    </span>
    <span className="text-small">
      Outgoing: <span style={{ color: '#f97316' }}>{data.length > 0 ? (data[data.length - 1].kbOut * 0.008).toFixed(1) : '0.0'} Mb/s</span>
    </span>
  </>
);

const NetworkStatsCard = ({ 
  color,
  label,
  data,
  fetchStats,
  error,
  loading
}: { 
  color: string;
  label: string;
  data: IfstatData[];
  fetchStats: () => void;
  error: string | null;
  loading: boolean;
}) => {
  // Only render chart if we have data
  if (!data || data.length === 0) {
    return (
      <div className="p-3 h-full flex flex-col">
        <div className="flex flex-col h-full">
          <div className="px-1 pb-2">
            <h3 className="text-label">
              {label} Network Throughput
            </h3>
            <p className="text-muted">
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
    <div className="p-3 h-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <div className="flex items-center gap-2">
          <h3 className="text-label">Bandwidth Stats for {label}</h3>
          <NetworkStats
            data={data}
            color={color}
          />
        </div>
        <RefreshCw 
          onClick={fetchStats}
          className="w-2 h-2 btn-icon btn-icon-blue transform scale-25"
        />
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded mb-2 text-small">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-4 text-muted">Loading network stats...</div>
      ) : (
        <div className="flex-1 overflow-auto">
          <div className="h-full">
            <Line
              data={chartData}
              options={options}
              className="!w-full !h-full"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkStatsCard; 