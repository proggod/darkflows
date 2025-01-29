import { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableItem } from './SortableItem';
import type { NetworkDevice } from '../types';
import ServerStatus from './ServerStatus';
import PingMonitor from './PingMonitor';
import SpeedTest from './SpeedTest';
import ConnectionTuning from './ConnectionTuning';
import WeatherWidget from './WeatherWidget/WeatherWidget';
import DeviceChart from './DeviceChart';
import SysChart from './SysChart';

interface Props {
  devices: NetworkDevice[];
  isEditMode: boolean;
}

// Define static components
const STATIC_COMPONENTS = {
  serverStatus: { 
    component: () => <ServerStatus />, 
    title: 'Server Status',
    label: 'Server Status' 
  },
  pingMonitor: { 
    component: () => <PingMonitor />, 
    title: 'Network Ping Monitor',
    label: 'Ping Monitor' 
  },
  speedTest: { 
    component: () => <SpeedTest />, 
    title: 'Network Speed Test',
    label: 'Speed Test' 
  },
  connectionTuning: { 
    component: () => <ConnectionTuning />, 
    title: 'Connection Settings',
    label: 'Connection Tuning' 
  },
  weather: { 
    component: () => <WeatherWidget />, 
    title: 'Weather Information',
    label: 'Weather' 
  },
  cpuChart: { 
    component: () => <SysChart metric="cpu" />, 
    title: 'CPU Usage Chart',
    label: 'CPU Usage' 
  },
  memChart: { 
    component: () => <SysChart metric="mem" />, 
    title: 'Memory Usage Chart',
    label: 'Memory Usage' 
  },
};

export default function SortableGrid({ devices, isEditMode }: Props) {
  const [items, setItems] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dashboardOrder');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error('Failed to parse saved dashboard order:', e);
        }
      }
    }
    return [
      'serverStatus',
      'pingMonitor',
      'speedTest',
      'connectionTuning',
      'weather',
      ...devices.map(d => `device_${d.name}`),
      'cpuChart',
      'memChart',
    ];
  });

  const [hiddenItems, setHiddenItems] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('dashboardHidden');
      if (saved) {
        try {
          return new Set(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to parse saved hidden items:', e);
        }
      }
    }
    return new Set<string>();
  });

  // Save order and hidden state to localStorage whenever they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('dashboardOrder', JSON.stringify(items));
      localStorage.setItem('dashboardHidden', JSON.stringify(Array.from(hiddenItems)));
    }
  }, [items, hiddenItems]);

  // Update order when devices change
  useEffect(() => {
    setItems(current => {
      const deviceComponents = devices.map(d => `device_${d.name}`);
      const nonDeviceComponents = current.filter(id => !id.startsWith('device_'));
      const existingDevices = current.filter(id => id.startsWith('device_') && deviceComponents.includes(id));
      const newDevices = deviceComponents.filter(id => !current.includes(id));
      
      return [
        ...nonDeviceComponents,
        ...existingDevices,
        ...newDevices
      ];
    });
  }, [devices]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    if (!isEditMode) return;
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.indexOf(active.id.toString());
        const newIndex = items.indexOf(over.id.toString());
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  }

  const toggleVisibility = (id: string) => {
    setHiddenItems(current => {
      const newHidden = new Set(current);
      if (newHidden.has(id)) {
        newHidden.delete(id);
      } else {
        newHidden.add(id);
      }
      return newHidden;
    });
  };

  const getComponentLabel = (id: string) => {
    if (id.startsWith('device_')) {
      const deviceName = id.replace('device_', '');
      const device = devices.find(d => d.name === deviceName);
      return device?.label || deviceName;
    }
    const componentInfo = STATIC_COMPONENTS[id as keyof typeof STATIC_COMPONENTS];
    console.log('Getting label for component:', id, componentInfo);
    return componentInfo?.title || id;
  };

  const renderComponent = (id: string) => {
    if (id.startsWith('device_')) {
      const deviceName = id.replace('device_', '');
      const device = devices.find(d => d.name === deviceName);
      if (!device) return null;
      return (
        <DeviceChart
          device={device.name}
          label={device.label}
          type={device.type}
          egressBandwidth={device.egressBandwidth}
          ingressBandwidth={device.ingressBandwidth}
        />
      );
    }
    const Component = STATIC_COMPONENTS[id as keyof typeof STATIC_COMPONENTS]?.component;
    return Component ? <Component /> : null;
  };

  const visibleItems = items.filter(id => !hiddenItems.has(id));
  const hiddenItemsList = items.filter(id => hiddenItems.has(id));

  return (
    <div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={visibleItems} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-1 lg:grid-cols-2 3xl:grid-cols-3 gap-8">
            {visibleItems.map((id) => (
              <SortableItem key={id} id={id} isEditMode={isEditMode}>
                <div className="relative">
                  {isEditMode && (
                    <button
                      onClick={() => toggleVisibility(id)}
                      className="absolute top-2 left-2 z-20 p-1 bg-red-500 dark:bg-red-600 text-white rounded-full hover:bg-red-600 dark:hover:bg-red-700"
                      title={`Hide ${getComponentLabel(id)}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                      </svg>
                    </button>
                  )}
                  {renderComponent(id)}
                </div>
              </SortableItem>
            ))}
          </div>
        </SortableContext>

        {isEditMode && hiddenItemsList.length > 0 && (
          <div className="mt-8 p-4 bg-gray-200 dark:bg-gray-800 rounded-lg">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-gray-100">Hidden Components</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {hiddenItemsList.map(id => {
                const label = getComponentLabel(id);
                console.log('Hidden item:', id, 'Label:', label);
                return (
                  <div key={id} className="flex items-center gap-2 p-2 bg-white dark:bg-gray-700 rounded shadow-sm hover:shadow dark:shadow-gray-900">
                    <button
                      onClick={() => toggleVisibility(id)}
                      className="p-1 bg-green-500 dark:bg-green-600 text-white rounded-full hover:bg-green-600 dark:hover:bg-green-700 flex-shrink-0"
                      title={`Show ${label}`}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M12 5v14M5 12h14"/>
                      </svg>
                    </button>
                    <span className="font-medium text-gray-900 dark:text-gray-100 truncate">{label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </DndContext>
    </div>
  );
} 