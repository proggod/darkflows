import { useState, useEffect } from "react";
import { toast } from "sonner";
import { isIPv4 } from "is-ip";
import { Plus, Trash2, Save, RefreshCw } from "lucide-react";

interface IpPool {
  start: string;
  end: string;
}

interface NetworkSettings {
  gatewayIp: string;
  subnetMask: string;
  ipPools: IpPool[];
  cakeDefault?: string;
  error?: string;
}

export function SystemSettingsCard() {
  const [settings, setSettings] = useState<NetworkSettings>({
    gatewayIp: "192.168.1.1",
    subnetMask: "255.255.254.0",
    ipPools: [{ start: "192.168.0.10", end: "192.168.1.200" }],
    cakeDefault: ""
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isRestartingNetwork, setIsRestartingNetwork] = useState(false);
  const [isRestartingDhcp, setIsRestartingDhcp] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/network-settings');
      if (!response.ok) throw new Error('Failed to fetch settings');
      const data = await response.json();
      console.log('Fetched settings:', data);
      setSettings(data);
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Failed to load network settings');
    }
  };

  const isValidIpInSubnet = (ip: string) => {
    if (!isIPv4(ip)) return false;
    const ipParts = ip.split(".").map(Number);
    const subnetParts = settings.subnetMask.split(".").map(Number);
    const networkParts = settings.gatewayIp.split(".").map(Number);

    for (let i = 0; i < 4; i++) {
      const networkBits = networkParts[i] & subnetParts[i];
      const ipBits = ipParts[i] & subnetParts[i];
      if (networkBits !== ipBits) return false;
    }
    return true;
  };

  const addPool = () => {
    setSettings({
      ...settings,
      ipPools: [...settings.ipPools, { start: "", end: "" }],
    });
  };

  const removePool = (index: number) => {
    const newPools = settings.ipPools.filter((_, i) => i !== index);
    setSettings({ ...settings, ipPools: newPools });
  };

  const updatePool = (index: number, field: keyof IpPool, value: string) => {
    const newPools = [...settings.ipPools];
    newPools[index] = { ...newPools[index], [field]: value };
    setSettings({ ...settings, ipPools: newPools });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/network-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to save settings');
      }

      toast.success('Network settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const restartService = async (service: 'network' | 'dhcp') => {
    const setLoading = service === 'network' ? setIsRestartingNetwork : setIsRestartingDhcp;
    setLoading(true);
    try {
      const response = await fetch('/api/network-settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ service }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Failed to restart ${service}`);
      }

      toast.success(`${service === 'network' ? 'Network' : 'DHCP'} service restarted successfully`);
    } catch (error) {
      console.error(`Error restarting ${service}:`, error);
      toast.error(error instanceof Error ? error.message : `Failed to restart ${service}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2 shadow-sm transition-colors duration-200 h-card">
      <div className="flex flex-col h-full">
        <h3 className="text-sm font-medium text-gray-700 dark:text-gray-200 mb-2 px-1">System Settings</h3>
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2">
            <button
              onClick={() => restartService('network')}
              disabled={isRestartingNetwork}
              className="px-2 py-1 bg-blue-500 dark:bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
            >
              <RefreshCw className={`h-3 w-3 ${isRestartingNetwork ? 'animate-spin' : ''}`} />
              Network
            </button>
            <button
              onClick={() => restartService('dhcp')}
              disabled={isRestartingDhcp}
              className="px-2 py-1 bg-blue-500 dark:bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
            >
              <RefreshCw className={`h-3 w-3 ${isRestartingDhcp ? 'animate-spin' : ''}`} />
              DHCP
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-3 py-1 bg-green-500 dark:bg-green-600 text-white rounded text-xs font-medium hover:bg-green-600 dark:hover:bg-green-700 focus:outline-none focus:ring-1 focus:ring-green-500 dark:focus:ring-green-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
            >
              <Save className="h-3 w-3" />
              {isSaving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          <div className="grid gap-2">
            <div className="flex items-center gap-1">
              <label className="text-[10px] font-medium text-gray-700 dark:text-gray-300 w-[85px]">Gateway IP</label>
              <input
                type="text"
                value={settings.gatewayIp}
                onChange={(e) => setSettings({ ...settings, gatewayIp: e.target.value })}
                placeholder="192.168.1.1"
                className={`px-1.5 py-1 text-[10px] rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 w-full min-w-[120px]`}
              />
            </div>

            <div className="flex items-center gap-1">
              <label className="text-[10px] font-medium text-gray-700 dark:text-gray-300 w-[85px]">Subnet Mask</label>
              <input
                type="text"
                value={settings.subnetMask}
                onChange={(e) => setSettings({ ...settings, subnetMask: e.target.value })}
                placeholder="255.255.254.0"
                className={`px-1.5 py-1 text-[10px] rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 w-full min-w-[120px]`}
              />
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-medium text-gray-700 dark:text-gray-300">IP Pools</label>
                <button
                  onClick={addPool}
                  className="px-2 py-0.5 text-xs font-medium bg-blue-500 dark:bg-blue-600 text-white rounded hover:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 transition-colors"
                >
                  <Plus className="h-3 w-3 inline" />
                  Add Pool
                </button>
              </div>

              <div className="space-y-3">
                {settings.ipPools.map((pool, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={pool.start}
                      onChange={(e) => updatePool(index, "start", e.target.value)}
                      placeholder="Start IP"
                      className={`px-1.5 py-1 text-[10px] rounded bg-gray-50 dark:bg-gray-700 border ${
                        isValidIpInSubnet(pool.start)
                          ? 'border-gray-300 dark:border-gray-600'
                          : ''
                      } text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 w-full min-w-[120px]`}
                    />
                    <span className="text-[10px] text-gray-500">-</span>
                    <input
                      type="text"
                      value={pool.end}
                      onChange={(e) => updatePool(index, "end", e.target.value)}
                      placeholder="End IP"
                      className={`px-1.5 py-1 text-[10px] rounded bg-gray-50 dark:bg-gray-700 border ${
                        isValidIpInSubnet(pool.end)
                          ? 'border-gray-300 dark:border-gray-600'
                          : ''
                      } text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 w-full min-w-[120px]`}
                    />
                    <button
                      onClick={() => removePool(index)}
                      className="p-0.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 rounded"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1">
              <label className="text-[10px] font-medium text-gray-700 dark:text-gray-300 w-[85px]">
                CAKE Default
              </label>
              <input
                type="text"
                value={settings.cakeDefault || ''}
                onChange={(e) => setSettings({ ...settings, cakeDefault: e.target.value })}
                placeholder="CAKE Default Parameters"
                className="px-1.5 py-1 text-[10px] rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 w-full"
              />
            </div>
          </div>
        </div>

        <div className="mt-2 flex flex-col gap-2">
          {settings.error && (
            <div className="p-1.5 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded">
              <p className="text-[10px] text-red-800 dark:text-red-200">{settings.error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
