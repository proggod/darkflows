import { useState, useEffect } from "react";
import { toast } from "sonner";
import { isIPv4 } from "is-ip";
import { Plus, Trash2, Save, RefreshCw, RotateCcw } from "lucide-react";

interface IpPool {
  start: string;
  end: string;
}

interface NetworkSettings {
  gatewayIp: string;
  subnetMask: string;
  ipPools: IpPool[];
  cakeDefault?: string;
  cakeParams?: string;
  error?: string;
  // Cloudflare DNS Settings
  zoneId?: string;
  recordId?: string;
  apiToken?: string;
  recordName?: string;
}

function calculateDefaultPools(gatewayIp: string, subnetMask: string): IpPool[] {
  try {
    // Split IP into octets
    const ipParts = gatewayIp.split('.').map(Number);
    const maskParts = subnetMask.split('.').map(Number);
    
    // Calculate network address
    const networkParts = ipParts.map((part, i) => part & maskParts[i]);
    
    // Find the first non-255 octet in subnet mask for the range
    const rangeOctetIndex = maskParts.findIndex(part => part !== 255);
    if (rangeOctetIndex === -1) return [{ start: `${networkParts.join('.')}.10`, end: `${networkParts.join('.')}.240` }];

    // Create start and end addresses
    const startParts = [...networkParts];
    const endParts = [...networkParts];
    startParts[rangeOctetIndex] = networkParts[rangeOctetIndex];
    endParts[rangeOctetIndex] = networkParts[rangeOctetIndex] | (~maskParts[rangeOctetIndex] & 255);

    return [{
      start: `${startParts.slice(0, -1).join('.')}.10`,
      end: `${endParts.slice(0, -1).join('.')}.240`
    }];
  } catch {
    // Return default pool if calculation fails
    return [{ start: "192.168.0.10", end: "192.168.1.240" }];
  }
}

