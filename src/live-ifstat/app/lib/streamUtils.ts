export function createStreamResponse(stream: ReadableStream, additionalHeaders: HeadersInit = {}) {
  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      ...additionalHeaders
    }
  });
} 