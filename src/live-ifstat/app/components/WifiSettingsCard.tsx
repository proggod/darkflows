import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Save, RefreshCw } from 'lucide-react';

interface WifiSettings {
  channel: number;
  txPower: number;
  supportedChannels: number[];
  maxTxPower: number;
  bands: {
    band: string;
    capabilities: string[];
    frequencies: Array<{
      frequency: number;
      channel: number;
      power: number;
    }>;
  }[];
  selectedBand?: string;
}

export function WifiSettingsCard() {
  const [settings, setSettings] = useState<WifiSettings>({
    channel: 1,
    txPower: 20,
    supportedChannels: [],
    maxTxPower: 20,
    bands: [],
    selectedBand: undefined
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/wifi-settings');
      if (!response.ok) {
        const data = await response.json();
        if (data.error === 'WIFI_NOT_ENABLED') {
          setError('WiFi is not enabled on this device');
          setSettings({
            channel: 1,
            txPower: 20,
            supportedChannels: [],
            maxTxPower: 20,
            bands: [],
            selectedBand: undefined
          });
        } else {
          throw new Error('Failed to fetch settings');
        }
        return;
      }
      const data = await response.json();
      
      // Initialize the selected band if not set
      if (!data.selectedBand && data.bands && data.bands.length > 0) {
        data.selectedBand = data.bands[0].band;
      }
      
      // Ensure we have the correct channel for the selected band
      if (data.selectedBand) {
        const bandChannels = data.bands
          .find((b: { band: string }) => b.band === data.selectedBand)
          ?.frequencies.map((f: { channel: number }) => f.channel) || [];
        
        if (!bandChannels.includes(data.channel) && bandChannels.length > 0) {
          data.channel = bandChannels[0];
        }
      }

      setSettings(data);
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load WiFi settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const response = await fetch('/api/wifi-settings', {
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

      toast.success('WiFi settings saved successfully');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const getAvailableChannelsForBand = (band: string) => {
    const selectedBandInfo = settings.bands.find(b => b.band === band);
    return selectedBandInfo?.frequencies.map(f => f.channel) || [];
  };

  const handleBandChange = (band: string) => {
    const channels = getAvailableChannelsForBand(band);
    setSettings(prev => ({
      ...prev,
      selectedBand: band,
      channel: channels[0] || prev.channel
    }));
  };

  return (
    <div className="rounded-lg shadow-sm p-3 flex flex-col">
      <div className="flex flex-col">
        <h3 className="text-label mb-2">WiFi Settings</h3>
        {error === 'WiFi is not enabled on this device' ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[10px] text-gray-700 dark:text-gray-300">{error}</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving || error === 'WiFi is not enabled on this device'}
                  className="px-3 py-1 bg-green-500 dark:bg-green-600 text-white rounded text-xs font-medium hover:bg-green-600 dark:hover:bg-green-700 focus:outline-none focus:ring-1 focus:ring-green-500 dark:focus:ring-green-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                >
                  <Save className="h-3 w-3" />
                  {isSaving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={fetchSettings}
                  disabled={isLoading}
                  className="px-2 py-1 bg-blue-500 dark:bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-600 dark:hover:bg-blue-700 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1"
                >
                  <RefreshCw className={`h-3 w-3 ${isLoading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>

            <div className="grid gap-2">
              <div className="flex items-center gap-1">
                <label className="text-[10px] font-medium text-gray-700 dark:text-gray-300 w-[85px]">Band</label>
                <select
                  value={settings.selectedBand}
                  onChange={(e) => handleBandChange(e.target.value)}
                  className="px-1.5 py-1 text-[10px] rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 w-full min-w-[120px]"
                  disabled={settings.bands.length === 0}
                >
                  {settings.bands.map((band) => {
                    const freqRange = band.frequencies.length > 0 
                      ? `${band.frequencies[0].frequency}-${band.frequencies[band.frequencies.length-1].frequency}MHz` 
                      : '';
                    return (
                      <option key={band.band} value={band.band}>
                        {band.band} ({freqRange})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="flex items-center gap-1">
                <label className="text-[10px] font-medium text-gray-700 dark:text-gray-300 w-[85px]">Channel</label>
                <select
                  value={settings.channel}
                  onChange={(e) => setSettings({ ...settings, channel: parseInt(e.target.value) })}
                  className="px-1.5 py-1 text-[10px] rounded bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-blue-500 dark:focus:ring-blue-400 w-full min-w-[120px]"
                  disabled={!settings.selectedBand}
                >
                  {settings.selectedBand && settings.bands
                    .find(band => band.band === settings.selectedBand)
                    ?.frequencies.map((freq) => (
                      <option key={freq.channel} value={freq.channel}>
                        Ch {freq.channel} ({freq.frequency} MHz)
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex items-center gap-1">
                <label className="text-[10px] font-medium text-gray-700 dark:text-gray-300 w-[85px]">TX Power</label>
                <div className="flex-1 flex items-center gap-2">
                  <input
                    type="range"
                    min="0"
                    max={settings.maxTxPower}
                    value={settings.txPower}
                    onChange={(e) => setSettings({ ...settings, txPower: parseInt(e.target.value) })}
                    className="flex-1"
                    disabled={isLoading}
                  />
                  <span className="text-[10px] text-gray-700 dark:text-gray-300 w-[30px] text-right">
                    {settings.txPower} dBm
                  </span>
                </div>
              </div>
            </div>

            {error && error !== 'WiFi is not enabled on this device' && (
              <div className="mt-2 p-1.5 bg-red-100 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded">
                <p className="text-[10px] text-red-800 dark:text-red-200">{error}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 