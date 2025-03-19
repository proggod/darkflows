'use client'

import React, { useState, useEffect, useCallback } from 'react'
import RefreshIcon from '@mui/icons-material/Refresh';
import { useRefresh } from '../contexts/RefreshContext'
import { VLANConfig } from '@/types/dashboard'
import MenuItem from '@mui/material/MenuItem'
import Select from '@mui/material/Select'
import FormControl from '@mui/material/FormControl'
import { SelectChangeEvent } from '@mui/material/Select'

interface Lease {
  ip_address: string
  mac_address: string
  device_name: string
  expire: Date | null
  state_name: string
  is_reserved?: boolean
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
  const [processingClients, setProcessingClients] = useState<{[key: string]: boolean}>({});
  const [vlans, setVlans] = useState<VLANConfig[]>([])
  const [selectedVlanId, setSelectedVlanId] = useState<string>('1')
  const [loadingVlans, setLoadingVlans] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)

  const fetchLeases = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/leases?vlan_id=${selectedVlanId}`)
      if (!response.ok) throw new Error('Failed to fetch leases')
      const data = await response.json()
      setLeases(data)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error fetching leases')
    } finally {
      setIsLoading(false)
    }
  }, [selectedVlanId])

  useEffect(() => {
    fetchVlans()
    return () => {}
  }, [])

  useEffect(() => {
    fetchLeases()
    return registerRefreshCallback(fetchLeases)
  }, [registerRefreshCallback, selectedVlanId, fetchLeases])

  const fetchVlans = async () => {
    setLoadingVlans(true)
    try {
      const response = await fetch('/api/vlans')
      if (!response.ok) throw new Error('Failed to fetch VLANs')
      const data = await response.json()
      setVlans(data)
    } catch (error) {
      console.error('Error fetching VLANs:', error)
    } finally {
      setLoadingVlans(false)
    }
  }

  const handleVlanChange = (e: SelectChangeEvent<string>) => {
    setSelectedVlanId(e.target.value)
  }

  const handleReserve = async (lease: Lease) => {
    try {
      setProcessingClients(prev => ({ ...prev, [lease.ip_address]: true }));
      
      // Debug logging
      console.log('Available VLANs:', vlans);
      console.log('Selected VLAN ID:', selectedVlanId);
      
      let subnetCidr: string;
      
      // Handle default VLAN (id: 1) separately
      if (selectedVlanId === '1') {
        subnetCidr = '192.168.1.1-192.168.1.254'; // Default VLAN CIDR range
      } else {
        // Get the selected VLAN's subnet range
        const selectedVlan = vlans.find(v => v.id === parseInt(selectedVlanId));
        console.log('Found VLAN:', selectedVlan);
        
        if (!selectedVlan) {
          console.error('VLAN lookup failed:', {
            vlans,
            selectedVlanId,
            parsedId: parseInt(selectedVlanId)
          });
          throw new Error('Selected VLAN not found');
        }
        subnetCidr = selectedVlan.subnet;
      }

      // Use edited name if it exists, otherwise use the current device name
      const hostname = editedNames[lease.ip_address] || lease.device_name;

      const reservation = {
        'ip-address': lease.ip_address,
        'hw-address': lease.mac_address,
        'hostname': hostname,
        subnetId: selectedVlanId,
        subnetCidr: subnetCidr
      }

      console.log('Creating reservation with:', reservation);

      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reservation)
      })

      if (response.ok) {
        // Update DNS hostname
        const dnsResponse = await fetch('/api/dns-hosts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ip: lease.ip_address,
            oldHostname: lease.device_name,
            newHostname: hostname,
            mac: lease.mac_address,
            subnetId: selectedVlanId
          })
        });

        if (!dnsResponse.ok) {
          const errorText = await dnsResponse.text();
          console.error('Failed to update hostname:', errorText);
          setError('Failed to update hostname');
          return;
        }

        // Clear the edited name after successful reservation
        setEditedNames(prev => {
          const newState = { ...prev };
          delete newState[lease.ip_address];
          return newState;
        });
        await fetchLeases()
        triggerRefresh()
      } else {
        // Try to get error details
        let errorMessage = 'Failed to create reservation';
        try {
          const errorData = await response.json();
          if (errorData.error) {
            errorMessage = errorData.error;
          }
        } catch {
          // If not JSON, try to get text
          try {
            const errorText = await response.text();
            if (errorText) {
              errorMessage = errorText;
            }
          } catch {
            // If text also fails, use status text
            errorMessage = `${response.status} ${response.statusText}`;
          }
        }
        console.error('Failed to create reservation:', errorMessage);
        setError(errorMessage);
      }
    } catch (error) {
      console.error('Error creating reservation:', error)
      setError('Error creating reservation')
    } finally {
      setProcessingClients(prev => ({ ...prev, [lease.ip_address]: false }));
    }
  }

  const handleRemoveReservation = async (lease: Lease) => {
    try {
      setProcessingClients(prev => ({ ...prev, [lease.ip_address]: true }));
      console.log('Removing reservation for:', { ip: lease.ip_address, mac: lease.mac_address });
      
      const response = await fetch('/api/reservations', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ip: lease.ip_address,
          mac: lease.mac_address,
          subnetId: selectedVlanId
        })
      });

      if (response.ok) {
        await fetchLeases();
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
          // Refresh leases list anyway, as the reservation might have been removed by another user
          await fetchLeases();
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
      setProcessingClients(prev => ({ ...prev, [lease.ip_address]: false }));
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

        // If not reserved, create reservation first
        if (!lease.is_reserved) {
          const reserveResponse = await fetch('/api/reservations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              'ip-address': lease.ip_address,
              'hw-address': lease.mac_address,
              'hostname': editedName,
              subnetId: selectedVlanId
            })
          });

          if (!reserveResponse.ok) {
            const errorText = await reserveResponse.text();
            console.error('Failed to create reservation:', errorText);
            setError('Failed to create reservation');
            return;
          }
        }

        // Update DNS hostname
        const dnsResponse = await fetch('/api/dns-hosts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ip: lease.ip_address,
            oldHostname: lease.device_name,
            newHostname: editedName,
            mac: lease.mac_address,
            subnetId: selectedVlanId
          })
        });

        if (!dnsResponse.ok) {
          const errorText = await dnsResponse.text();
          console.error('Failed to update hostname:', errorText);
          setError('Failed to update hostname');
          return;
        }

        await fetchLeases();
        triggerRefresh();
        
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

  const isProcessing = (ip: string) => {
    return processingClients[ip] || savingHostnames[ip];
  };

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">Active DHCP Leases</h3>
        <div className="flex gap-2 items-center">
          <FormControl size="small" className="min-w-[120px]">
            <Select
              value={selectedVlanId}
              onChange={handleVlanChange}
              className="text-gray-700 dark:text-gray-200"
              disabled={loadingVlans}
              sx={{
                fontSize: '0.875rem',
                fontWeight: 500,
                color: 'inherit',
                '.MuiSelect-select': {
                  paddingTop: '0.25rem',
                  paddingBottom: '0.25rem',
                },
                '.MuiOutlinedInput-notchedOutline': {
                  borderColor: 'white',
                },
                '&:hover .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'white',
                },
                '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                  borderColor: 'white',
                },
                '.MuiSelect-icon': {
                  color: 'white',
                }
              }}
              MenuProps={{
                PaperProps: {
                  sx: {
                    '& .MuiMenuItem-root': {
                      fontSize: '0.875rem',
                      fontWeight: 500,
                    }
                  }
                }
              }}
            >
              <MenuItem value="1">Default</MenuItem>
              {vlans.map((vlan) => (
                <MenuItem key={vlan.id} value={vlan.id.toString()}>
                  {vlan.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <RefreshIcon 
            onClick={fetchLeases}
            className="w-2 h-2 btn-icon btn-icon-blue transform scale-25"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded mb-2 text-xs">
          {error}
        </div>
      )}

      <div className="overflow-auto flex-grow -mx-3">
        {isLoading && leases.length === 0 ? (
          <div className="text-center py-4 text-gray-600 dark:text-gray-400">Loading DHCP leases...</div>
        ) : leases.length === 0 ? (
          <div className="text-center py-4 text-gray-600 dark:text-gray-400">No DHCP leases found</div>
        ) : (
          <table className="w-full h-full table-container">
            <thead className="sticky top-0 z-10">
              <tr className="table-header">
                <th className="w-[80px] card-hover" onClick={() => handleSort('ip_address')}>IP<SortArrow field="ip_address" /></th>
                <th className="card-hover" onClick={() => handleSort('device_name')}>Name<SortArrow field="device_name" /></th>
                <th className="w-[80px] card-hover" onClick={() => handleSort('status')}>Status<SortArrow field="status" /></th>
              </tr>
            </thead>
            <tbody>
              {sortedLeases.map((lease, index) => (
                <tr 
                  key={lease.ip_address} 
                  className={`card-hover ${
                    index % 2 === 0 ? '' : 'card-alternate'
                  } ${index === sortedLeases.length - 1 ? 'last-row' : ''}`}
                >
                  <td className="px-1 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3 tabular-nums">
                    {lease.ip_address}
                  </td>
                  <td className="px-1 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3">
                    {editingHostname === lease.ip_address ? (
                      <input
                        type="text"
                        value={editedNames[lease.ip_address] ?? ''}
                        onChange={(e) => handleNameChange(lease.ip_address, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(e, lease)}
                        onBlur={() => setEditingHostname(null)}
                        className={`w-full px-1 py-0 text-xs border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white ${
                          isProcessing(lease.ip_address) ? 'opacity-50' : ''
                        }`}
                        disabled={isProcessing(lease.ip_address)}
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
                        disabled={isProcessing(lease.ip_address)}
                        className={`h-6 px-2 py-0.5 bg-red-500 dark:bg-red-600 text-white rounded text-xs font-medium hover:bg-red-600 dark:hover:bg-red-700 focus:outline-none focus:ring-1 focus:ring-red-500 dark:focus:ring-red-400 transition-colors w-[72px] ${
                          isProcessing(lease.ip_address) ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {isProcessing(lease.ip_address) ? 'SAVING...' : 'REMOVE'}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleReserve(lease)}
                        disabled={isProcessing(lease.ip_address)}
                        className={`h-6 px-2 py-0.5 bg-blue-500 dark:bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors w-[72px] ${
                          isProcessing(lease.ip_address) ? 'opacity-50 cursor-not-allowed' : ''
                        }`}
                      >
                        {isProcessing(lease.ip_address) ? 'SAVING...' : 'RESERVE'}
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
  )
} 