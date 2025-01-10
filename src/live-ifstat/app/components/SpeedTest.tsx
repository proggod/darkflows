'use client'

import { useState } from 'react'

interface SpeedTestResult {
  download: number
  upload: number
  idleLatency: number
  jitterDown: number
  jitterUp: number
  jitterIdle: number
  packetLoss: number
  serverName: string
  isp: string
  resultUrl: string
  status: string
}

export default function SpeedTest() {
  const [result, setResult] = useState<SpeedTestResult | null>(null)
  const [status, setStatus] = useState<string>('idle')
  const [error, setError] = useState<string | null>(null)

  const runSpeedTest = async () => {
    try {
      setStatus('running')
      setError(null)
      
      const eventSource = new EventSource('/api/speedtest')
      
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data)
        if (data.status) {
          setStatus(data.status)
        }
        if (data.result) {
          setResult(data.result)
          eventSource.close()
          setStatus('complete')
        }
        if (data.error) {
          throw new Error(data.error)
        }
      }

      eventSource.onerror = () => {
        if (status === 'running') {
          eventSource.close()
          setError('Connection lost - check server logs')
          setStatus('error')
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run speed test')
      setStatus('error')
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 h-full">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-gray-900">Network Speed Test</h2>
        <button
          onClick={runSpeedTest}
          disabled={status !== 'idle' && status !== 'complete' && status !== 'error'}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {status === 'idle' || status === 'complete' || status === 'error' ? 'Run Test' : 'Running Test...'}
        </button>
      </div>

      {status !== 'idle' && status !== 'complete' && status !== 'error' && (
        <div className="text-sm text-gray-600 mb-4">
          {status}
        </div>
      )}

      {error && (
        <div className="text-sm text-red-600 mb-4">
          Error: {error}
        </div>
      )}

      {result && (
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-gray-600">Download</p>
            <p className="text-xl font-bold text-gray-900">{result.download.toFixed(2)} Mbps</p>
            <p className="text-xs text-gray-500">Jitter: {result.jitterDown}ms</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-gray-600">Upload</p>
            <p className="text-xl font-bold text-gray-900">{result.upload.toFixed(2)} Mbps</p>
            <p className="text-xs text-gray-500">Jitter: {result.jitterUp}ms</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-gray-600">Latency</p>
            <p className="text-xl font-bold text-gray-900">{result.idleLatency.toFixed(2)} ms</p>
            <p className="text-xs text-gray-500">Jitter: {result.jitterIdle}ms</p>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <p className="text-gray-600">Packet Loss</p>
            <p className="text-xl font-bold text-gray-900">{result.packetLoss.toFixed(2)}%</p>
          </div>
          <div className="col-span-2 bg-gray-50 p-3 rounded-lg">
            <div className="flex justify-between text-sm">
              <div>
                <p className="text-gray-600">Server</p>
                <p className="text-gray-900">{result.serverName}</p>
              </div>
              <div>
                <p className="text-gray-600">ISP</p>
                <p className="text-gray-900">{result.isp}</p>
              </div>
            </div>
            {result.resultUrl && (
              <a
                href={result.resultUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 text-xs mt-2 inline-block"
              >
                View Details →
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  )
} 