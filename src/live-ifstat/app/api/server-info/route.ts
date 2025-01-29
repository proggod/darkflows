import { NextResponse } from 'next/server'
import { promisify } from 'util'
import { exec } from 'child_process'

const execAsync = promisify(exec);

export const runtime = 'nodejs';

async function getMemoryInfo() {
  const { stdout } = await execAsync('free -m')
  // Parse total memory from "Mem:" line
  const lines = stdout.trim().split('\n')
  let totalMemMB = 0
  for (const line of lines) {
    if (line.startsWith('Mem:')) {
      const parts = line.split(/\s+/)
      totalMemMB = parseInt(parts[1], 10)
      break
    }
  }
  return totalMemMB
}

async function getCPUInfo() {
  const { stdout } = await execAsync('lscpu')
  // lscpu output varies, but includes lines like:
  // CPU(s):              4
  // Model name:          Intel(R) Core(TM) i5-8250U CPU @ 1.60GHz
  const lines = stdout.trim().split('\n')
  let cpus = 0
  let model = ''
  for (const line of lines) {
    if (line.startsWith('CPU(s):')) {
      cpus = parseInt(line.split(':')[1].trim(), 10)
    } else if (line.startsWith('Model name:')) {
      model = line.split(':')[1].trim()
    }
  }
  return { cpus, model }
}

async function getOSInfo() {
  // Try /etc/os-release
  try {
    const { stdout } = await execAsync('cat /etc/os-release')
    // /etc/os-release contains lines like:
    // NAME="Ubuntu"
    // VERSION="20.04.5 LTS (Focal Fossa)"
    // ...
    const lines = stdout.trim().split('\n')
    let name = ''
    let version = ''
    for (const line of lines) {
      if (line.startsWith('NAME=')) {
        name = line.split('=')[1].replace(/"/g, '')
      } else if (line.startsWith('VERSION=')) {
        version = line.split('=')[1].replace(/"/g, '')
      }
    }
    return { name, version }
  } catch (error) {
    console.error('Failed to get OS info:', error)
    return { name: 'Unknown OS', version: '' }
  }
}

async function getNetworkInterfaces() {
  try {
    const { stdout } = await execAsync('ip link')
    const lines = stdout.trim().split('\n')
    
    const interfaces: { name: string, speed?: string }[] = []
    for (const line of lines) {
      const match = line.match(/^\d+: ([^:]+):/)
      if (match && match[1] !== 'lo') {
        interfaces.push({ name: match[1] })
      }
    }

    // Attempt to get speeds with `ethtool`
    for (const iface of interfaces) {
      try {
        const { stdout } = await execAsync(`ethtool ${iface.name}`)
        const speedLine = stdout.split('\n').find(l => l.includes('Speed:'))
        iface.speed = speedLine ? speedLine.split(':')[1].trim() : 'Unknown'
      } catch {
        iface.speed = 'Unknown'
      }
    }

    return interfaces
  } catch (error) {
    console.error('Failed to get network interfaces:', error)
    return []
  }
}

async function getDiskUsage() {
  try {
    const { stdout } = await execAsync('df -h /')
    const lines = stdout.trim().split('\n')
    const rootInfo = lines[lines.length - 1].split(/\s+/)
    const usedPercent = parseInt(rootInfo[4].replace('%', ''), 10)
    const totalGB = parseFloat(rootInfo[1].replace('G', ''))
    const availableGB = parseFloat(rootInfo[3].replace('G', ''))
    
    return {
      usedPercent: isNaN(usedPercent) ? 0 : usedPercent,
      totalGB: isNaN(totalGB) ? 0 : totalGB,
      availableGB: isNaN(availableGB) ? 0 : availableGB
    }
  } catch (error) {
    console.error('Failed to get disk usage:', error)
    return {
      usedPercent: 0,
      totalGB: 0,
      availableGB: 0
    }
  }
}

async function getUptime() {
  try {
    const { stdout } = await execAsync('uptime -p')
    return stdout.trim()
  } catch (error) {
    console.error('Failed to get uptime:', error)
    return 'Unknown'
  }
}

export async function GET() {
  try {
    const [totalMemMB, cpuInfo, osInfo, interfaces, diskUsage, uptime] = await Promise.allSettled([
      getMemoryInfo(),
      getCPUInfo(),
      getOSInfo(),
      getNetworkInterfaces(),
      getDiskUsage(),
      getUptime()
    ])

    // Calculate memory usage percentage
    const memoryUsagePercent = Math.round((totalMemMB.status === 'fulfilled' ? totalMemMB.value : 0 - await getMemoryInfo()) / (totalMemMB.status === 'fulfilled' ? totalMemMB.value : 0) * 100)

    const data = {
      systemStats: {
        name: `${osInfo.status === 'fulfilled' ? osInfo.value.name : 'Unknown OS'} Server`,
        cpu: 45, // You'll need to implement real CPU usage monitoring
        memory: memoryUsagePercent,
        disk: diskUsage.status === 'fulfilled' ? diskUsage.value.usedPercent : 0,
        network: 125.3, // You'll need to implement real network monitoring
        agentVersion: '1.0.0',
        hasNotification: false
      },
      serverInfo: {
        totalMemMB: totalMemMB.status === 'fulfilled' ? totalMemMB.value : 0,
        cpus: cpuInfo.status === 'fulfilled' ? cpuInfo.value.cpus : 0,
        cpuModel: cpuInfo.status === 'fulfilled' ? cpuInfo.value.model : '',
        osName: osInfo.status === 'fulfilled' ? osInfo.value.name : 'Unknown OS',
        osVersion: osInfo.status === 'fulfilled' ? osInfo.value.version : '',
        interfaces: interfaces.status === 'fulfilled' ? interfaces.value : [],
        uptime: uptime.status === 'fulfilled' ? uptime.value : 'Unknown',
        diskTotal: diskUsage.status === 'fulfilled' ? diskUsage.value.totalGB : 0,
        diskAvailable: diskUsage.status === 'fulfilled' ? diskUsage.value.availableGB : 0
      }
    }

    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('Error fetching server info:', error)
    return NextResponse.json({ error: 'Failed to fetch server info' }, { status: 500 })
  }
}
