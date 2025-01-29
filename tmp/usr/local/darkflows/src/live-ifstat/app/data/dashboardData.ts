interface SystemStats {
  name: string;
  cpu: number;
  memory: number;
  disk: number;
  network: number;
  agentVersion: string;
  hasNotification: boolean;
}

interface ChartData {
  diskUsage: { usage: number }[];
  diskIO: { throughput: number }[];
  bandwidth: { bandwidth: number }[];
  temperature: {
    temp1: number;
    temp2: number;
    temp3: number;
  }[];
}

export const systems: SystemStats[] = [
  {
    name: "local",
    cpu: 0.5,
    memory: 27.9,
    disk: 2.2,
    network: 0.07,
    agentVersion: "0.9.1",
    hasNotification: true
  },
  {
    name: "home-assistant",
    cpu: 2.1,
    memory: 11.6,
    disk: 42.6,
    network: 0.00,
    agentVersion: "0.7.4",
    hasNotification: true
  },
  {
    name: "morphnix",
    cpu: 1.5,
    memory: 12.4,
    disk: 4.3,
    network: 0.59,
    agentVersion: "0.9.1",
    hasNotification: true
  },
  {
    name: "neo",
    cpu: 4.7,
    memory: 14.8,
    disk: 27.5,
    network: 0.00,
    agentVersion: "0.9.1",
    hasNotification: true
  },
  {
    name: "nix-nvillama",
    cpu: 0.1,
    memory: 1.9,
    disk: 60.5,
    network: 0.01,
    agentVersion: "0.9.0",
    hasNotification: true
  },
  {
    name: "snowball",
    cpu: 5.4,
    memory: 5.7,
    disk: 69.5,
    network: 0.00,
    agentVersion: "0.9.1",
    hasNotification: false
  }
];

export const chartData: ChartData = {
  diskUsage: Array(60).fill(0).map(() => ({ usage: 32 })),
  diskIO: Array(60).fill(0).map(() => ({ throughput: 0.03 + Math.random() * 0.09 })),
  bandwidth: Array(60).fill(0).map(() => ({ bandwidth: 0.01 + Math.random() * 0.03 })),
  temperature: Array(60).fill(0).map(() => ({
    temp1: 40 + Math.random() * 5,
    temp2: 45 + Math.random() * 5,
    temp3: 42 + Math.random() * 5
  }))
};