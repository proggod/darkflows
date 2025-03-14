import { NextResponse, NextRequest } from 'next/server'
import { spawn } from 'child_process'
import { requireAuth } from '../../lib/auth'

// Add GET handler for SSE
export async function GET(request: NextRequest) {
  const authError = await requireAuth(request)
  if (authError) return authError
  
  return new NextResponse(new ReadableStream({
    async start(controller) {
      try {
        // Use the SpeedTest++ CLI tool
        const speedtest = spawn('/usr/local/bin/SpeedTest', [])
        let buffer = ''
        let currentPhase = 'Initializing'
        let ipInfo = null
        let serverInfo = null
        let pingInfo = null
        let jitterInfo = null
        let downloadInfo = null
        let uploadInfo = null
        
        // Progress tracking
        let downloadDots = 0
        let uploadDots = 0
        const totalDownloadDots = 200 // Approximate based on example output
        const totalUploadDots = 35 // Approximate based on example output

        // Send initial status
        controller.enqueue('data: {"phase": "Initializing test..."}\n\n')

        speedtest.stdout.on('data', (data) => {
          const output = data.toString()
          buffer += output
          
          // Count dots for progress tracking
          if (currentPhase === 'Testing download speed') {
            const dots = (output.match(/\./g) || []).length
            downloadDots += dots
            const progressPercent = Math.min((downloadDots / totalDownloadDots) * 100, 100)
            controller.enqueue(`data: ${JSON.stringify({ 
              phase: currentPhase,
              progressPercent
            })}\n\n`)
          } else if (currentPhase === 'Testing upload speed') {
            const dots = (output.match(/\./g) || []).length
            uploadDots += dots
            const progressPercent = Math.min((uploadDots / totalUploadDots) * 100, 100)
            controller.enqueue(`data: ${JSON.stringify({ 
              phase: currentPhase,
              progressPercent
            })}\n\n`)
          }
          
          // Parse the output line by line
          const lines = output.split('\n')
          
          for (const line of lines) {
            // IP and location information
            if (line.includes('IP:')) {
              const ipMatch = line.match(/IP: "([^"]+)" \("([^"]+)"\) Location: \[([^,]+), ([^\]]+)\]/)
              if (ipMatch) {
                const [_, ip, isp, lat, lon] = ipMatch
                ipInfo = { ip, isp, location: [parseFloat(lat), parseFloat(lon)] }
                controller.enqueue(`data: ${JSON.stringify({ 
                  phase: "Detected IP and location",
                  ip,
                  isp,
                  location: [parseFloat(lat), parseFloat(lon)]
                })}\n\n`)
              }
            }
            
            // Finding server phase
            else if (line.includes('Finding fastest server')) {
              currentPhase = 'Finding fastest server'
              controller.enqueue(`data: ${JSON.stringify({ phase: currentPhase })}\n\n`)
            }
            
            // Server information
            else if (line.includes('Server:')) {
              const serverMatch = line.match(/Server: ([^:]+):(\d+) by ([^(]+) \(([^)]+) km from you\): (\d+) ms/)
              if (serverMatch) {
                const [_, location, port, provider, distance, ping] = serverMatch
                serverInfo = { 
                  serverName: `${location} (${provider})`,
                  location,
                  distance: parseFloat(distance),
                  ping: parseInt(ping)
                }
                controller.enqueue(`data: ${JSON.stringify({ 
                  phase: "Selected server",
                  server: `${location} (${provider})`,
                  distance: parseFloat(distance),
                  ping: parseInt(ping)
                })}\n\n`)
              }
            }
            
            // Ping information
            else if (line.includes('Ping:')) {
              currentPhase = 'Testing ping'
              const pingMatch = line.match(/Ping: (\d+) ms/)
              if (pingMatch) {
                const [_, ping] = pingMatch
                pingInfo = { ping: parseInt(ping) }
                controller.enqueue(`data: ${JSON.stringify({ 
                  phase: currentPhase,
                  ping: parseInt(ping)
                })}\n\n`)
              }
            }
            
            // Jitter information
            else if (line.includes('Jitter:')) {
              const jitterMatch = line.match(/Jitter: (\d+) ms/)
              if (jitterMatch) {
                const [_, jitter] = jitterMatch
                jitterInfo = { jitter: parseInt(jitter) }
                controller.enqueue(`data: ${JSON.stringify({ 
                  phase: "Measuring jitter",
                  jitter: parseInt(jitter)
                })}\n\n`)
              }
            }
            
            // Line type determination
            else if (line.includes('Determine line type')) {
              currentPhase = 'Determining line type'
              controller.enqueue(`data: ${JSON.stringify({ phase: currentPhase })}\n\n`)
            }
            
            // Download test
            else if (line.includes('Testing download speed')) {
              currentPhase = 'Testing download speed'
              downloadDots = 0 // Reset counter
              controller.enqueue(`data: ${JSON.stringify({ phase: currentPhase, progressPercent: 0 })}\n\n`)
            }
            
            // Download result
            else if (line.includes('Download:')) {
              const downloadMatch = line.match(/Download: ([0-9.]+) Mbit\/s/)
              if (downloadMatch) {
                const [_, download] = downloadMatch
                downloadInfo = { download: parseFloat(download) }
                controller.enqueue(`data: ${JSON.stringify({ 
                  phase: "Download completed",
                  download: parseFloat(download),
                  progressPercent: 100
                })}\n\n`)
              }
            }
            
            // Upload test
            else if (line.includes('Testing upload speed')) {
              currentPhase = 'Testing upload speed'
              uploadDots = 0 // Reset counter
              controller.enqueue(`data: ${JSON.stringify({ phase: currentPhase, progressPercent: 0 })}\n\n`)
            }
            
            // Upload result
            else if (line.includes('Upload:')) {
              const uploadMatch = line.match(/Upload: ([0-9.]+) Mbit\/s/)
              if (uploadMatch) {
                const [_, upload] = uploadMatch
                uploadInfo = { upload: parseFloat(upload) }
                controller.enqueue(`data: ${JSON.stringify({ 
                  phase: "Upload completed",
                  upload: parseFloat(upload),
                  progressPercent: 100
                })}\n\n`)
              }
            }
          }
        })

        speedtest.stderr.on('data', (data) => {
          const errorData = data.toString()
          controller.enqueue(`data: {"error": "${errorData.replace(/"/g, '\\"')}"}\n\n`)
        })

        speedtest.on('error', (error) => {
          controller.enqueue(`data: {"error": "${error.message.replace(/"/g, '\\"')}"}\n\n`)
          controller.close()
        })

        speedtest.on('close', (code) => {
          if (code === 0) {
            // Combine all the collected information
            const result = {
              ...ipInfo,
              ...serverInfo,
              ...pingInfo,
              ...jitterInfo,
              ...downloadInfo,
              ...uploadInfo,
              complete: true
            }
            controller.enqueue(`data: ${JSON.stringify(result)}\n\n`)
          } else {
            controller.enqueue(`data: {"error": "Test failed with code ${code}"}\n\n`)
          }
          controller.close()
        })
      } catch (error) {
        controller.enqueue(`data: {"error": "Startup failed: ${error.message.replace(/"/g, '\\"')}"}\n\n`)
        controller.close()
      }
    }
  }), {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}

// Modify POST to just return success
export async function POST(request: NextRequest) {
  const authResponse = await requireAuth(request)
  if (authResponse) return authResponse

  return NextResponse.json({ success: true })
} 