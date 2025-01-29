'use client'

import { useState, useEffect } from 'react';
import { Button } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';

interface Lease {
  ip_address: string;
  mac_address: string;
  device_name: string;
  expire: Date | null;
  state_name: string;
  is_reserved?: boolean;
}

interface ReservationData {
  'ip-address': string;
  'hw-address': string;
}

export default function LeasesPage() {
  const [leases, setLeases] = useState<Lease[]>([]);

  useEffect(() => {
    // Fetch leases and reservations
    Promise.all([
      fetch('/api/leases').then(res => res.json()),
      fetch('/api/reservations').then(res => res.json())
    ]).then(([leasesData, reservationsData]) => {
      // Mark leases that are reserved
      const markedLeases = leasesData.map((lease: Lease) => ({
        ...lease,
        is_reserved: reservationsData.some((r: ReservationData) => 
          r['ip-address'] === lease.ip_address || 
          r['hw-address'].toLowerCase() === lease.mac_address.toLowerCase()
        )
      }));
      setLeases(markedLeases);
    });
  }, []);

  const handleReserve = async (lease: Lease) => {
    const reservation = {
      'ip-address': lease.ip_address,
      'hw-address': lease.mac_address,
      'hostname': lease.device_name
    };

    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reservation)
      });

      if (response.ok) {
        // Refresh the data
        window.location.reload();
      } else {
        alert('Failed to create reservation');
      }
    } catch (error) {
      console.error('Error creating reservation:', error);
      alert('Error creating reservation');
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      <div className="flex-grow px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold text-center text-foreground">Active DHCP Leases</h1>
          <Button 
            variant="contained" 
            color="primary" 
            href="/reservations"
            startIcon={<AddIcon />}
          >
            Manage Reservations
          </Button>
        </div>
        <div className="overflow-x-auto shadow-sm rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 uppercase tracking-wider">IP Address</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 uppercase tracking-wider">MAC Address</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 uppercase tracking-wider">Device Name</th>
                <th className="sm:table-cell hidden px-4 py-3 text-left text-sm font-medium text-gray-700 uppercase tracking-wider">Expires</th>
                <th className="sm:table-cell hidden px-4 py-3 text-left text-sm font-medium text-gray-700 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {leases.map((lease) => (
                <tr key={lease.ip_address} className={`hover:bg-gray-50 ${lease.is_reserved ? 'bg-blue-50' : ''}`}>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{lease.ip_address}</td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{lease.mac_address}</td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">{lease.device_name}</td>
                  <td className="sm:table-cell hidden px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                    {lease.expire ? lease.expire.toLocaleString() : 'No expiration'}
                  </td>
                  <td className="sm:table-cell hidden px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                    {lease.is_reserved ? 'Reserved' : lease.state_name}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                    {!lease.is_reserved && (
                      <Button
                        variant="outlined"
                        size="small"
                        onClick={() => handleReserve(lease)}
                      >
                        Reserve
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
} 