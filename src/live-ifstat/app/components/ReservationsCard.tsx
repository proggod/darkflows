'use client'

// Add noStore directive to prevent caching
import { unstable_noStore as noStore } from 'next/cache';

import { useState, useEffect } from 'react'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'
import DeleteIcon from '@mui/icons-material/Delete'
import RefreshIcon from '@mui/icons-material/Refresh'
import { useRefresh } from '../contexts/RefreshContext'

interface Reservation {
  'ip-address': string
  'hw-address': string
  hostname: string
}

type SortField = 'ip-address' | 'hw-address' | 'name'
type SortDirection = 'asc' | 'desc'

const pingIp = async (ip: string): Promise<boolean> => {
  try {
    const response = await fetch('/api/ping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip })
    })
    const data = await response.json()
    return data.alive
  } catch (error) {
    console.error('Error pinging IP:', error)
    return false
  }
}

export default function ReservationsCard() {
  // Call noStore at the start of the component
  noStore();

  // Development-only logging
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[ReservationsCard] Component mounted', Date.now());
      return () => {
        console.log('[ReservationsCard] Component unmounted', Date.now());
      };
    }
  }, []);
  
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [openDialog, setOpenDialog] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [newReservation, setNewReservation] = useState<Reservation>({
    'ip-address': '',
    'hw-address': '',
    hostname: ''
  })
  const [error, setError] = useState<string>('')
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [editedNames, setEditedNames] = useState<{ [key: string]: string }>({})
  const [savingHostnames, setSavingHostnames] = useState<{ [key: string]: boolean }>({})
  const [editingHostname, setEditingHostname] = useState<string | null>(null)
  // Removed registerRefreshCallback to avoid repeated registration
  const { triggerRefresh, registerRefreshCallback } = useRefresh()

  const [isCheckingIp, setIsCheckingIp] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)

  useEffect(() => {
    console.log('[ReservationsCard] useEffect triggered')
    let mounted = true;
    const controller = new AbortController();

    const fetchData = async () => {
      if (!mounted) return;
      try {
        await fetchReservations(controller.signal);
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('[ReservationsCard] Fetch aborted');
          return;
        }
        throw error;
      }
    };

    fetchData();
    const unregister = registerRefreshCallback((signal?: AbortSignal) => fetchReservations(signal || controller.signal));

    return () => {
      mounted = false;
      controller.abort();
      if (unregister) unregister();
    };
  }, [registerRefreshCallback]);

  const fetchReservations = async (signal?: AbortSignal) => {
    try {
      setIsLoading(true)
      console.log('[ReservationsCard] Fetching reservations...')

      const [reservationsResponse, dnsHostsResponse] = await Promise.all([
        fetch(`/api/reservations?t=${Date.now()}`, {
          signal,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          }
        }),
        fetch(`/api/dns-hosts?t=${Date.now()}`, {
          signal
        })
      ])

      if (!reservationsResponse.ok) {
        console.error(
          `[ReservationsCard] Server responded with error: ${reservationsResponse.status} ${reservationsResponse.statusText}`
        )
        setError(`Failed to load reservations: ${reservationsResponse.status} ${reservationsResponse.statusText}`)
        return
      }

      console.log('[ReservationsCard] Response received, parsing JSON')
      const [reservationsData, dnsHostsData] = await Promise.all([
        reservationsResponse.json(),
        dnsHostsResponse.ok ? dnsHostsResponse.json() : []
      ])

      if (Array.isArray(reservationsData)) {
        // Ensure dnsHostsData is an array and has the expected structure
        const dnsHosts = Array.isArray(dnsHostsData) ? dnsHostsData : [];
        console.log('[ReservationsCard] DNS Hosts:', dnsHosts.length);

        // Merge DNS host information with reservations
        const enrichedReservations = reservationsData.map(reservation => ({
          ...reservation,
          hostname: dnsHosts.find((host: { ip: string }) => 
            host.ip === reservation['ip-address']
          )?.hostname || reservation.hostname || ''
        }))

        console.log(`[ReservationsCard] Successfully loaded ${enrichedReservations.length} reservations`)
        setReservations(enrichedReservations)
        setError('')
      } else {
        console.error('[ReservationsCard] Expected array but got:', reservationsData)
        setError('Received invalid data format from server')
      }
    } catch (error) {
      if (error instanceof Error) {
        console.error('[ReservationsCard] Error fetching reservations:', error)
        setError(`Failed to load reservations: ${error.message}`)
      } else {
        console.error('[ReservationsCard] Unknown error fetching reservations')
        setError('Failed to load reservations: Unknown error')
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (reservation: Reservation) => {
    if (confirm('Are you sure you want to delete this reservation?')) {
      try {
        const response = await fetch('/api/reservations', {
          method: 'DELETE',
          headers: { 
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          },
          body: JSON.stringify({
            ip: reservation['ip-address'],
            mac: reservation['hw-address']
          })
        })

        if (response.ok) {
          await fetchReservations()
          triggerRefresh()
        } else {
          setError(`Failed to delete reservation: ${response.status} ${response.statusText}`)
        }
      } catch (error) {
        setError(`Error deleting reservation: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`)
      }
    }
  }

  const handleAdd = async () => {
    try {
      // Basic validation
      if (!newReservation['ip-address'] || !newReservation['hw-address']) {
        setError('IP Address and MAC Address are required')
        return
      }

      // Validate IP address format
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
      if (!ipRegex.test(newReservation['ip-address'])) {
        setError('Invalid IP address format')
        return
      }

      // Validate MAC address format
      const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/
      if (!macRegex.test(newReservation['hw-address'])) {
        setError('Invalid MAC address format (use XX:XX:XX:XX:XX:XX)')
        return
      }

      // Before adding, check if the IP address is already in use by a device
      setIsCheckingIp(true)
      const isAlive = await pingIp(newReservation['ip-address'])
      setIsCheckingIp(false)

      if (isAlive) {
        if (!confirm('Warning: A device is already responding at this IP address. Do you still want to create this reservation?')) {
          return
        }
      }

      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify(newReservation)
      })

      if (response.ok) {
        setOpenDialog(false)
        setNewReservation({ 'ip-address': '', 'hw-address': '', hostname: '' })
        await fetchReservations()
        triggerRefresh()
      } else {
        const errorData = await response.json()
        setError(errorData.error || `Failed to add reservation: ${response.status} ${response.statusText}`)
      }
    } catch (error) {
      setError(`Error adding reservation: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`)
    }
  }

  const handleEdit = async () => {
    try {
      // Basic validation
      if (!newReservation['ip-address'] || !newReservation['hw-address']) {
        setError('IP Address and MAC Address are required')
        return
      }

      // Validate IP address format
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
      if (!ipRegex.test(newReservation['ip-address'])) {
        setError('Invalid IP address format')
        return
      }

      // Validate MAC address format
      const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/
      if (!macRegex.test(newReservation['hw-address'])) {
        setError('Invalid MAC address format (use XX:XX:XX:XX:XX:XX)')
        return
      }

      // Check if IP address was changed
      const originalReservation = reservations.find(r => r['hw-address'] === newReservation['hw-address'])

      if (originalReservation && originalReservation['ip-address'] !== newReservation['ip-address']) {
        setIsCheckingIp(true)
        const isAlive = await pingIp(newReservation['ip-address'])
        setIsCheckingIp(false)

        if (isAlive) {
          setError('Cannot use this IP address - device is already responding at this address')
          return
        }
      }

      if (!originalReservation) {
        setError('Cannot find original reservation')
        return
      }

      const response = await fetch('/api/reservations', {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({
          ...newReservation,
          originalIp: originalReservation['ip-address']
        })
      })

      if (response.ok) {
        setError('')
        setOpenDialog(false)
        setIsEditing(false)
        setNewReservation({ 'ip-address': '', 'hw-address': '', hostname: '' })
        await fetchReservations()
        triggerRefresh()
      } else {
        const errorData = await response.json()
        if (errorData.error === 'Reservation not found') {
          setError('Cannot find original reservation. Please try adding as new instead.')
        } else {
          setError(errorData.error || 'Failed to update reservation')
        }
        if (errorData.error === 'Reservation not found') {
          setOpenDialog(false)
          setIsEditing(false)
        }
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Error updating reservation')
    }
  }

  const startEdit = (reservation: Reservation) => {
    setNewReservation(reservation)
    setIsEditing(true)
    setOpenDialog(true)
  }

  const handleDialogClose = () => {
    setOpenDialog(false)
    setIsEditing(false)
    setNewReservation({ 'ip-address': '', 'hw-address': '', hostname: '' })
  }

  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('desc')
    }
  }

  const SortArrow = ({ field }: { field: SortField }) => {
    if (field !== sortField) return null
    return (
      <span className="ml-1 text-gray-400">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    )
  }

  const handleNameChange = (ip: string, newName: string) => {
    setEditedNames(prev => ({
      ...prev,
      [ip]: newName
    }))
  }

  const startHostnameEdit = (ip: string, currentHostname: string) => {
    setEditingHostname(ip)
    setEditedNames(prev => ({
      ...prev,
      [ip]: currentHostname || ''
    }))
  }

  const isProcessing = (ip: string) => {
    return savingHostnames[ip]
  }

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>, reservation: Reservation) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      const editedName = editedNames[reservation['ip-address']]
      if (!editedName || editedName === reservation.hostname) return

      try {
        setSavingHostnames(prev => ({ ...prev, [reservation['ip-address']]: true }))

        // Update DNS hostname
        const dnsResponse = await fetch('/api/dns-hosts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ip: reservation['ip-address'],
            oldHostname: reservation.hostname,
            newHostname: editedName,
            mac: reservation['hw-address']
          })
        })

        if (!dnsResponse.ok) {
          const errorText = await dnsResponse.text()
          console.error(`[ReservationsCard] Failed to update hostname: ${errorText}`)
          setError('Failed to update hostname')
          return
        }

        await fetchReservations()
        triggerRefresh()

        // Clear editing state after successful update
        setEditingHostname(null)
        setEditedNames(prev => {
          const newState = { ...prev }
          delete newState[reservation['ip-address']]
          return newState
        })
      } catch (error) {
        setError(`Failed to update hostname: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`)
      } finally {
        setSavingHostnames(prev => ({ ...prev, [reservation['ip-address']]: false }))
      }
    }
  }

  // Add sorting logic to sort the reservations based on the current sortField and sortDirection
  const sortedReservations = [...reservations].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'ip-address':
        // Split IP into octets and compare numerically
        const aOctets = a['ip-address'].split('.').map(Number);
        const bOctets = b['ip-address'].split('.').map(Number);
        for (let i = 0; i < 4; i++) {
          if (aOctets[i] !== bOctets[i]) {
            comparison = aOctets[i] - bOctets[i];
            break;
          }
        }
        break;
      case 'hw-address':
        comparison = a['hw-address'].localeCompare(b['hw-address']);
        break;
      case 'name':
        const nameA = a.hostname || 'N/A';
        const nameB = b.hostname || 'N/A';
        comparison = nameA.localeCompare(nameB);
        break;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">
          DHCP Reservations 
          <span className="text-xs ml-1 text-gray-500">
            ({process.env.NODE_ENV === 'production' ? 'prod' : 'dev'})
          </span>
        </h3>
        <div className="flex gap-2">
          <RefreshIcon 
            onClick={() => {
              const controller = new AbortController();
              fetchReservations(controller.signal);
            }}
            className="w-2 h-2 text-blue-500 dark:text-blue-400 cursor-pointer hover:text-blue-600 dark:hover:text-blue-500 transform scale-25"
          />
          <AddIcon 
            onClick={() => !isEditing && setOpenDialog(!openDialog)}
            className="w-2 h-2 text-blue-500 dark:text-blue-400 cursor-pointer hover:text-blue-600 dark:hover:text-blue-500 transform scale-25"
          />
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded mb-2 text-xs">
          {error}
        </div>
      )}

      {openDialog && (
        <div className="grid grid-cols-2 gap-1 mb-2">
          <input
            type="text"
            value={newReservation['ip-address']}
            onChange={(e) =>
              setNewReservation({
                ...newReservation,
                'ip-address': e.target.value
              })
            }
            placeholder="IP Address"
            className="px-2 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
          />
          <input
            type="text"
            value={newReservation['hw-address']}
            onChange={(e) =>
              setNewReservation({
                ...newReservation,
                'hw-address': e.target.value
              })
            }
            placeholder="MAC Address"
            className="px-2 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
            disabled={isEditing}
          />
          <input
            type="text"
            value={newReservation.hostname}
            onChange={(e) =>
              setNewReservation({
                ...newReservation,
                hostname: e.target.value
              })
            }
            placeholder="Hostname (optional)"
            className="px-2 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white col-span-2"
          />
          <div className="col-span-2 flex justify-end gap-2">
            <button
              onClick={handleDialogClose}
              className="h-6 px-2 py-0.5 bg-blue-500 dark:bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={isEditing ? handleEdit : handleAdd}
              disabled={isCheckingIp}
              className="h-6 px-2 py-0.5 bg-green-500 dark:bg-green-600 text-white rounded text-xs font-medium hover:bg-green-600 dark:hover:bg-green-700 focus:outline-none focus:ring-1 focus:ring-green-500 dark:focus:ring-green-400 transition-colors disabled:opacity-50"
            >
              {isCheckingIp ? 'Checking IP...' : isEditing ? 'Save' : 'Add'}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-auto flex-grow -mx-3">
        <table className="w-full h-full table-container">
          <thead className="sticky top-0 z-10">
            <tr className="table-header">
              <th className="w-[80px] card-hover" onClick={() => handleSort('ip-address')}>
                IP<SortArrow field="ip-address" />
              </th>
              <th className="card-hover" onClick={() => handleSort('name')}>
                Name<SortArrow field="name" />
              </th>
              <th className="px-1 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-10">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {reservations.length === 0 && (
              <tr>
                <td colSpan={3} className="px-1 py-2 text-center text-xs text-gray-500 dark:text-gray-400">
                  {isLoading ? 'Loading reservations...' : (
                    <div className="flex flex-col items-center">
                      <p className="mb-2">No reservations found</p>
                      <button
                        onClick={() => setOpenDialog(true)}
                        className="px-2 py-1 bg-blue-500 dark:bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-600 dark:hover:bg-blue-700"
                      >
                        Add your first reservation
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            )}
            {sortedReservations.map((reservation, index) => (
              <tr
                key={reservation['ip-address']}
                className={`card-hover ${index % 2 === 0 ? '' : 'card-alternate'} ${index === reservations.length - 1 ? 'last-row' : ''}`}
              >
                <td className="px-1 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3 tabular-nums">
                  {reservation['ip-address']}
                </td>
                <td className="px-1 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3">
                  {editingHostname === reservation['ip-address'] ? (
                    <input
                      type="text"
                      value={editedNames[reservation['ip-address']] ?? ''}
                      onChange={(e) => handleNameChange(reservation['ip-address'], e.target.value)}
                      onKeyDown={(e) => handleKeyDown(e, reservation)}
                      onBlur={() => setEditingHostname(null)}
                      className={`w-full px-1 py-0 text-xs border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white ${
                        isProcessing(reservation['ip-address']) ? 'opacity-50' : ''
                      }`}
                      disabled={isProcessing(reservation['ip-address'])}
                      autoFocus
                      placeholder="N/A"
                    />
                  ) : (
                    <span
                      onClick={() => startHostnameEdit(reservation['ip-address'], reservation.hostname || '')}
                      className="cursor-pointer hover:text-blue-500"
                    >
                      {reservation.hostname || 'N/A'}
                    </span>
                  )}
                </td>
                <td className="px-1 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3">
                  <div className="flex gap-1">
                    <EditIcon
                      onClick={() => !isProcessing(reservation['ip-address']) && startEdit(reservation)}
                      className={`w-2 h-2 btn-icon btn-icon-blue ${isProcessing(reservation['ip-address']) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                    <DeleteIcon
                      onClick={() => !isProcessing(reservation['ip-address']) && handleDelete(reservation)}
                      className={`w-2 h-2 btn-icon btn-icon-red ${isProcessing(reservation['ip-address']) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
