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
  // We'll use `ip link` to list interfaces, then `ethtool` to get speed if available
  const { stdout } = await execAsync('ip link')
  // ip link output looks like:
  // 1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 ...
  // 2: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1500 ...
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
      // ethtool output might contain: "Speed: 1000Mb/s"
      const speedLine = stdout.split('\n').find(l => l.includes('Speed:'))
      if (speedLine) {
        iface.speed = speedLine.split(':')[1].trim()
      } else {
        iface.speed = 'Unknown'
      }
    } catch {
      iface.speed = 'Unknown'
    }
  }

  return interfaces
}

export async function GET() {
  try {
    const [totalMemMB, cpuInfo, osInfo, netIfaces] = await Promise.all([
      getMemoryInfo(),
      getCPUInfo(),
      getOSInfo(),
      getNetworkInterfaces()
    ])

    const data = {
      totalMemMB,
      cpus: cpuInfo.cpus,
      cpuModel: cpuInfo.model,
      osName: osInfo.name,
      osVersion: osInfo.version,
      interfaces: netIfaces
    }

    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('Error fetching server info:', error)
    return NextResponse.json({ error: 'Failed to fetch server info' }, { status: 500 })
  }
}
