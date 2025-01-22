'use client';

import { useEffect, useState } from 'react';
import { Button } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

interface DnsClient {
  ip: string;
  name: string;
  status: 'static' | 'reserved' | 'dynamic';
  mac?: string;
}

export function DnsClientsCard() {
  const [clients, setClients] = useState<DnsClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editedNames, setEditedNames] = useState<{[key: string]: string}>({});

  const fetchClients = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dns-clients');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        setClients(data);
        setEditedNames({});
      } else {
        setClients([]);
        setError('Invalid data format received from server');
      }
    } catch (error) {
      console.error('Error fetching DNS clients:', error);
      setError('Failed to load DNS clients');
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  const handleNameChange = (ip: string, newName: string) => {
    setEditedNames(prev => ({
      ...prev,
      [ip]: newName
    }));
  };

  const handleReserve = async (client: DnsClient) => {
    if (!client.mac) {
      setError('Cannot reserve IP without MAC address');
      return;
    }

    try {
      const reservation = {
        'ip-address': client.ip,
        'hw-address': client.mac,
        'hostname': editedNames[client.ip] || client.name !== 'N/A' ? editedNames[client.ip] || client.name : ''
      };

      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reservation)
      });

      if (response.ok) {
        fetchClients();
      } else {
        setError('Failed to create reservation');
      }
    } catch (error) {
      console.error('Error creating reservation:', error);
      setError('Error creating reservation');
    }
  };

  const handleRemoveReservation = async (client: DnsClient) => {
    if (!client.mac) {
      setError('Cannot remove reservation without MAC address');
      return;
    }

    try {
      const response = await fetch('/api/reservations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: client.ip,
          mac: client.mac
        })
      });

      if (response.ok) {
        fetchClients();
      } else {
        setError('Failed to remove reservation');
      }
    } catch (error) {
      console.error('Error removing reservation:', error);
      setError('Error removing reservation');
    }
  };

  useEffect(() => {
    fetchClients();
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 h-[450px] flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">DNS Clients</h2>
        <Button
          variant="outlined"
          size="small"
          onClick={fetchClients}
          className="min-h-0 h-6 text-xs"
          startIcon={<RefreshIcon className="!w-4 !h-4" />}
        >
          Refresh
        </Button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded mb-2 text-xs">
          {error}
        </div>
      )}

      <div className="overflow-auto flex-grow -mx-3 px-3">
        {loading ? (
          <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">Loading DNS clients...</div>
        ) : clients.length === 0 ? (
          <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">No DNS clients found</div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
              <tr className="bg-gray-50 dark:bg-gray-700">
                <th className="px-2 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-[80px]">IP Address</th>
                <th className="px-2 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Name</th>
                <th className="px-2 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-[80px]">Status</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800">
              {clients.map((client) => (
                <tr 
                  key={client.ip} 
                  className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${
                    client.status === 'reserved' ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  }`}
                >
                  <td className="px-2 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3">
                    {client.ip}
                  </td>
                  <td className="px-2 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3">
                    <input
                      type="text"
                      value={editedNames[client.ip] || client.name}
                      onChange={(e) => handleNameChange(client.ip, e.target.value)}
                      className="w-full bg-transparent border-none p-0 focus:ring-0 text-xs"
                    />
                  </td>
                  <td className="px-2 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3">
                    {client.status === 'static' ? (
                      'STATIC'
                    ) : client.status === 'reserved' ? (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => handleRemoveReservation(client)}
                        className="pb-0 min-h-0 h-4 text-[10px] w-[72px] leading-none"
                        color="error"
                      >
                        REMOVE
                      </Button>
                    ) : (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => handleReserve(client)}
                        className="min-h-0 h-3 text-[10px] w-[72px] leading-none"
                      >
                        RESERVE
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}