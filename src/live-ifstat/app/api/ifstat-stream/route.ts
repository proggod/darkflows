import { NextRequest } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const UPDATE_INTERVAL_MS = 3000; // 1 second
const HEARTBEAT_INTERVAL_MS = 30000; // 30 seconds

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function getNetworkStats(device: string) {
  try {
    const [rxBytes, txBytes] = await Promise.all([
      execAsync(`cat /sys/class/net/${device}/statistics/rx_bytes`),
      execAsync(`cat /sys/class/net/${device}/statistics/tx_bytes`)
    ]);

    return {
      rxBytes: parseInt(rxBytes.stdout.trim(), 10),
      txBytes: parseInt(txBytes.stdout.trim(), 10)
    };
  } catch (error) {
    throw new Error(`Failed to read stats for ${device}: ${error}`);
  }
}

function shouldIncludeInterface(interfaceName: string): boolean {
  // Filter out unwanted interface types
  return !(
    interfaceName.startsWith('docker') ||   // Docker interfaces
    interfaceName.startsWith('veth') ||     // Virtual ethernet
    interfaceName.includes('tailscale')     // Tailscale VPN
  );
}

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  let intervalId: NodeJS.Timeout | null = null;
  let isStreamActive = true;
  const lastStats: { [device: string]: { rxBytes: number; txBytes: number; timestamp: number } } = {};

//  console.log('ifstat-stream: Listing devices');
  // Get list of devices
  const devices: string[] = [];
  try {
    const { stdout } = await execAsync('ls /sys/class/net');
    // Add error handling for empty device list
    const filteredDevices = stdout.trim().split('\n').filter(dev => dev !== 'lo');
    if (filteredDevices.length === 0) {
      return new Response('No valid network devices found', { status: 404 });
    }
    devices.push(...filteredDevices.filter(shouldIncludeInterface));
  } catch (err) {
    console.error('Error getting network devices:', err);
    return new Response('Failed to get network devices', { status: 500 });
  }

//  console.log('New client connected to ifstat-stream');

  const stream = new ReadableStream({
    start: async (controller) => {
      try {
        // Handle client disconnection
        request.signal.addEventListener('abort', () => {
          console.log('Client disconnected, cleaning up');
          isStreamActive = false;
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
          controller.close();
        });

        // Initialize last stats
        for (const device of devices) {
          try {
            const stats = await getNetworkStats(device);
            lastStats[device] = {
              ...stats,
              timestamp: Date.now()
            };
          } catch (error) {
            console.error(`Error initializing stats for ${device}:`, error);
          }
        }

        // Set up interval for data collection
        intervalId = setInterval(async () => {
          if (!isStreamActive) {
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
            return;
          }

          // Collect data for all devices
          for (const device of devices) {
            try {
              const now = Date.now();
              const stats = await getNetworkStats(device);
              const last = lastStats[device];

              if (last) {
                const timeDiff = (now - last.timestamp) / 1000; // Convert to seconds
                const rxDiff = stats.rxBytes - last.rxBytes;
                const txDiff = stats.txBytes - last.txBytes;

                // Calculate KB/s
                const kbIn = (rxDiff / 1024) / timeDiff;
                const kbOut = (txDiff / 1024) / timeDiff;

                if (!isNaN(kbIn) && !isNaN(kbOut)) {
                  const data = {
                    timestamp: new Date().toLocaleTimeString(),
                    kbIn,
                    kbOut,
                    device
                  };

//                  console.log('ifstat-stream: Stream is active');
                  // Only send data if the stream is still active
                  if (isStreamActive) {
                    try {
                      // Send data
                      controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
  //                    console.log(`ifstat-stream: Sending data: ${JSON.stringify(data)}`);

                    } catch (error) {
                      console.log(`Stream closed, stopping data collection:`, error);
                      isStreamActive = false;
                      if (intervalId) {
                        clearInterval(intervalId);
                        intervalId = null;
                      }
                      return;
                    }
                  }
                }
              }

              // Update last stats
              lastStats[device] = {
                ...stats,
                timestamp: now
              };
            } catch (error) {
              console.error(`Error collecting data for ${device}:`, error);
              if (isStreamActive) {
                try {
                  controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: String(error), device })}\n\n`));
                } catch (enqueueError) {
                  console.log('Stream closed during error handling:', enqueueError);
                  isStreamActive = false;
                  if (intervalId) {
                    clearInterval(intervalId);
                    intervalId = null;
                  }
                  return;
                }
              }
            }
          }

          // Send heartbeat every 30 seconds - more precise check
          const timeSinceLastHeartbeat = Date.now() % HEARTBEAT_INTERVAL_MS;
          if (isStreamActive && timeSinceLastHeartbeat < UPDATE_INTERVAL_MS) {
            try {
              controller.enqueue(encoder.encode('event: heartbeat\ndata: {}\n\n'));
            } catch (enqueueError) {
              console.log('Stream closed during heartbeat:', enqueueError);
              isStreamActive = false;
              if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
              }
            }
          }
        }, UPDATE_INTERVAL_MS);
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
      console.log('Stream cancelled');
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
      'X-Accel-Buffering': 'no'  // This is critical for Nginx
    }
  });
}
