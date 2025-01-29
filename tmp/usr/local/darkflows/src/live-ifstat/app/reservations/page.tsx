'use client'

import { useState, useEffect } from 'react';
import { 
  Button, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  TextField,
  IconButton,
  Tooltip
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useRouter } from 'next/navigation';

interface Reservation {
  'ip-address': string;
  'hw-address': string;
  hostname: string;
}

export default function ReservationsPage() {
  const router = useRouter();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [newReservation, setNewReservation] = useState<Reservation>({
    'ip-address': '',
    'hw-address': '',
    hostname: ''
  });
  const [error, setError] = useState<string>('');

  useEffect(() => {
    fetchReservations();
  }, []);

  const fetchReservations = async () => {
    try {
      const response = await fetch('/api/reservations');
      const data = await response.json();
      setReservations(data);
    } catch (error) {
      console.error('Error fetching reservations:', error);
      setError('Failed to load reservations');
    }
  };

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
        });

        if (response.ok) {
          fetchReservations();
        } else {
          setError('Failed to delete reservation');
        }
      } catch (error) {
        console.error('Error deleting reservation:', error);
        setError('Error deleting reservation');
      }
    }
  };

  const handleAdd = async () => {
    try {
      // Basic validation
      if (!newReservation['ip-address'] || !newReservation['hw-address']) {
        setError('IP Address and MAC Address are required');
        return;
      }

      // Validate IP address format
      const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (!ipRegex.test(newReservation['ip-address'])) {
        setError('Invalid IP address format');
        return;
      }

      // Validate MAC address format
      const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
      if (!macRegex.test(newReservation['hw-address'])) {
        setError('Invalid MAC address format (use XX:XX:XX:XX:XX:XX)');
        return;
      }

      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReservation)
      });

      if (response.ok) {
        setOpenDialog(false);
        setNewReservation({ 'ip-address': '', 'hw-address': '', hostname: '' });
        fetchReservations();
      } else {
        setError('Failed to add reservation');
      }
    } catch (error) {
      console.error('Error adding reservation:', error);
      setError('Error adding reservation');
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col font-sans">
      <div className="flex-grow px-4 sm:px-6 lg:px-8 py-6 max-w-7xl mx-auto w-full">
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center gap-4">
            <IconButton onClick={() => router.push('/leases')} aria-label="back">
              <ArrowBackIcon />
            </IconButton>
            <h1 className="text-2xl font-bold text-foreground">DHCP Reservations</h1>
          </div>
          <Button 
            variant="contained" 
            color="primary" 
            startIcon={<AddIcon />}
            onClick={() => setOpenDialog(true)}
          >
            Add Reservation
          </Button>
        </div>

        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="overflow-x-auto shadow-sm rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 uppercase tracking-wider">IP Address</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 uppercase tracking-wider">MAC Address</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 uppercase tracking-wider">Hostname</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-700 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {reservations.map((reservation) => (
                <tr key={reservation['ip-address']} className="hover:bg-gray-50">
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                    {reservation['ip-address']}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                    {reservation['hw-address']}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                    {reservation.hostname || 'N/A'}
                  </td>
                  <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-700">
                    <Tooltip title="Delete Reservation">
                      <IconButton 
                        onClick={() => handleDelete(reservation)}
                        color="error"
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </Tooltip>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Dialog open={openDialog} onClose={() => setOpenDialog(false)}>
          <DialogTitle>Add New Reservation</DialogTitle>
          <DialogContent>
            <div className="mt-4 space-y-4">
              <TextField
                fullWidth
                label="IP Address"
                value={newReservation['ip-address']}
                onChange={(e) => setNewReservation({
                  ...newReservation,
                  'ip-address': e.target.value
                })}
                placeholder="192.168.1.xxx"
              />
              <TextField
                fullWidth
                label="MAC Address"
                value={newReservation['hw-address']}
                onChange={(e) => setNewReservation({
                  ...newReservation,
                  'hw-address': e.target.value
                })}
                placeholder="XX:XX:XX:XX:XX:XX"
              />
              <TextField
                fullWidth
                label="Hostname"
                value={newReservation.hostname}
                onChange={(e) => setNewReservation({
                  ...newReservation,
                  hostname: e.target.value
                })}
                placeholder="device-name"
              />
            </div>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenDialog(false)}>Cancel</Button>
            <Button onClick={handleAdd} variant="contained" color="primary">
              Add
            </Button>
          </DialogActions>
        </Dialog>
      </div>
    </div>
  );
} 