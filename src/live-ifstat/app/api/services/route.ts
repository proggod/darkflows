import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'
import fs from 'fs/promises'

const execAsync = promisify(exec)
const HIDE_SERVICES_FILE = '/etc/darkflows/hide_services.txt'

interface ServiceData {
  name: string
  enabled: string
  running: boolean
}

async function getHiddenServices(): Promise<Set<string>> {
  try {
    const content = await fs.readFile(HIDE_SERVICES_FILE, 'utf-8')
    return new Set(content.split('\n').map(line => line.trim()).filter(Boolean))
  } catch (error) {
    console.error(`Error reading ${HIDE_SERVICES_FILE}:`, error)
    return new Set()
  }
}

export async function GET() {
  try {
    // Get list of services to hide
    const hiddenServices = await getHiddenServices()

    // Get all services and their enabled status
    let unitFilesOutput = '', runningOutput = ''
    try {
      const unitFiles = await execAsync('systemctl list-unit-files --type=service')
      unitFilesOutput = unitFiles.stdout
    } catch (error) {
      console.error('Error getting unit files:', error)
      unitFilesOutput = ''
    }

    try {
      const running = await execAsync('systemctl list-units --type=service --state=running')
      runningOutput = running.stdout
    } catch (error) {
      console.error('Error getting running services:', error)
      runningOutput = ''
    }
    
    // Parse unit files output to get enabled status
    const unitFileLines = unitFilesOutput.split('\n')
    const startIndex = unitFileLines.findIndex(line => line.includes('UNIT FILE') && line.includes('STATE'))
    const endIndex = unitFileLines.findIndex((line, i) => i > startIndex && line.trim() === '')
    
    // Create a map of service names to their enabled status
    const services = new Map<string, ServiceData>()
    
    if (startIndex !== -1 && endIndex !== -1) {
      unitFileLines.slice(startIndex + 1, endIndex)
        .filter(line => line.trim())
        .forEach(line => {
          const [unitFile, state] = line.trim().split(/\s+/)
          // Only include enabled or disabled services and exclude hidden services
          if ((state === 'enabled' || state === 'disabled')) {
            // Remove .service suffix if present
            const name = unitFile.replace(/\.service$/, '')
            // Skip if service is in the hidden list, starts with systemd-, or ends with @
            if (!hiddenServices.has(name) && !name.startsWith('systemd-') && !name.endsWith('@')) {
              services.set(name, {
                name,
                enabled: state,
                running: false
              })
            }
          }
        })
    }

    // Parse running services output to mark which services are running
    const runningLines = runningOutput.split('\n')
    const runningStartIndex = runningLines.findIndex(line => line.includes('UNIT') && line.includes('LOAD'))
    const runningEndIndex = runningLines.findIndex((line, i) => i > runningStartIndex && line.trim() === '')

    if (runningStartIndex !== -1 && runningEndIndex !== -1) {
      runningLines.slice(runningStartIndex + 1, runningEndIndex)
        .filter(line => line.trim())
        .forEach(line => {
          const [unit] = line.trim().split(/\s+/)
          const name = unit.replace(/\.service$/, '')
          if (services.has(name)) {
            services.get(name)!.running = true
          }
        })
    }

    // Convert map to array and sort by name
    const servicesList = Array.from(services.values())
      .sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json(servicesList)
  } catch (error) {
    console.error('Error fetching services:', error)
    // Return an empty list that won't break the UI
    return NextResponse.json([], { status: 500 })
  }
} 