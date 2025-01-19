'use client'

import { useState, useEffect } from 'react'
import { Button, IconButton, Tooltip } from '@mui/material'
import DeleteIcon from '@mui/icons-material/Delete'
import AddIcon from '@mui/icons-material/Add'
import EditIcon from '@mui/icons-material/Edit'

interface Reservation {
  'ip-address': string
  'hw-address': string
  hostname: string
}

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

  useEffect(() => {
    fetchReservations()
  }, [])

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
          fetchReservations()
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
        fetchReservations()
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
        fetchReservations()
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

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 h-[450px] flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">DHCP Reservations</h2>
        <Button 
          variant="contained" 
          color="primary" 
          startIcon={<AddIcon />}
          onClick={() => !isEditing && setOpenDialog(!openDialog)}
          size="small"
        >
          {openDialog ? 'Cancel' : 'Add'}
        </Button>
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
            placeholder="Hostname"
            className="px-2 py-0.5 text-xs border border-gray-300 dark:border-gray-600 rounded dark:bg-gray-700 dark:text-white"
          />
          <div className="flex gap-1">
            <Button
              variant="contained"
              color="primary"
              onClick={isEditing ? handleEdit : handleAdd}
              size="small"
              className="min-w-0 h-6 flex-grow"
            >
              {isEditing ? 'Update' : 'Add'}
            </Button>
            <IconButton
              onClick={handleDialogClose}
              size="small"
              className="p-0 h-6 w-6 min-h-0 border border-gray-300 dark:border-gray-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-gray-900 dark:text-white">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
              </svg>
            </IconButton>
          </div>
        </div>
      )}

      <div className="overflow-auto flex-grow -mx-3 px-3">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
            <tr className="bg-gray-50 dark:bg-gray-700">
              <th className="px-2 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">IP Address</th>
              <th className="px-2 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">MAC Address</th>
              <th className="px-2 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">Hostname</th>
              <th className="px-2 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-10">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800">
            {reservations.map((reservation) => (
              <tr key={reservation['ip-address']} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                <td className="px-2 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3">
                  {reservation['ip-address']}
                </td>
                <td className="px-2 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3">
                  {reservation['hw-address']}
                </td>
                <td className="px-2 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3">
                  {reservation.hostname || 'N/A'}
                </td>
                <td className="px-2 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3">
                  <div className="flex gap-1">
                    <Tooltip title="Edit Reservation">
                      <IconButton 
                        onClick={() => startEdit(reservation)}
                        color="primary"
                        size="small"
                        className="p-0 h-4 w-4 min-h-0"
                      >
                        <EditIcon style={{ fontSize: '14px' }} />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Reservation">
                      <IconButton 
                        onClick={() => handleDelete(reservation)}
                        color="error"
                        size="small"
                        className="p-0 h-4 w-4 min-h-0"
                      >
                        <DeleteIcon style={{ fontSize: '14px' }} />
                      </IconButton>
                    </Tooltip>
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