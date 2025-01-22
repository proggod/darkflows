'use client'

import { useState, useEffect } from 'react'
import { Button } from '@mui/material'

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

export default function LeasesCard() {
  const [leases, setLeases] = useState<Lease[]>([])
  const [error, setError] = useState<string>('')

  useEffect(() => {
    fetchLeases()
  }, [])

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
        fetchLeases()
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
        fetchLeases()
      } else {
        setError('Failed to remove reservation')
      }
    } catch (error) {
      console.error('Error removing reservation:', error)
      setError('Error removing reservation')
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-3 h-[490px] flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Active DHCP Leases</h2>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded mb-2 text-xs">
          {error}
        </div>
      )}

      <div className="overflow-auto flex-grow -mx-3 px-3">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0 z-10">
            <tr className="bg-gray-50 dark:bg-gray-700">
              <th className="px-2 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">IP Address</th>
              <th className="px-2 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider">MAC Address</th>
              <th className="px-2 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-24">Name</th>
              <th className="px-2 py-0.5 text-left text-[11px] font-medium text-gray-700 dark:text-gray-300 uppercase tracking-wider w-[80px]">Status</th>
            </tr>
          </thead>
          <tbody className="bg-white dark:bg-gray-800">
            {leases.map((lease) => (
              <tr key={lease.ip_address} className={`hover:bg-gray-50 dark:hover:bg-gray-700 ${lease.is_reserved ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                <td className="px-2 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3">
                  {lease.ip_address}
                </td>
                <td className="px-2 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3">
                  {lease.mac_address}
                </td>
                <td className="px-2 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3">
                  {lease.device_name || 'N/A'}
                </td>
                <td className="px-2 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3">
                  {lease.is_reserved ? (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handleRemoveReservation(lease)}
                      className="pb-0 min-h-0 h-4 text-[10px] w-[72px] leading-none"
                      color="error"
                    >
                      REMOVE
                    </Button>
                  ) : (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => handleReserve(lease)}
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
      </div>
    </div>
  )
} 