import { NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

interface ServiceData {
  name: string
  enabled: string
  running: boolean
}

export async function GET() {
  try {
    // Get all services and their enabled status
    const { stdout: unitFilesOutput } = await execAsync('systemctl list-unit-files --type=service')
    const { stdout: runningOutput } = await execAsync('systemctl list-units --type=service --state=running')
    
    // Parse unit files output to get enabled status
    const unitFileLines = unitFilesOutput.split('\n')
    const startIndex = unitFileLines.findIndex(line => line.includes('UNIT FILE') && line.includes('STATE'))
    const endIndex = unitFileLines.findIndex((line, i) => i > startIndex && line.trim() === '')
    
    if (startIndex === -1 || endIndex === -1) {
      throw new Error('Invalid systemctl output format')
    }

    // Create a map of service names to their enabled status
    const services = new Map<string, ServiceData>()
    unitFileLines.slice(startIndex + 1, endIndex)
      .filter(line => line.trim())
      .forEach(line => {
        const [unitFile, state] = line.trim().split(/\s+/)
        // Only include enabled or disabled services and exclude systemd- services
        if ((state === 'enabled' || state === 'disabled') && !unitFile.startsWith('systemd-')) {
          // Remove .service suffix if present
          const name = unitFile.replace(/\.service$/, '')
          services.set(name, {
            name,
            enabled: state,
            running: false
          })
        }
      })

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
          // We don't add unknown services anymore since we only want enabled/disabled ones
        })
    }

    // Convert map to array and sort by name
    const servicesList = Array.from(services.values())
      .sort((a, b) => a.name.localeCompare(b.name))

    return NextResponse.json(servicesList)
  } catch (error) {
    console.error('Error fetching services:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred'
    return NextResponse.json({ error: errorMessage }, { status: 500 })
  }
} 