export function SystemSettingsCard() {
  const [settings, setSettings] = useState<NetworkSettings>({
    gatewayIp: "192.168.1.1",
    subnetMask: "255.255.254.0",
    ipPools: [{ start: "192.168.0.10", end: "192.168.1.200" }],
    cakeDefault: "",
    cakeParams: "",
    // Cloudflare DNS Settings
    zoneId: "",
    recordId: "",
    apiToken: "",
    recordName: ""
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isRebooting, setIsRebooting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/network-settings');
      if (!response.ok) {
        throw new Error('Failed to fetch settings');
      }
      const data = await response.json();
      setSettings(data);
    } catch {
      setError('Failed to load settings');
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

  const handleGatewayIpChange = (newGatewayIp: string) => {
    const newPools = calculateDefaultPools(newGatewayIp, settings.subnetMask);
    setSettings({
      ...settings,
      gatewayIp: newGatewayIp,
      ipPools: newPools
    });
  };

  const handleSubnetMaskChange = (newSubnetMask: string) => {
    const newPools = calculateDefaultPools(settings.gatewayIp, newSubnetMask);
    setSettings({
      ...settings,
      subnetMask: newSubnetMask,
      ipPools: newPools
    });
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

  const rebootServer = async () => {
    setIsRebooting(true);
    try {
      const response = await fetch('/api/network-settings/reboot', {
        method: 'POST',
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to reboot server');
      }

      toast.success('Server is rebooting...');
    } catch (error) {
      console.error('Error rebooting server:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to reboot server');
    } finally {
      setIsRebooting(false);
    }
  };

  const loadDefaultCakeParams = () => {
    if (!settings.cakeDefault) {
      console.warn('No default CAKE parameters available');
      return;
    }
    setSettings(prev => ({
      ...prev,
      cakeParams: prev.cakeDefault
    }));
  };

  return (
    <div className="rounded-lg shadow-sm p-3 h-full flex flex-col">
      <div className="flex flex-col h-full">
        <h3 className="text-label mb-2">System Settings</h3>
        <div className="flex items-center justify-between mb-2 px-1">
          <div className="flex items-center gap-2">
            <button
              onClick={rebootServer}
              disabled={isRebooting}
              className="px-2 py-1 bg-red-500 dark:bg-red-600 text-white rounded text-xs font-medium hover:bg-red-600 dark:hover:bg-red-700 focus:outline-none focus:ring-1 focus:ring-red-500 dark:focus:ring-red-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
            >
              <RefreshCw className={`h-3 w-3 ${isRebooting ? 'animate-spin' : ''}`} />
              Reboot
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
                onChange={(e) => handleGatewayIpChange(e.target.value)}
                placeholder="192.168.1.1"
                className={`px-1.5 py-1 text-[10px] rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 w-full min-w-[120px]`}
              />
            </div>

            <div className="flex items-center gap-1">
              <label className="text-[10px] font-medium text-gray-700 dark:text-gray-300 w-[85px]">Subnet Mask</label>
              <input
                type="text"
                value={settings.subnetMask}
                onChange={(e) => handleSubnetMaskChange(e.target.value)}
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
                CAKE Params
              </label>
              <div className="flex gap-1 flex-1">
                <input
                  type="text"
                  value={settings.cakeParams || ''}
                  onChange={(e) => setSettings({ ...settings, cakeParams: e.target.value })}
                  placeholder="CAKE Parameters"
                  className="px-1.5 py-1 text-[10px] rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 w-full"
                />
                <button
                  onClick={loadDefaultCakeParams}
                  disabled={!settings.cakeDefault}
                  className="px-2 py-0.5 text-xs font-medium bg-gray-500 dark:bg-gray-600 text-white rounded hover:bg-gray-600 dark:hover:bg-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-500 dark:focus:ring-gray-400 transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                  <RotateCcw className="h-3 w-3" />
                  Default
                </button>
              </div>
            </div>

            {/* Cloudflare DNS Settings */}
            <div className="space-y-2 mt-6">
              <h4 className="text-[10px] font-medium text-gray-700 dark:text-gray-300 mb-2">CloudFlare Dynamic DNS</h4>
              <div className="flex items-center gap-1">
                <label className="text-[10px] font-medium text-gray-700 dark:text-gray-300 w-[85px]">Zone ID</label>
                <input
                  type="text"
                  value={settings.zoneId || ''}
                  onChange={(e) => setSettings({ ...settings, zoneId: e.target.value })}
                  placeholder="Cloudflare Zone ID"
                  className="px-1.5 py-1 text-[10px] rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 w-full"
                />
              </div>

              <div className="flex items-center gap-1">
                <label className="text-[10px] font-medium text-gray-700 dark:text-gray-300 w-[85px]">Record ID</label>
                <input
                  type="text"
                  value={settings.recordId || ''}
                  onChange={(e) => setSettings({ ...settings, recordId: e.target.value })}
                  placeholder="Cloudflare Record ID"
                  className="px-1.5 py-1 text-[10px] rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 w-full"
                />
              </div>

              <div className="flex items-center gap-1">
                <label className="text-[10px] font-medium text-gray-700 dark:text-gray-300 w-[85px]">API Token</label>
                <input
                  type="password"
                  value={settings.apiToken || ''}
                  onChange={(e) => setSettings({ ...settings, apiToken: e.target.value })}
                  placeholder="Cloudflare API Token"
                  className="px-1.5 py-1 text-[10px] rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 w-full"
                />
              </div>

              <div className="flex items-center gap-1">
                <label className="text-[10px] font-medium text-gray-700 dark:text-gray-300 w-[85px]">Domain Name</label>
                <input
                  type="text"
                  value={settings.recordName || ''}
                  onChange={(e) => setSettings({ ...settings, recordName: e.target.value })}
                  placeholder="Domain Name (e.g., ai.darkflows.com)"
                  className="px-1.5 py-1 text-[10px] rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 w-full"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="mt-2 flex flex-col gap-2">
          {error && (
            <div className="p-1.5 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded">
              <p className="text-[10px] text-red-800 dark:text-red-200">{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
