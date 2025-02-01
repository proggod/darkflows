'use client';

import { useEffect, useState } from 'react';
import { Select, MenuItem, FormControl, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { DnsClient } from '@/types/dns';

interface Schedule {
  id: string;
  day: string;
  startTime: string;
  endTime: string;
}

interface TimeSelectProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

type SortField = 'ip' | 'name' | 'status';
type SortDirection = 'asc' | 'desc';

const FULL_DAY_NAMES: Record<string, string> = {
  'sun': 'Sunday',
  'mon': 'Monday',
  'tue': 'Tuesday',
  'wed': 'Wednesday',
  'thu': 'Thursday',
  'fri': 'Friday',
  'sat': 'Saturday',
};

function TimeSelect({ value, onChange, className = '' }: TimeSelectProps) {
  const [hours, minutes] = value.split(':').map(Number);

  const handleHourChange = (newHour: number) => {
    onChange(`${newHour.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`);
  };

  const handleMinuteChange = (newMinute: number) => {
    onChange(`${hours.toString().padStart(2, '0')}:${newMinute.toString().padStart(2, '0')}`);
  };

  const selectSx = {
    '& .MuiSelect-select': {
      padding: '2px 4px',
      fontSize: '11px',
    },
    '& .MuiOutlinedInput-notchedOutline': {
      borderColor: 'rgb(209 213 219)',
    },
    '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
      borderColor: 'rgb(59 130 246)',
    },
    '&:hover .MuiOutlinedInput-notchedOutline': {
      borderColor: 'rgb(156 163 175)',
    },
    '.dark &': {
      color: 'rgb(229 231 235)',
      '& .MuiSvgIcon-root': {
        color: 'rgb(156 163 175)',
      },
      '& .MuiOutlinedInput-notchedOutline': {
        borderColor: 'rgb(75 85 99)',
      },
      '&:hover .MuiOutlinedInput-notchedOutline': {
        borderColor: 'rgb(107 114 128)',
      },
      '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
        borderColor: 'rgb(59 130 246)',
      },
    },
  };

  const menuSx = {
    '.dark &': {
      backgroundColor: 'rgb(31 41 55)',
      '& .MuiMenuItem-root': {
        color: 'rgb(229 231 235)',
        '&:hover': {
          backgroundColor: 'rgb(55 65 81)',
        },
        '&.Mui-selected': {
          backgroundColor: 'rgb(37 99 235)',
          '&:hover': {
            backgroundColor: 'rgb(29 78 216)',
          },
        },
      },
    },
  };

  return (
    <div className={`flex gap-0.5 ${className}`}>
      <FormControl size="small" className="w-14">
        <Select
          value={hours}
          onChange={(e) => handleHourChange(Number(e.target.value))}
          className="h-6"
          sx={selectSx}
          MenuProps={{
            PaperProps: {
              sx: menuSx,
            },
          }}
        >
          {Array.from({ length: 24 }, (_, i) => (
            <MenuItem key={i} value={i} sx={{ fontSize: '11px' }}>
              {i.toString().padStart(2, '0')}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center">:</span>
      <FormControl size="small" className="w-14">
        <Select
          value={minutes}
          onChange={(e) => handleMinuteChange(Number(e.target.value))}
          className="h-6"
          sx={selectSx}
          MenuProps={{
            PaperProps: {
              sx: menuSx,
            },
          }}
        >
          {Array.from({ length: 60 }, (_, i) => (
            <MenuItem key={i} value={i} sx={{ fontSize: '11px' }}>
              {i.toString().padStart(2, '0')}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </div>
  );
}

export function BlockClientsCard() {
  const [clients, setClients] = useState<DnsClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [blockedMacs, setBlockedMacs] = useState<string[]>([]);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [processingMacs, setProcessingMacs] = useState<{[key: string]: boolean}>({});
  const [schedule, setSchedule] = useState<Schedule[]>([
    { id: 'sun', day: 'Su', startTime: '00:00', endTime: '23:59' },
    { id: 'mon', day: 'M', startTime: '00:00', endTime: '23:59' },
    { id: 'tue', day: 'T', startTime: '00:00', endTime: '23:59' },
    { id: 'wed', day: 'W', startTime: '00:00', endTime: '23:59' },
    { id: 'thu', day: 'Th', startTime: '00:00', endTime: '23:59' },
    { id: 'fri', day: 'F', startTime: '00:00', endTime: '23:59' },
    { id: 'sat', day: 'Sa', startTime: '00:00', endTime: '23:59' },
  ]);
  const [saving, setSaving] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [tempSchedule, setTempSchedule] = useState<Schedule[]>([]);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/dns-clients?hours=24');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        const formattedClients = data.map(client => ({
          ip: client.ip,
          name: client.name || client.ip,
          mac: client.mac !== 'N/A' ? client.mac : undefined,
          lastSeen: client.lastSeen,
          isReserved: client.isReserved,
          status: client.status
        }));
        setClients(formattedClients);
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

  const fetchBlockedMacs = async () => {
    try {
      const response = await fetch('/api/blocked-clients');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setBlockedMacs(data.blockedMacs);
    } catch (error) {
      console.error('Error fetching blocked MACs:', error);
      setError('Failed to load blocked clients');
    }
  };

  const fetchSchedule = async () => {
    try {
      const response = await fetch('/api/block-schedule');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      setSchedule(data);
    } catch (error) {
      console.error('Error fetching schedule:', error);
      setError('Failed to load schedule');
    }
  };

  const handleBlockToggle = async (client: DnsClient) => {
    if (!client.mac) return;

    try {
      setProcessingMacs(prev => ({ ...prev, [client.mac!]: true }));
      const method = blockedMacs.includes(client.mac) ? 'DELETE' : 'POST';
      const response = await fetch('/api/blocked-clients', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mac: client.mac }),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${method === 'POST' ? 'block' : 'unblock'} client`);
      }

      await fetchBlockedMacs();
    } catch (error) {
      console.error('Error toggling block status:', error);
      setError(`Failed to ${blockedMacs.includes(client.mac) ? 'unblock' : 'block'} client`);
    } finally {
      setProcessingMacs(prev => ({ ...prev, [client.mac!]: false }));
    }
  };

  const handleScheduleChange = (dayIndex: number, field: 'startTime' | 'endTime', value: string) => {
    setTempSchedule(prev => {
      const newSchedule = [...prev];
      newSchedule[dayIndex] = {
        ...newSchedule[dayIndex],
        [field]: value,
      };
      return newSchedule;
    });
  };

  const handleOpenSchedule = () => {
    setTempSchedule([...schedule]);
    setShowSchedule(true);
  };

  const handleCloseSchedule = () => {
    setShowSchedule(false);
  };

  const handleSaveSchedule = async () => {
    try {
      setSaving(true);
      const response = await fetch('/api/block-schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tempSchedule),
      });

      if (!response.ok) {
        throw new Error('Failed to save schedule');
      }

      setSchedule(tempSchedule);
      setError(null);
      setShowSchedule(false);
    } catch (error) {
      console.error('Error saving schedule:', error);
      setError('Failed to save schedule');
    } finally {
      setSaving(false);
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

  const sortClients = (clients: DnsClient[], sortBy: string, sortDirection: 'asc' | 'desc') => {
    return [...clients].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
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
          comparison = a.name.localeCompare(b.name);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  };

  const sortedClients = sortClients(clients, sortField, sortDirection);

  useEffect(() => {
    fetchClients();
    fetchBlockedMacs();
    fetchSchedule();
  }, []);

  return (
    <div className="p-3 h-full flex flex-col">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-label">Block Clients</h3>
        <div className="flex gap-2 ml-auto">
          <button
            onClick={handleOpenSchedule}
            className="btn btn-blue flex items-center gap-1"
          >
            <AccessTimeIcon className="!w-3 !h-3" />
            Schedule
          </button>
          <button
            onClick={() => {
              fetchClients();
              fetchBlockedMacs();
            }}
            className="btn btn-blue flex items-center gap-1"
          >
            <RefreshIcon className="!w-3 !h-3" />
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded mb-2 text-small">
          {error}
        </div>
      )}

      <div className="overflow-auto flex-grow -mx-3">
        {loading ? (
          <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">Loading clients...</div>
        ) : clients.length === 0 ? (
          <div className="text-center py-4 text-sm text-gray-500 dark:text-gray-400">No clients found</div>
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
                  className="card-hover"
                  onClick={() => handleSort('name')}
                >
                  Name<SortArrow field="name" />
                </th>
                <th 
                  className="card-hover text-right w-[100px]"
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
                  <td className="px-1 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3 tabular-nums">
                    {client.ip}
                  </td>
                  <td className="px-1 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3 max-w-[128px] overflow-hidden" title={client.name}>
                    {client.name.length > 16 ? client.name.slice(0, 16) + '...' : client.name}
                  </td>
                  <td className="px-1 whitespace-nowrap text-xs text-gray-700 dark:text-gray-300 leading-3 text-right">
                    {client.mac ? (
                      <button
                        onClick={() => handleBlockToggle(client)}
                        disabled={processingMacs[client.mac]}
                        className={`btn w-[72px] justify-center ${
                          blockedMacs.includes(client.mac)
                            ? 'btn-red'
                            : 'btn-green'
                        } ${processingMacs[client.mac] ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {processingMacs[client.mac] ? 'SAVING...' : blockedMacs.includes(client.mac) ? 'UNBLOCK' : 'BLOCK'}
                      </button>
                    ) : (
                      'N/A'
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <Dialog 
        open={showSchedule} 
        onClose={handleCloseSchedule}
        PaperProps={{
          className: 'dark:bg-gray-800',
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle className="text-gray-900 dark:text-gray-100">Blocking Schedule</DialogTitle>
        <DialogContent>
          <div className="space-y-2 p-4">
            {tempSchedule.map((day, index) => (
              <div key={day.id} className="flex items-center">
                <span className="text-xs text-gray-700 dark:text-gray-300 w-[80px]">{FULL_DAY_NAMES[day.id]}</span>
                <TimeSelect
                  value={day.startTime}
                  onChange={(value) => handleScheduleChange(index, 'startTime', value)}
                />
                <span className="text-xs text-gray-500 dark:text-gray-400 mx-2">to</span>
                <TimeSelect
                  value={day.endTime}
                  onChange={(value) => handleScheduleChange(index, 'endTime', value)}
                />
              </div>
            ))}
          </div>
        </DialogContent>
        <DialogActions className="border-t border-gray-200 dark:border-gray-700 p-4">
          <button 
            onClick={handleCloseSchedule}
            className="h-6 px-2 py-0.5 bg-blue-500 dark:bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveSchedule}
            disabled={saving}
            className="h-6 px-2 py-0.5 bg-green-500 dark:bg-green-600 text-white rounded text-xs font-medium hover:bg-green-600 dark:hover:bg-green-700 focus:outline-none focus:ring-1 focus:ring-green-500 dark:focus:ring-green-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </DialogActions>
      </Dialog>
    </div>
  );
} 