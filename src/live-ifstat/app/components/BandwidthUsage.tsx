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

interface ConnectionData {
  connection_id: string;
  source: string;
  destination: string;
  sent: {
    last_2s: string;
    last_10s: string;
    last_40s: string;
    cumulative: string;
  };
  received: {
    last_2s: string;
    last_10s: string;
    last_40s: string;
    cumulative: string;
  };
}

interface DetailedStats {
  target_ip: string;
  connections: ConnectionData[];
  totals: {
    sent: string;
    received: string;
    cumulative: {
      sent: string;
      received: string;
      total: string;
    };
  };
  peak_rates: {
    sent: string;
    received: string;
    total: string;
  };
  hostname: string;
}

type SortField = 'total' | '2s_down' | '2s_up' | '40s_down' | '40s_up' | 'host';
type SortDirection = 'asc' | 'desc';

export default function BandwidthUsage() {
  const [bandwidthData, setBandwidthData] = useState<{ [ip: string]: BandwidthStats }>({});
  const [hostnames, setHostnames] = useState<{ [ip: string]: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sortField, setSortField] = useState<SortField>('total');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [selectedIP, setSelectedIP] = useState<string | null>(null);
  const [detailedStats, setDetailedStats] = useState<DetailedStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [bandwidthResponse, dnsResponse] = await Promise.all([
        fetch('/api/bandwidth'),
        fetch('/api/dns-clients')
      ]);

      if (!bandwidthResponse.ok) {
        throw new Error(`Bandwidth API error: ${bandwidthResponse.status}`);
      }
      if (!dnsResponse.ok) {
        throw new Error(`DNS API error: ${dnsResponse.status}`);
      }

      const bandwidthData: ApiResponse = await bandwidthResponse.json();
      const dnsClients: DnsClient[] = await dnsResponse.json();
      
      if (bandwidthData.status === 'active' && Object.keys(bandwidthData.hosts).length > 0) {
        setBandwidthData(bandwidthData.hosts);
        
        // Update hostnames
        const newHostnames: { [ip: string]: string } = {};
        dnsClients.forEach(client => {
          newHostnames[client.ip] = client.name || client.ip;
        });
        setHostnames(newHostnames);
        setError(null);
      } else if (bandwidthData.status === 'error') {
        throw new Error('Bandwidth service reported an error');
      } else {
        setBandwidthData({});
      }
    } catch (err: unknown) {
      console.error('Error fetching data:', err);
      setError(err instanceof Error ? err.message : 'Error fetching data');
      setBandwidthData({});
      setHostnames({});
    } finally {
      setLoading(false);
    }
  };

  const fetchDetailedStats = async (ip: string) => {
    setIsLoading(true);
    try {
      const encodedIP = encodeURIComponent(ip);
      const response = await fetch(`/api/bandwidth/${encodedIP}`);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (!data || !data.peak_rates) {
        throw new Error('Invalid data format received');
      }
      setDetailedStats(data);
    } catch (err: unknown) {
      console.error('Error fetching detailed stats:', err);
      setError(err instanceof Error ? err.message : 'Error fetching connection details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
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

  if (loading && Object.keys(bandwidthData).length === 0) {
    return (
      <div className="text-gray-600 dark:text-gray-400 p-4">
        Loading bandwidth data...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 dark:text-red-400 p-4">
        Error: {error}
      </div>
    );
  }

  if (Object.keys(bandwidthData).length === 0) {
    return (
      <div className="text-gray-600 dark:text-gray-400 p-4">
        No bandwidth data available
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 h-full flex flex-col">
      <div className="flex flex-col h-full">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2 px-1">Bandwidth Usage</h3>
        
        <div className="flex-1 overflow-auto">
          {error && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded mb-2 text-xs">
              {error}
            </div>
          )}

          <div className="overflow-auto flex-grow">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
                <tr>
                  <th 
                    className="px-1 py-0.5 text-left text-[8px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => handleSort('host')}
                  >
                    Host<SortArrow field="host" />
                  </th>
                  <th 
                    className="px-1 py-0.5 text-right text-[8px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-16 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => handleSort('2s_down')}
                  >
                    2s D<SortArrow field="2s_down" />
                  </th>
                  <th 
                    className="px-1 py-0.5 text-right text-[8px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-16 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => handleSort('2s_up')}
                  >
                    2s U<SortArrow field="2s_up" />
                  </th>
                  <th 
                    className="px-1 py-0.5 text-right text-[8px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-16 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => handleSort('40s_down')}
                  >
                    40s D<SortArrow field="40s_down" />
                  </th>
                  <th 
                    className="px-1 py-0.5 text-right text-[8px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-16 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                    onClick={() => handleSort('40s_up')}
                  >
                    40s U<SortArrow field="40s_up" />
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800">
                {sortedIPs.map((ip) => (
                  <tr key={ip} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                    <td className="px-1 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3">
                      <div className="flex flex-col">
                        <span 
                          className="font-medium cursor-pointer hover:text-blue-500"
                          onClick={() => {
                            setSelectedIP(ip);
                            fetchDetailedStats(ip);
                          }}
                          title={(hostnames[ip] || 'Unknown').replace('Unknown ', '')}
                        >
                          {((hostnames[ip] || 'Unknown').replace('Unknown ', '')).length > 16 
                            ? ((hostnames[ip] || 'Unknown').replace('Unknown ', '')).slice(0, 16) + '...'
                            : (hostnames[ip] || 'Unknown').replace('Unknown ', '')}
                        </span>
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">{ip}</span>
                      </div>
                    </td>
                    <td className="px-1 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3 text-right tabular-nums">
                      {bandwidthData[ip].last_2s_received}
                    </td>
                    <td className="px-1 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3 text-right tabular-nums">
                      {bandwidthData[ip].last_2s_sent}
                    </td>
                    <td className="px-1 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3 text-right tabular-nums">
                      {bandwidthData[ip].last_40s_received}
                    </td>
                    <td className="px-1 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3 text-right tabular-nums">
                      {bandwidthData[ip].last_40s_sent}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {selectedIP && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 max-w-2xl w-full max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium">
                Connection Details for {detailedStats?.hostname || hostnames[selectedIP] || selectedIP}
              </h3>
              <button 
                onClick={() => {
                  setSelectedIP(null);
                  setDetailedStats(null);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            {isLoading ? (
              <div className="flex justify-center items-center p-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-white"></div>
              </div>
            ) : detailedStats ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium mb-2">Peak Rates</h4>
                    <div className="text-sm">
                      <div>Sent: {detailedStats.peak_rates?.sent || '0B'}</div>
                      <div>Received: {detailedStats.peak_rates?.received || '0B'}</div>
                      <div>Total: {detailedStats.peak_rates?.total || '0B'}</div>
                    </div>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">Cumulative Totals</h4>
                    <div className="text-sm">
                      <div>Sent: {detailedStats.totals?.cumulative?.sent || '0B'}</div>
                      <div>Received: {detailedStats.totals?.cumulative?.received || '0B'}</div>
                      <div>Total: {detailedStats.totals?.cumulative?.total || '0B'}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="font-medium mb-2">Active Connections</h4>
                  <div className="space-y-2">
                    {detailedStats.connections?.map((conn) => (
                      <div key={conn.connection_id} className="border dark:border-gray-700 rounded p-2">
                        <div className="text-sm font-medium">Connection {conn.connection_id}</div>
                        <div className="text-xs">Source: {conn.source}</div>
                        <div className="text-xs">Destination: {conn.destination}</div>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <div className="text-xs">
                            <div>Sent (2s): {conn.sent?.last_2s || '0B'}</div>
                            <div>Sent (10s): {conn.sent?.last_10s || '0B'}</div>
                            <div>Sent (40s): {conn.sent?.last_40s || '0B'}</div>
                          </div>
                          <div className="text-xs">
                            <div>Received (2s): {conn.received?.last_2s || '0B'}</div>
                            <div>Received (10s): {conn.received?.last_10s || '0B'}</div>
                            <div>Received (40s): {conn.received?.last_40s || '0B'}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center p-4 text-gray-500">
                No data available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 