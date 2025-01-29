'use client'

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

type SortField = 'ip-address' | 'hw-address' | 'name';
type SortDirection = 'asc' | 'desc';

export default function ReservationsCard() {
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
  const [editedNames, setEditedNames] = useState<{[key: string]: string}>({})
  const [savingHostnames, setSavingHostnames] = useState<{[key: string]: boolean}>({})
  const [editingHostname, setEditingHostname] = useState<string | null>(null)
  const { triggerRefresh, registerRefreshCallback } = useRefresh()

  useEffect(() => {
    fetchReservations()
    return registerRefreshCallback(fetchReservations)
  }, [registerRefreshCallback])


  const fetchReservations = async () => {
    try {
      const response = await fetch('/api/reservations')
      const data = await response.json()
      setReservations(data)
    } catch (error) {
      console.error('Error fetching reservations:', error)
      setError('Failed to load reservations')
    }
  }

  const handleDelete = async (reservation: Reservation) => {
    if (confirm('Are you sure you want to delete this reservation?')) {
      try {
        const response = await fetch('/api/reservations', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ip: reservation['ip-address'],
            mac: reservation['hw-address']
          })
        })

        if (response.ok) {
          await fetchReservations()
          triggerRefresh()
        } else {
          setError('Failed to delete reservation')
        }
      } catch (error) {
        console.error('Error deleting reservation:', error)
        setError('Error deleting reservation')
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

      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReservation)
      })

      if (response.ok) {
        setOpenDialog(false)
        setNewReservation({ 'ip-address': '', 'hw-address': '', hostname: '' })
        await fetchReservations()
        triggerRefresh()
      } else {
        setError('Failed to add reservation')
      }
    } catch (error) {
      console.error('Error adding reservation:', error)
      setError('Error adding reservation')
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

      const response = await fetch('/api/reservations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReservation)
      })

      if (response.ok) {
        setOpenDialog(false)
        setIsEditing(false)
        setNewReservation({ 'ip-address': '', 'hw-address': '', hostname: '' })
        await fetchReservations()
        triggerRefresh()
      } else {
        setError('Failed to update reservation')
      }
    } catch (error) {
      console.error('Error updating reservation:', error)
      setError('Error updating reservation')
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
        const hostnameA = a.hostname || 'N/A';
        const hostnameB = b.hostname || 'N/A';
        comparison = hostnameA.localeCompare(hostnameB);
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

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>, reservation: Reservation) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const editedName = editedNames[reservation['ip-address']];
      if (!editedName || editedName === reservation.hostname) return;

      try {
        setSavingHostnames(prev => ({ ...prev, [reservation['ip-address']]: true }));

        // Update DNS hostname for reserved clients
        const dnsResponse = await fetch('/api/dns-hosts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ip: reservation['ip-address'],
            oldHostname: reservation.hostname,
            newHostname: editedName,
            mac: reservation['hw-address']
          })
        });

        if (!dnsResponse.ok) {
          const errorText = await dnsResponse.text();
          console.error('Failed to update hostname:', errorText);
          setError('Failed to update hostname');
          return;
        }

        await fetchReservations();
        // Clear editing state after successful update
        setEditingHostname(null);
        setEditedNames(prev => {
          const newState = { ...prev };
          delete newState[reservation['ip-address']];
          return newState;
        });
      } catch (error) {
        console.error('Error updating hostname:', error);
        setError('Failed to update hostname');
      } finally {
        setSavingHostnames(prev => ({ ...prev, [reservation['ip-address']]: false }));
      }
    }
  };

  const startHostnameEdit = (ip: string, currentHostname: string) => {
    setEditingHostname(ip);
    setEditedNames(prev => ({
      ...prev,
      [ip]: currentHostname || ''
    }));
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 h-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200">DHCP Reservations</h3>
        <div className="flex gap-2">
          <RefreshIcon 
            onClick={fetchReservations}
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
            onChange={(e) => setNewReservation({
              ...newReservation,
              'ip-address': e.target.value
            })}
            placeholder="IP Address"
            className="px-2 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
            disabled={isEditing}
          />
          <input
            type="text"
            value={newReservation['hw-address']}
            onChange={(e) => setNewReservation({
              ...newReservation,
              'hw-address': e.target.value
            })}
            placeholder="MAC Address"
            className="px-2 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
            disabled={isEditing}
          />
          <input
            type="text"
            value={newReservation.hostname}
            onChange={(e) => setNewReservation({
              ...newReservation,
              hostname: e.target.value
            })}
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
              className="h-6 px-2 py-0.5 bg-green-500 dark:bg-green-600 text-white rounded text-xs font-medium hover:bg-green-600 dark:hover:bg-green-700 focus:outline-none focus:ring-1 focus:ring-green-500 dark:focus:ring-green-400 transition-colors"
            >
              {isEditing ? 'Save' : 'Add'}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-auto flex-grow -mx-3">
        <table className="w-full h-full">
          <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
            <tr className="bg-gray-50 dark:bg-gray-700">
              <th 
                className="px-1 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 w-[80px]"
                onClick={() => handleSort('ip-address')}
              >
                IP<SortArrow field="ip-address" />
              </th>
              <th 
                className="px-1 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600"
                onClick={() => handleSort('name')}
              >
                Name<SortArrow field="name" />
              </th>
              <th className="px-1 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-10">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800">
            {sortedReservations.map((reservation, index) => (
              <tr key={reservation['ip-address']} className={`hover:bg-gray-100 dark:hover:bg-gray-700 ${
                index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-blue-50 dark:bg-blue-900/20'
              }`}>
                <td className="px-1 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3 tabular-nums">
                  {reservation['ip-address']}
                </td>
                <td className="px-1 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3">
                  {editingHostname === reservation['ip-address'] ? (
                    <input
                      type="text"
                      value={editedNames[reservation['ip-address']] ?? ''}
                      onChange={(e) => handleNameChange(reservation['ip-address'], e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleKeyDown(e, reservation);
                        } else if (e.key === 'Escape') {
                          setEditingHostname(null);
                        }
                      }}
                      onBlur={() => setEditingHostname(null)}
                      className={`w-full px-1 py-0 text-xs border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white ${
                        savingHostnames[reservation['ip-address']] ? 'opacity-50' : ''
                      }`}
                      disabled={savingHostnames[reservation['ip-address']]}
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
                      onClick={() => startEdit(reservation)}
                      className="w-2 h-2 text-blue-500 dark:text-blue-400 cursor-pointer hover:text-blue-600 dark:hover:text-blue-500"
                    />
                    <DeleteIcon
                      onClick={() => handleDelete(reservation)}
                      className="w-2 h-2 text-red-500 dark:text-red-400 cursor-pointer hover:text-red-600 dark:hover:text-red-500"
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