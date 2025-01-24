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

export default function BandwidthUsage() {
  const [bandwidthData, setBandwidthData] = useState<{ [ip: string]: BandwidthStats }>({});
  const [hostnames, setHostnames] = useState<{ [ip: string]: string }>({});
  const [error, setError] = useState<string | null>(null);

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

  const sortedIPs = Object.entries(bandwidthData)
    .sort(([, a], [, b]) => {
      // Parse the bandwidth values to numbers for comparison
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
      
      const aTotal = parseValue(a.last_2s_sent) + parseValue(a.last_2s_received);
      const bTotal = parseValue(b.last_2s_sent) + parseValue(b.last_2s_received);
      return bTotal - aTotal;
    })
    .map(([ip]) => ip);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 h-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Network Bandwidth</h2>
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
              <th className="px-2 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Host</th>
              <th className="px-2 py-0.5 text-right text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-20">2s Down</th>
              <th className="px-2 py-0.5 text-right text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-20">2s Up</th>
              <th className="px-2 py-0.5 text-right text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-20">40s Down</th>
              <th className="px-2 py-0.5 text-right text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-20">40s Up</th>
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