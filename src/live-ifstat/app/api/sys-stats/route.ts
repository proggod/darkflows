import { NextRequest } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  let intervalId: NodeJS.Timeout | null = null;
  let isStreamActive = true;

  // Get total memory once at the start
  let totalMemMB = 0;
  try {
    const { stdout } = await execAsync('free -m');
    const lines = stdout.trim().split('\n');
    for (const line of lines) {
      if (line.startsWith('Mem:')) {
        const parts = line.split(/\s+/);
        totalMemMB = parseInt(parts[1], 10);
        break;
      }
    }
  } catch (err) {
    console.error('Error getting total memory:', err);
  }

  const stream = new ReadableStream({
    start: async (controller) => {
      try {
        // Handle client disconnection
        request.signal.addEventListener('abort', () => {
          console.log('Client disconnected from sys-stats, cleaning up');
          isStreamActive = false;
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
          controller.close();
        });

        // Set up interval for data collection
        intervalId = setInterval(async () => {
          if (!isStreamActive) {
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
            return;
          }

          try {
            // Get memory info
            const { stdout: memInfo } = await execAsync('free -m');
            const memLines = memInfo.trim().split('\n');
            let freeMB = 0;
            for (const line of memLines) {
              if (line.startsWith('Mem:')) {
                const parts = line.split(/\s+/);
                // parts[3] is "free", parts[6] is "available" (includes cache/buffers)
                freeMB = parseInt(parts[6], 10); // Use "available" instead of "free"
                break;
              }
            }

            // Get CPU info - run vmstat with a 1-second delay to get current usage
            const { stdout: cpuInfo } = await execAsync('vmstat 1 2');
            const cpuLines = cpuInfo.trim().split('\n');
            // Get the last line which contains current stats
            const cpuStats = cpuLines[cpuLines.length - 1].trim().split(/\s+/);
            
            // Calculate CPU usage from idle percentage
            // In vmstat output, the 15th column (index 14) is idle CPU percentage
            const idlePercent = parseInt(cpuStats[14], 10);
            const cpuUsage = 100 - idlePercent;

            const percentFree = totalMemMB > 0 ? (freeMB / totalMemMB) * 100 : 0;

            const data = {
              timestamp: new Date().toLocaleTimeString(),
              cpu: cpuUsage,
              memFree: freeMB,
              totalMemMB,
              percentFree,
            };

            // Only send data if the stream is still active
            if (isStreamActive) {
              try {
                // Send data
                controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

                // Send heartbeat every 30 seconds
                if (Date.now() % 30000 < 1000) {
                  controller.enqueue(encoder.encode('event: heartbeat\ndata: {}\n\n'));
                }
              } catch (enqueueError) {
                console.log('Stream closed, stopping sys-stats collection:', enqueueError);
                isStreamActive = false;
                if (intervalId) {
                  clearInterval(intervalId);
                  intervalId = null;
                }
              }
            }
          } catch (error) {
            console.error('Error collecting system stats:', error);
            if (isStreamActive) {
              try {
                controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: String(error) })}\n\n`));
              } catch (enqueueError) {
                console.log('Stream closed during error handling:', enqueueError);
                isStreamActive = false;
                if (intervalId) {
                  clearInterval(intervalId);
                  intervalId = null;
                }
              }
            }
          }
        }, 5000);
      } catch (error) {
        console.error('Stream setup error:', error);
        isStreamActive = false;
        if (intervalId) {
          clearInterval(intervalId);
          intervalId = null;
        }
        controller.error(error);
      }
    },
    cancel: () => {
      console.log('System stats stream cancelled');
      isStreamActive = false;
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  });
}
