import { NextResponse } from 'next/server'
import { spawn } from 'child_process'

// Add GET handler for SSE
export async function GET() {
  console.log('=== SPEEDTEST START ===')
  
  return new NextResponse(new ReadableStream({
    async start(controller) {
      try {
        const speedtest = spawn('speedtest', [
          '--accept-license', 
          '--format=json'
        ])
        let buffer = ''

        controller.enqueue('data: {"status": "Starting speed test..."}\n\n')

        speedtest.stdout.on('data', (data) => {
          buffer += data.toString()
        })

        speedtest.stderr.on('data', (data) => {
          const errorData = data.toString()
          try {
            const parsed = JSON.parse(errorData)
            if (parsed.type === 'log' && parsed.level === 'error') {
              console.log('Speedtest error:', parsed.message)
              if (!parsed.message.includes('Timeout occurred')) {
                controller.enqueue(`data: {"error": "${parsed.message}"}\n\n`)
                controller.close()
              }
            }
          } catch {
            console.log('Speedtest stderr:', errorData)
          }
        })

        speedtest.on('error', (error) => {
          console.log('Speedtest error:', error.message)
          controller.enqueue(`data: {"error": "${error.message}"}\n\n`)
          controller.close()
        })

        speedtest.on('close', (code) => {
          console.log('Speedtest exit code:', code)
          
          if (code === 0 && buffer) {
            try {
              const rawResult = JSON.parse(buffer)
              const result = {
                download: rawResult.download.bandwidth * 8 / 1000000, // Convert to Mbps
                upload: rawResult.upload.bandwidth * 8 / 1000000,
                idleLatency: rawResult.ping.latency,
                jitterDown: rawResult.download.latency.jitter,
                jitterUp: rawResult.upload.latency.jitter,
                jitterIdle: rawResult.ping.jitter,
                packetLoss: rawResult.packetLoss,
                serverName: `${rawResult.server.name} - ${rawResult.server.location}`,
                isp: rawResult.isp,
                resultUrl: rawResult.result.url
              }
              controller.enqueue(`data: {"result": ${JSON.stringify(result)}}\n\n`)
            } catch (err) {
              console.log('Parse error:', err)
              controller.enqueue(`data: {"error": "Parse failed"}\n\n`)
            }
          } else {
            controller.enqueue(`data: {"error": "Test failed"}\n\n`)
          }
          console.log('=== SPEEDTEST END ===')
          controller.close()
        })
      } catch (err) {
        console.log('Startup error:', err)
        controller.enqueue(`data: {"error": "Startup failed"}\n\n`)
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
export async function POST() {
  return NextResponse.json({ success: true })
} 