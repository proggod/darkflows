'use client'

import { useState, useEffect } from 'react'
import RefreshIcon from '@mui/icons-material/Refresh';
import { useRefresh } from '../contexts/RefreshContext'

interface Lease {
  ip_address: string
  mac_address: string
  device_name: string
  expire: Date | null
  state_name: string
  is_reserved?: boolean
}

interface ReservationData {
  'ip-address': string
  'hw-address': string
}

type SortField = 'ip_address' | 'mac_address' | 'device_name' | 'status';
type SortDirection = 'asc' | 'desc';

export default function LeasesCard() {
  const [leases, setLeases] = useState<Lease[]>([])
  const [error, setError] = useState<string>('')
  const [sortField, setSortField] = useState<SortField>('device_name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [editedNames, setEditedNames] = useState<{[key: string]: string}>({});
  const [editingHostname, setEditingHostname] = useState<string | null>(null);
  const [savingHostnames, setSavingHostnames] = useState<{[key: string]: boolean}>({});
  const { triggerRefresh, registerRefreshCallback } = useRefresh()

  useEffect(() => {
    fetchLeases()
    return registerRefreshCallback(fetchLeases)
  }, [registerRefreshCallback])

  const fetchLeases = async () => {
    try {
      const [leasesData, reservationsData] = await Promise.all([
        fetch('/api/leases').then(res => res.json()),
        fetch('/api/reservations').then(res => res.json())
      ])

      // Ensure leasesData is an array
      const leasesArray = Array.isArray(leasesData) ? leasesData : [];
      
      // Mark leases that are reserved
      const markedLeases = leasesArray.map((lease: Lease) => ({
        ...lease,
        is_reserved: reservationsData.some((r: ReservationData) => 
          r['ip-address'] === lease.ip_address || 
          r['hw-address'].toLowerCase() === lease.mac_address.toLowerCase()
        )
      }))
      setLeases(markedLeases)
    } catch (error) {
      console.error('Error fetching leases:', error)
      setError('Failed to load leases')
    }
  }

  const handleReserve = async (lease: Lease) => {
    try {
      const reservation = {
        'ip-address': lease.ip_address,
        'hw-address': lease.mac_address,
        'hostname': lease.device_name
      }

      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reservation)
      })

      if (response.ok) {
        await fetchLeases()
        triggerRefresh()
      } else {
        setError('Failed to create reservation')
      }
    } catch (error) {
      console.error('Error creating reservation:', error)
      setError('Error creating reservation')
    }
  }

  const handleRemoveReservation = async (lease: Lease) => {
    try {
      const response = await fetch('/api/reservations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: lease.ip_address,
          mac: lease.mac_address
        })
      })

      if (response.ok) {
        await fetchLeases()
        triggerRefresh()
      } else {
        setError('Failed to remove reservation')
      }
    } catch (error) {
      console.error('Error removing reservation:', error)
      setError('Error removing reservation')
    }
  }

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

  const sortedLeases = [...leases].sort((a, b) => {
    let comparison = 0;
    switch (sortField) {
      case 'ip_address':
        // Split IP into octets and compare numerically
        const aOctets = a.ip_address.split('.').map(Number);
        const bOctets = b.ip_address.split('.').map(Number);
        for (let i = 0; i < 4; i++) {
          if (aOctets[i] !== bOctets[i]) {
            comparison = aOctets[i] - bOctets[i];
            break;
          }
        }
        break;
      case 'mac_address':
        comparison = a.mac_address.localeCompare(b.mac_address);
        break;
      case 'device_name':
        const nameA = a.device_name || 'N/A';
        const nameB = b.device_name || 'N/A';
        comparison = nameA.localeCompare(nameB);
        break;
      case 'status':
        const statusA = a.is_reserved ? 'reserved' : 'dynamic';
        const statusB = b.is_reserved ? 'reserved' : 'dynamic';
        comparison = statusA.localeCompare(statusB);
        break;
    }
    return sortDirection === 'asc' ? comparison : -comparison;
  });

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

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>, lease: Lease) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const editedName = editedNames[lease.ip_address];
      if (!editedName || editedName === lease.device_name) return;

      try {
        setSavingHostnames(prev => ({ ...prev, [lease.ip_address]: true }));

        // Update DNS hostname
        const dnsResponse = await fetch('/api/dns-hosts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ip: lease.ip_address,
            oldHostname: lease.device_name,
            newHostname: editedName,
            mac: lease.mac_address
          })
        });

        if (!dnsResponse.ok) {
          const errorText = await dnsResponse.text();
          console.error('Failed to update hostname:', errorText);
          setError('Failed to update hostname');
          return;
        }

        await fetchLeases();
        // Clear editing state after successful update
        setEditingHostname(null);
        setEditedNames(prev => {
          const newState = { ...prev };
          delete newState[lease.ip_address];
          return newState;
        });
      } catch (error) {
        console.error('Error updating hostname:', error);
        setError('Failed to update hostname');
      } finally {
        setSavingHostnames(prev => ({ ...prev, [lease.ip_address]: false }));
      }
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 h-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">Active DHCP Leases</h3>
        <RefreshIcon 
          onClick={fetchLeases}
          className="w-2 h-2 text-blue-500 dark:text-blue-400 cursor-pointer hover:text-blue-600 dark:hover:text-blue-500 transform scale-25"
        />
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded mb-2 text-xs">
          {error}
        </div>
      )}

      <div className="overflow-auto flex-grow -mx-3">
        <table className="w-full h-full">
          <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
            <tr className="bg-gray-50 dark:bg-gray-700">
              <th 
                className="px-1 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 w-[80px]"
                onClick={() => handleSort('ip_address')}
              >
                IP<SortArrow field="ip_address" />
              </th>
              <th 
                className="px-1 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => handleSort('device_name')}
              >
                Name<SortArrow field="device_name" />
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
            {sortedLeases.map((lease, index) => (
              <tr key={lease.ip_address} className={`hover:bg-gray-100 dark:hover:bg-gray-700 ${
                index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-blue-50 dark:bg-blue-900/20'
              }`}>
                <td className="px-1 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3 tabular-nums">
                  {lease.ip_address}
                </td>
                <td className="px-1 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3">
                  {editingHostname === lease.ip_address ? (
                    <input
                      type="text"
                      value={editedNames[lease.ip_address] ?? ''}
                      onChange={(e) => handleNameChange(lease.ip_address, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleKeyDown(e, lease);
                        } else if (e.key === 'Escape') {
                          setEditingHostname(null);
                        }
                      }}
                      onBlur={() => setEditingHostname(null)}
                      className={`w-full px-1 py-0 text-xs border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white ${
                        savingHostnames[lease.ip_address] ? 'opacity-50' : ''
                      }`}
                      disabled={savingHostnames[lease.ip_address]}
                      autoFocus
                      placeholder="N/A"
                    />
                  ) : (
                    <span
                      onClick={() => startHostnameEdit(lease.ip_address, lease.device_name || '')}
                      className="cursor-pointer hover:text-blue-500"
                    >
                      {lease.device_name || 'N/A'}
                    </span>
                  )}
                </td>
                <td className="px-1 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3">
                  {lease.is_reserved ? (
                    <button
                      onClick={() => handleRemoveReservation(lease)}
                      className="h-6 px-2 py-0.5 bg-red-500 dark:bg-red-600 text-white rounded text-xs font-medium hover:bg-red-600 dark:hover:bg-red-700 focus:outline-none focus:ring-1 focus:ring-red-500 dark:focus:ring-red-400 transition-colors w-[72px]"
                    >
                      REMOVE
                    </button>
                  ) : (
                    <button
                      onClick={() => handleReserve(lease)}
                      className="h-6 px-2 py-0.5 bg-blue-500 dark:bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors w-[72px]"
                    >
                      RESERVE
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
} 