'use client';

import { useEffect, useState } from 'react';

interface BandwidthStats {
  last_2s_sent: string;
  last_10s_sent: string;
  last_40s_sent: string;
  cumulative_sent: string;
  last_2s_received: string;
  last_10s_received: string;
  last_40s_received: string;
  cumulative_received: string;
  last_updated: number;
}

interface DnsClient {
  ip: string;
  name: string;
  mac: string | null;
  status: 'reserved' | 'dynamic' | 'static';
  lastSeen: number;
}

interface ApiResponse {
  timestamp: number;
  hosts: { [ip: string]: BandwidthStats };
  status: 'active' | 'error';
}

type SortField = 'total' | '2s_down' | '2s_up' | '40s_down' | '40s_up' | 'host';
type SortDirection = 'asc' | 'desc';

export default function BandwidthUsage() {
  const [bandwidthData, setBandwidthData] = useState<{ [ip: string]: BandwidthStats }>({});
  const [hostnames, setHostnames] = useState<{ [ip: string]: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('total');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const fetchData = async () => {
    try {
      const [bandwidthResponse, dnsResponse] = await Promise.all([
        fetch('/api/bandwidth'),
        fetch('/api/dns-clients')
      ]);

      const bandwidthData: ApiResponse = await bandwidthResponse.json();
      const dnsClients: DnsClient[] = await dnsResponse.json();
      
      if (bandwidthData.status === 'active' && Object.keys(bandwidthData.hosts).length > 0) {
        setBandwidthData(bandwidthData.hosts);
        
        // Update hostnames
        const newHostnames: { [ip: string]: string } = {};
        dnsClients.forEach(client => {
          newHostnames[client.ip] = client.name;
        });
        setHostnames(newHostnames);
        setError(null);
      }
    } catch (err) {
      setError('Error fetching data');
      console.error(err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 2000);
    return () => clearInterval(interval);
  }, []);

  const parseValue = (value: string | undefined) => {
    if (!value) return 0;
    const num = parseFloat(value);
    if (isNaN(num)) return 0;
    if (value.includes('Mb')) return num * 1000000;
    if (value.includes('MB')) return num * 1000000;
    if (value.includes('Kb')) return num * 1000;
    if (value.includes('KB')) return num * 1000;
    if (value.includes('b')) return num;
    return 0;
  };

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const sortedIPs = Object.entries(bandwidthData)
    .sort(([ipA, a], [ipB, b]) => {
      let aValue = 0;
      let bValue = 0;

      switch (sortField) {
        case 'host':
          const hostnameA = (hostnames[ipA] || 'Unknown').replace('Unknown ', '').toLowerCase();
          const hostnameB = (hostnames[ipB] || 'Unknown').replace('Unknown ', '').toLowerCase();
          return sortDirection === 'asc' 
            ? hostnameA.localeCompare(hostnameB)
            : hostnameB.localeCompare(hostnameA);
        case '2s_down':
          aValue = parseValue(a.last_2s_received);
          bValue = parseValue(b.last_2s_received);
          break;
        case '2s_up':
          aValue = parseValue(a.last_2s_sent);
          bValue = parseValue(b.last_2s_sent);
          break;
        case '40s_down':
          aValue = parseValue(a.last_40s_received);
          bValue = parseValue(b.last_40s_received);
          break;
        case '40s_up':
          aValue = parseValue(a.last_40s_sent);
          bValue = parseValue(b.last_40s_sent);
          break;
        case 'total':
        default:
          aValue = parseValue(a.last_2s_sent) + parseValue(a.last_2s_received);
          bValue = parseValue(b.last_2s_sent) + parseValue(b.last_2s_received);
      }

      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
    })
    .map(([ip]) => ip);

  const SortArrow = ({ field }: { field: SortField }) => {
    if (field !== sortField) return null;
    return (
      <span className="ml-1 text-gray-400">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 h-full flex flex-col">
      <div className="mb-2">
        <h2 className="text-sm font-medium text-gray-900 dark:text-gray-100">Network Bandwidth</h2>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded mb-2 text-xs">
          {error}
        </div>
      )}

      <div className="overflow-auto flex-grow -mx-3 px-3">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
            <tr>
              <th 
                className="px-2 py-0.5 text-left text-[8px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => handleSort('host')}
              >
                Host<SortArrow field="host" />
              </th>
              <th 
                className="px-2 py-0.5 text-right text-[8px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-20 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => handleSort('2s_down')}
              >
                2s D<SortArrow field="2s_down" />
              </th>
              <th 
                className="px-2 py-0.5 text-right text-[8px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-20 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => handleSort('2s_up')}
              >
                2s U<SortArrow field="2s_up" />
              </th>
              <th 
                className="px-2 py-0.5 text-right text-[8px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-20 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => handleSort('40s_down')}
              >
                40s D<SortArrow field="40s_down" />
              </th>
              <th 
                className="px-2 py-0.5 text-right text-[8px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-20 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => handleSort('40s_up')}
              >
                40s U<SortArrow field="40s_up" />
              </th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800">
            {sortedIPs.map((ip) => (
              <tr key={ip} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-2 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3">
                  <div className="flex flex-col">
                    <span className="font-medium">{(hostnames[ip] || 'Unknown').replace('Unknown ', '')}</span>
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">{ip}</span>
                  </div>
                </td>
                <td className="px-2 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3 text-right tabular-nums">
                  {bandwidthData[ip].last_2s_received}
                </td>
                <td className="px-2 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3 text-right tabular-nums">
                  {bandwidthData[ip].last_2s_sent}
                </td>
                <td className="px-2 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3 text-right tabular-nums">
                  {bandwidthData[ip].last_40s_received}
                </td>
                <td className="px-2 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3 text-right tabular-nums">
                  {bandwidthData[ip].last_40s_sent}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 