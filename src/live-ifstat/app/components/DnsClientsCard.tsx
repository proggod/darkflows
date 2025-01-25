'use client';

import { useEffect, useState } from 'react';
import RefreshIcon from '@mui/icons-material/Refresh';

interface DnsClient {
  ip: string;
  name: string;
  status: 'static' | 'reserved' | 'dynamic';
  mac?: string;
}

type SortField = 'ip' | 'name' | 'status';
type SortDirection = 'asc' | 'desc';

export function DnsClientsCard() {
  const [clients, setClients] = useState<DnsClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editedNames, setEditedNames] = useState<{[key: string]: string}>({});
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [savingHostnames, setSavingHostnames] = useState<{[key: string]: boolean}>({});
  const [processingClients, setProcessingClients] = useState<{[key: string]: boolean}>({});

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

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>, client: DnsClient) => {
    console.log('Key pressed:', e.key);
    console.log('Client status:', client.status);
    console.log('Client MAC:', client.mac);
    
    if (e.key === 'Enter') {
      e.preventDefault(); // Prevent default Enter behavior
      
      if (!client.mac) {
        console.log('Cannot save: No MAC address');
        return;
      }

      try {
        setSavingHostnames(prev => ({ ...prev, [client.ip]: true }));
        
        // If client is dynamic, reserve it first
        if (client.status === 'dynamic') {
          console.log('Reserving dynamic client first...');
          const reserveResponse = await fetch('/api/reservations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              'ip-address': client.ip,
              'hw-address': client.mac,
              'hostname': editedNames[client.ip] || client.name
            })
          });

          if (!reserveResponse.ok) {
            const errorText = await reserveResponse.text();
            console.error('Failed to reserve client:', errorText);
            setError('Failed to reserve client');
            return;
          }
          console.log('Successfully reserved client');
        } else if (client.status !== 'reserved') {
          console.log('Cannot save: Client not reserved and not dynamic');
          return;
        }

        // Now update the hostname if needed
        if (client.status === 'reserved') {
          const payload = {
            'ip-address': client.ip,
            'hw-address': client.mac,
            'hostname': editedNames[client.ip] || client.name
          };
          console.log('Sending payload:', payload);
          
          const response = await fetch('/api/reservations', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            console.log('Successfully saved hostname');
          } else {
            const errorText = await response.text();
            console.error('Failed to save hostname:', errorText);
            setError('Failed to update hostname');
          }
        }

        // Refresh the client list
        fetchClients();
      } catch (error) {
        console.error('Error updating hostname:', error);
        setError('Error updating hostname');
      } finally {
        setSavingHostnames(prev => ({ ...prev, [client.ip]: false }));
      }
    }
  };

  const handleReserve = async (client: DnsClient) => {
    if (!client.mac) {
      setError('Cannot reserve IP without MAC address');
      return;
    }

    try {
      setProcessingClients(prev => ({ ...prev, [client.ip]: true }));
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
    } finally {
      setProcessingClients(prev => ({ ...prev, [client.ip]: false }));
    }
  };

  const handleRemoveReservation = async (client: DnsClient) => {
    if (!client.mac) {
      setError('Cannot remove reservation without MAC address');
      return;
    }

    try {
      setProcessingClients(prev => ({ ...prev, [client.ip]: true }));
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
    } finally {
      setProcessingClients(prev => ({ ...prev, [client.ip]: false }));
    }
  };

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortArrow = ({ field }: { field: SortField }) => {
    if (field !== sortField) return null;
    return (
      <span className="ml-1 text-gray-400">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

  const sortedClients = [...clients].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case 'ip':
        // Split IP into octets and compare numerically
        const aOctets = a.ip.split('.').map(Number);
        const bOctets = b.ip.split('.').map(Number);
        for (let i = 0; i < 4; i++) {
          if (aOctets[i] !== bOctets[i]) {
            comparison = aOctets[i] - bOctets[i];
            break;
          }
        }
        break;
      case 'name':
        const nameA = editedNames[a.ip] || a.name;
        const nameB = editedNames[b.ip] || b.name;
        comparison = nameA.localeCompare(nameB);
        break;
      case 'status':
        comparison = a.status.localeCompare(b.status);
        break;
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  useEffect(() => {
    fetchClients();
  }, []);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 h-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">DNS Clients</h3>
        <button
          onClick={fetchClients}
          className="h-6 px-2 py-0.5 bg-blue-500 dark:bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors flex items-center gap-1"
        >
          <RefreshIcon className="!w-3 !h-3" />
          Refresh
        </button>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded mb-2 text-xs">
          {error}
        </div>
      )}

      <div className="overflow-auto flex-grow -mx-3">
        {loading ? (
          <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">Loading DNS clients...</div>
        ) : clients.length === 0 ? (
          <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">No DNS clients found</div>
        ) : (
          <table className="w-full h-full">
            <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
              <tr className="bg-gray-50 dark:bg-gray-700">
                <th 
                  className="px-1 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-[80px] cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => handleSort('ip')}
                >
                  IP<SortArrow field="ip" />
                </th>
                <th 
                  className="px-1 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => handleSort('name')}
                >
                  Name<SortArrow field="name" />
                </th>
                <th 
                  className="px-1 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-[80px] cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                  onClick={() => handleSort('status')}
                >
                  Status<SortArrow field="status" />
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800">
              {sortedClients.map((client, index) => (
                <tr 
                  key={client.ip} 
                  className={`hover:bg-gray-100 dark:hover:bg-gray-700 ${
                    index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-blue-50 dark:bg-blue-900/20'
                  }`}
                >
                  <td className="px-1 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3 tabular-nums">
                    {client.ip}
                  </td>
                  <td className="px-1 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3">
                    <input
                      type="text"
                      value={editedNames.hasOwnProperty(client.ip) ? editedNames[client.ip] : client.name}
                      onChange={(e) => handleNameChange(client.ip, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, client)}
                      disabled={client.status === 'static' || savingHostnames[client.ip]}
                      className={`w-full bg-transparent border-none p-0 focus:ring-0 text-xs disabled:text-gray-500 ${
                        savingHostnames[client.ip] ? 'opacity-50 cursor-not-allowed' : ''
                      }`}
                    />
                  </td>
                  <td className="px-1 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3">
                    {client.status === 'static' ? (
                      'STATIC'
                    ) : client.status === 'reserved' ? (
                      <button
                        onClick={() => handleRemoveReservation(client)}
                        disabled={processingClients[client.ip]}
                        className={`h-6 px-2 py-0.5 bg-red-500 dark:bg-red-600 text-white rounded text-xs font-medium hover:bg-red-600 dark:hover:bg-red-700 focus:outline-none focus:ring-1 focus:ring-red-500 dark:focus:ring-red-400 transition-colors flex items-center gap-1 w-[72px] justify-center ${
                          processingClients[client.ip] ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {processingClients[client.ip] ? 'SAVING...' : 'REMOVE'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReserve(client)}
                        disabled={processingClients[client.ip]}
                        className={`h-6 px-2 py-0.5 bg-blue-500 dark:bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors flex items-center gap-1 w-[72px] justify-center ${
                          processingClients[client.ip] ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {processingClients[client.ip] ? 'SAVING...' : 'RESERVE'}
                      </button>
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