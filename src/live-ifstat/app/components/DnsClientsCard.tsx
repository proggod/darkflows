'use client';

import { useEffect, useState } from 'react';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useRefresh } from '../contexts/RefreshContext';

interface DnsClient {
  ip: string;
  name: string;
  mac: string | undefined;
  lastSeen: number;
  isReserved: boolean;
  status: 'static' | 'reserved' | 'dynamic';
}

interface ReservationData {
  'ip-address': string;
  'hw-address': string;
}

type SortField = 'ip' | 'name' | 'status';
type SortDirection = 'asc' | 'desc';

export function DnsClientsCard() {
  const [clients, setClients] = useState<DnsClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editedNames, setEditedNames] = useState<{[key: string]: string}>({});
  const [editingHostname, setEditingHostname] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [savingHostnames, setSavingHostnames] = useState<{[key: string]: boolean}>({});
  const [processingClients, setProcessingClients] = useState<{[key: string]: boolean}>({});
  const [isSyncing, setIsSyncing] = useState(false);
  const { triggerRefresh, registerRefreshCallback } = useRefresh();

  const fetchClients = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch both DNS clients and reservations in parallel, like LeasesCard does
      const [clientsData, reservationsData] = await Promise.all([
        fetch('/api/dns-clients', {
          headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
          }
        }).then(res => {
          if (!res.ok) {
            throw new Error(`HTTP error! status: ${res.status}`);
          }
          return res.json();
        }),
        fetch('/api/reservations').then(res => res.json())
      ]);

      if (Array.isArray(clientsData)) {
        // Mark clients as reserved if they match a reservation by IP or MAC
        const formattedClients = clientsData.map((client: DnsClient) => {
          // Check if this client has a matching reservation
          const isReserved = reservationsData.some((r: ReservationData) => 
            r['ip-address'] === client.ip || 
            (client.mac && client.mac !== 'N/A' && r['hw-address'].toLowerCase() === client.mac.toLowerCase())
          );
          
          return {
            ip: client.ip,
            name: client.name || client.ip,
            mac: client.mac !== 'N/A' ? client.mac : undefined,
            lastSeen: client.lastSeen,
            isReserved: isReserved,
            status: isReserved ? 'reserved' as const : (client.status === 'static' ? 'static' as const : 'dynamic' as const)
          };
        });

        setClients(formattedClients);
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

  const startHostnameEdit = (ip: string, currentHostname: string) => {
    setEditingHostname(ip);
    setEditedNames(prev => ({
      ...prev,
      [ip]: currentHostname || ''
    }));
  };

  const handleDnsUpdate = async (client: DnsClient, newName: string) => {
    try {
      setSavingHostnames(prev => ({ ...prev, [client.ip]: true }));
      
      const response = await fetch('/api/dns-hosts', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: client.ip,
          oldHostname: client.name,
          newHostname: newName,
          mac: client.mac
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Failed to update hostname:', errorText);
        setError('Failed to update hostname');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error updating hostname:', error);
      setError('Error updating hostname');
      return false;
    } finally {
      setSavingHostnames(prev => ({ ...prev, [client.ip]: false }));
    }
  };

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>, client: DnsClient) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const editedName = editedNames[client.ip];
      if (!editedName || editedName === client.name) return;

      try {
        setSavingHostnames(prev => ({ ...prev, [client.ip]: true }));

        // If client is dynamic, reserve it first
        if (client.status === 'dynamic') {
          if (!client.mac) {
            console.log('Cannot save: No MAC address');
            return;
          }

          const reserveResponse = await fetch('/api/reservations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              'ip-address': client.ip,
              'hw-address': client.mac,
              'hostname': editedName
            })
          });

          if (!reserveResponse.ok) {
            const errorText = await reserveResponse.text();
            console.error('Failed to reserve client:', errorText);
            setError('Failed to reserve client');
            return;
          }
        }

        // Update DNS hostname
        const success = await handleDnsUpdate(client, editedName);
        if (success) {
          await fetchClients();
          triggerRefresh();
          
          // Clear editing state after successful update
          setEditingHostname(null);
          setEditedNames(prev => {
            const newState = { ...prev };
            delete newState[client.ip];
            return newState;
          });
        }
      } catch (error) {
        console.error('Error in handleKeyDown:', error);
        setError('Failed to update hostname');
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
      
      const hostname = editedNames[client.ip] || (client.name !== 'N/A' ? client.name : '');
      
      const reservation = {
        'ip-address': client.ip,
        'hw-address': client.mac,
        'hostname': hostname
      };

 
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reservation)
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Reservation failed:', {
          status: response.status,
          response: errorText
        });
        setError('Failed to create reservation');
        return;
      }

      fetchClients();
      triggerRefresh();
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
      console.log('Removing reservation for:', { ip: client.ip, mac: client.mac });
      
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
        triggerRefresh();
      } else {
        // Handle different error status codes
        let errorMessage = `Failed to remove reservation: ${response.status} ${response.statusText}`;
        
        // Try to parse JSON error response
        let errorDetails = '';
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorDetails = errorData.error;
            if (errorData.details) {
              errorDetails += ` - ${typeof errorData.details === 'string' ? errorData.details : JSON.stringify(errorData.details)}`;
            }
          }
        } catch {
          // If not JSON, try to get text
          try {
            errorDetails = await response.text();
          } catch {
            // If text also fails, continue without details
          }
        }
        
        // Special handling for 404 Not Found
        if (response.status === 404) {
          console.log('Reservation not found, may have been already deleted');
          // Refresh clients list anyway
          fetchClients();
          triggerRefresh();
          return; // Exit without showing error
        }
        
        if (errorDetails) {
          errorMessage += ` - ${errorDetails}`;
        }
        
        console.error('Failed to remove reservation:', {
          status: response.status,
          statusText: response.statusText,
          errorDetails
        });
        setError(errorMessage);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('Error removing reservation:', { error, errorMessage });
      setError(`Error removing reservation: ${errorMessage}`);
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

  const handleSyncDNS = async () => {
    try {
      setIsSyncing(true);
      
      const response = await fetch('/api/reservations', {
        method: 'PUT',
        headers: {
          'Accept': 'text/plain'
        }
      });
      
      const text = await response.text();
 
      if (!response.ok) {
        throw new Error(text || 'Failed to sync DNS entries');
      }

      await fetchClients();
    } catch (error) {
      console.log('Error in handleSyncDNS:', error);
      setError(error instanceof Error ? error.message : 'Failed to sync DNS entries');
    } finally {
      setIsSyncing(false);
    }
  };

  const isProcessing = (ip: string) => {
    return processingClients[ip] || savingHostnames[ip];
  };

  useEffect(() => {
    fetchClients();
    
    const cleanup = registerRefreshCallback(() => {
      return fetchClients();
    });

    return () => {
      cleanup();
    };
  }, [registerRefreshCallback]);

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-label">DNS Clients</h3>
        <div className="flex gap-2">
          <button
            onClick={handleSyncDNS}
            disabled={isSyncing}
            className={`btn ${isSyncing ? 'btn-gray' : 'btn-green'}`}
          >
            {isSyncing ? 'Syncing...' : 'Sync DNS'}
          </button>
          <RefreshIcon 
            onClick={fetchClients}
            className="w-2 h-2 btn-icon btn-icon-blue transform scale-25"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded mb-2 text-small">
          {error}
        </div>
      )}

      <div className="overflow-auto flex-grow -mx-3">
        {loading ? (
          <div className="text-center py-4 text-muted">Loading DNS clients...</div>
        ) : clients.length === 0 ? (
          <div className="text-center py-4 text-muted">No DNS clients found</div>
        ) : (
          <table className="w-full h-full table-container">
            <thead className="sticky top-0 z-10">
              <tr className="table-header">
                <th 
                  className="w-[80px] card-hover"
                  onClick={() => handleSort('ip')}
                >
                  IP<SortArrow field="ip" />
                </th>
                <th 
                  className="w-[80px] card-hover"
                  onClick={() => handleSort('name')}
                >
                  Name<SortArrow field="name" />
                </th>
                <th 
                  className="w-[80px] card-hover text-right pr-3"
                  onClick={() => handleSort('status')}
                >
                  Status<SortArrow field="status" />
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedClients.map((client, index) => (
                <tr 
                  key={client.ip} 
                  className={`card-hover ${
                    index % 2 === 0 ? '' : 'card-alternate'
                  } ${index === sortedClients.length - 1 ? 'last-row' : ''}`}
                >
                  <td className="px-1 whitespace-nowrap text-small leading-3 tabular-nums">
                    {client.ip}
                  </td>
                  <td className="px-1 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3">
                    {editingHostname === client.ip ? (
                      <input
                        type="text"
                        value={editedNames[client.ip] ?? ''}
                        onChange={(e) => handleNameChange(client.ip, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, client)}
                        onBlur={() => setEditingHostname(null)}
                        className={`w-full px-1 py-0 text-xs border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white ${
                          isProcessing(client.ip) ? 'opacity-50' : ''
                        }`}
                        disabled={isProcessing(client.ip)}
                        autoFocus
                        placeholder="N/A"
                      />
                    ) : (
                      <span
                        onClick={() => startHostnameEdit(client.ip, client.name || '')}
                        className="cursor-pointer hover:text-blue-500"
                      >
                        {client.name || 'N/A'}
                      </span>
                    )}
                  </td>
                  <td className="px-1 pr-3 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3 text-right">
                    {client.status === 'static' ? (
                      'STATIC'
                    ) : client.status === 'reserved' ? (
                      <button
                        onClick={() => handleRemoveReservation(client)}
                        disabled={isProcessing(client.ip)}
                        className={`btn btn-red w-[72px] justify-center ${
                          isProcessing(client.ip) ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {isProcessing(client.ip) ? 'SAVING...' : 'REMOVE'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReserve(client)}
                        disabled={isProcessing(client.ip)}
                        className={`btn btn-blue w-[72px] justify-center ${
                          isProcessing(client.ip) ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {isProcessing(client.ip) ? 'SAVING...' : 'RESERVE'}
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