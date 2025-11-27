'use client'

import React, { useEffect, useState } from 'react'

export interface StreamInfo {
  streamId: string
  ingestUrl: string
  streamKey: string
  playbackUrl: string
}

interface LiveStreamControlsProps {
  onStreamStart: (info: StreamInfo) => void
  onStreamStop: () => void
}

export default function LiveStreamControls({
  onStreamStart,
  onStreamStop,
}: LiveStreamControlsProps) {
  const [isLive, setIsLive] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [streamInfo, setStreamInfo] = useState<StreamInfo | null>(null)
  const [startedAt, setStartedAt] = useState<Date | null>(null)
  const [elapsed, setElapsed] = useState<string>('00:00')

  useEffect(() => {
    let timer: NodeJS.Timeout | undefined

    if (isLive && startedAt) {
      timer = setInterval(() => {
        const diff = Date.now() - startedAt.getTime()
        const totalSeconds = Math.floor(diff / 1000)
        const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0')
        const seconds = String(totalSeconds % 60).padStart(2, '0')
        setElapsed(`${minutes}:${seconds}`)
      }, 1000)
    } else {
      setElapsed('00:00')
    }

    return () => {
      if (timer) clearInterval(timer)
    }
  }, [isLive, startedAt])

  async function handleStart() {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/livestream/start', {
        method: 'POST',
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to start livestream')
      }

      const info: StreamInfo = {
        streamId: data.streamId,
        ingestUrl: data.ingestUrl,
        streamKey: data.streamKey,
        playbackUrl: data.playbackUrl,
      }

      setStreamInfo(info)
      setIsLive(true)
      setStartedAt(new Date())
      onStreamStart(info)
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleStop() {
    if (!streamInfo) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/livestream/stop', {
        method: 'POST',
        body: JSON.stringify({ streamId: streamInfo.streamId }),
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to stop livestream')
      }

      setIsLive(false)
      setStartedAt(null)
      setStreamInfo(null)
      onStreamStop()
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  function copy(text: string) {
    navigator.clipboard.writeText(text).catch(() => {})
  }

  return (
    <div className="w-full space-y-4">
      {/* Status + timer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`h-3 w-3 rounded-full ${
              isLive ? 'bg-red-500 animate-pulse' : 'bg-gray-400'
            }`}
          />
          <span className="text-sm font-medium text-white">
            {isLive ? 'Live' : 'Offline'}
          </span>
          {isLive && (
            <span className="ml-3 text-xs text-gray-400">
              Duration: {elapsed}
            </span>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleStart}
            disabled={isLive || isLoading}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
              isLive || isLoading
                ? 'bg-gray-700 cursor-not-allowed'
                : 'bg-green-600 hover:bg-green-500'
            }`}
          >
            {isLoading && !isLive ? 'Starting…' : 'Start Live Stream'}
          </button>
          <button
            onClick={handleStop}
            disabled={!isLive || isLoading}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white transition-colors ${
              !isLive || isLoading
                ? 'bg-gray-700 cursor-not-allowed'
                : 'bg-red-600 hover:bg-red-500'
            }`}
          >
            {isLoading && isLive ? 'Stopping…' : 'End Livestream'}
          </button>
        </div>
      </div>

      {/* Stream info for OBS */}
      {streamInfo && (
        <div className="rounded-xl border border-gray-700 bg-black/30 p-4 space-y-3">
          <div className="bg-blue-950/40 border border-blue-800 rounded-lg p-3 mb-2">
            <p className="text-xs text-blue-300 font-medium mb-1">📺 Next Steps:</p>
            <p className="text-xs text-blue-200">
              Copy the settings below to OBS, then start streaming. The video player will automatically load once your stream is active.
            </p>
          </div>
          <div className="text-xs text-gray-400">
            Use these details in OBS / streaming software:
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs text-gray-400">Ingest URL</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-black/60 px-3 py-2 text-xs break-all text-white">
                {streamInfo.ingestUrl}
              </code>
              <button
                onClick={() =>
                  copy(`${streamInfo.ingestUrl}/${streamInfo.streamKey}`)
                }
                className="text-xs px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors"
              >
                Copy full URL
              </button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs text-gray-400">Stream Key</label>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-black/60 px-3 py-2 text-xs break-all text-white">
                {streamInfo.streamKey}
              </code>
              <button
                onClick={() => copy(streamInfo.streamKey)}
                className="text-xs px-3 py-2 rounded-lg bg-gray-800 hover:bg-gray-700 text-white transition-colors"
              >
                Copy key
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="text-xs text-red-400 bg-red-950/40 border border-red-900 px-3 py-2 rounded-lg">
          {error}
        </div>
      )}
    </div>
  )
}

