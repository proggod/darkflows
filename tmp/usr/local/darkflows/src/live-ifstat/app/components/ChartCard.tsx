'use client'
import { MoreVertical } from 'lucide-react';
import { LineChart, Line, BarChart, Bar, YAxis, ResponsiveContainer } from 'recharts';

interface ChartCardProps {
  title: string;
  subtitle: string;
  chartType: 'line' | 'bar';
  data: { [key: string]: number }[];
  dataKey: string;
  color: string;
  yAxis?: {
    domain: [number, number];
    ticks: number[];
  };
  statsComponent?: React.ReactNode;
}

const ChartCard = ({ 
  title, 
  subtitle, 
  chartType, 
  data, 
  dataKey, 
  color,
  yAxis,
  statsComponent 
}: ChartCardProps) => {
  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 shadow-sm transition-colors duration-200 h-card">
      <div className="flex flex-col h-full">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">{title}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
          </div>
          <MoreVertical className="w-3 h-3 text-gray-500 dark:text-gray-400" />
        </div>

        <div className="flex-1">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'bar' ? (
              <BarChart data={data} margin={{ left: 0 }}>
                <YAxis
                  domain={yAxis?.domain ?? [0, 100]}
                  ticks={yAxis?.ticks ?? [0, 25, 50, 75, 100]}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value) => `${value}%`}
                  className="text-gray-500 dark:text-gray-400"
                />
                <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <LineChart data={data} margin={{ left: 0 }}>
                <YAxis
                  key={`yaxis-${title}`}
                  domain={yAxis?.domain ?? [0, 100]}
                  ticks={yAxis?.ticks ?? [0, 25, 50, 75, 100]}
                  tick={{ fontSize: 10 }}
                  className="text-gray-500 dark:text-gray-400"
                  tickFormatter={(value, index) => `${title}-${value}-${index}`}
                />
                <Line
                  key={`line-${title}`}
                  type="monotone"
                  dataKey={dataKey}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>

        {statsComponent && (
          <div className="flex justify-between text-xs mt-1 px-1">
            {statsComponent}
          </div>
        )}
      </div>
    </div>
  );
};

export default ChartCard;