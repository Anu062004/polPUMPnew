/**
 * TokenLiveStreamControls Component
 * 
 * Creator-only controls for starting/stopping live streams.
 * Shows RTMP URL and stream key for OBS setup.
 */

'use client'

import React, { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { Copy, Check, Video, VideoOff, Loader2 } from 'lucide-react'

export interface TokenStreamInfo {
  tokenAddress: string
  streamKey: string
  ingestUrl: string // RTMP base URL
  playbackUrl: string // HLS playback URL
}

interface TokenLiveStreamControlsProps {
  tokenAddress: string
  tokenCreator: string | null
  onStreamStart?: (info: TokenStreamInfo) => void
  onStreamStop?: () => void
}

export default function TokenLiveStreamControls({
  tokenAddress,
  tokenCreator,
  onStreamStart,
  onStreamStop,
}: TokenLiveStreamControlsProps) {
  const { address: userAddress, isConnected } = useAccount()
  const [isLive, setIsLive] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [streamInfo, setStreamInfo] = useState<TokenStreamInfo | null>(null)
  const [startedAt, setStartedAt] = useState<Date | null>(null)
  const [elapsed, setElapsed] = useState<string>('00:00')
  const [copied, setCopied] = useState<{ [key: string]: boolean }>({})

  // Check if current user is the creator
  const isCreator = isConnected && userAddress && tokenCreator &&
    userAddress.toLowerCase() === tokenCreator.toLowerCase()

  // Update elapsed time
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

  // Check stream status periodically
  useEffect(() => {
    if (!tokenAddress || !isCreator) return

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/stream/status?tokenAddress=${encodeURIComponent(tokenAddress)}`)
        if (!res.ok) return
        
        const data = await res.json()
        if (data.success) {
          setIsLive(data.isLive || false)
          if (data.isLive && data.playbackUrl && !streamInfo) {
            // Update stream info if we have it
            setStreamInfo({
              tokenAddress: data.tokenAddress || tokenAddress,
              streamKey: data.streamKey || '',
              ingestUrl: '',
              playbackUrl: data.playbackUrl,
            })
          }
        }
      } catch (e) {
        // Silently fail
      }
    }

    checkStatus()
    const interval = setInterval(checkStatus, 5000) // Check every 5 seconds
    return () => clearInterval(interval)
  }, [tokenAddress, isCreator, streamInfo])

  // Copy to clipboard helper
  const copyToClipboard = async (text: string, key: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied({ ...copied, [key]: true })
      setTimeout(() => {
        setCopied({ ...copied, [key]: false })
      }, 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Start stream
  async function handleStart() {
    if (!isConnected || !userAddress) {
      setError('Please connect your wallet')
      return
    }

    if (!isCreator) {
      setError('Only the token creator can start a livestream')
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stream/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenAddress,
          creatorAddress: userAddress,
        }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to start livestream')
      }

      const info: TokenStreamInfo = {
        tokenAddress: data.tokenAddress,
        streamKey: data.streamKey,
        ingestUrl: data.ingestUrl || data.rtmpUrl || '',
        playbackUrl: data.playbackUrl,
      }

      setStreamInfo(info)
      setIsLive(true)
      setStartedAt(new Date())
      onStreamStart?.(info)
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  // Stop stream
  async function handleStop() {
    if (!isConnected || !userAddress) {
      setError('Please connect your wallet')
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/stream/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tokenAddress,
          creatorAddress: userAddress,
        }),
      })
      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to stop livestream')
      }

      setIsLive(false)
      setStreamInfo(null)
      setStartedAt(null)
      onStreamStop?.()
    } catch (e: any) {
      setError(e.message || 'Something went wrong')
    } finally {
      setIsLoading(false)
    }
  }

  // Don't render if not creator
  if (!isCreator) {
    return null
  }

  return (
    <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border-2 border-purple-400 rounded-2xl p-6 shadow-[0_0_30px_rgba(168,85,247,0.4)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Video className="w-5 h-5" />
          Live Stream Controls
        </h3>
        {isLive && (
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-500 animate-pulse"></span>
            <span className="text-red-400 font-bold">LIVE</span>
            <span className="text-gray-400 text-sm">{elapsed}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-300 text-sm">
          {error}
        </div>
      )}

      {!isLive ? (
        <div className="space-y-4">
          <p className="text-gray-300 text-sm">
            Start a live stream to engage with your token community. You'll get RTMP settings for OBS Studio.
          </p>
          <button
            onClick={handleStart}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Starting...
              </>
            ) : (
              <>
                <Video className="w-5 h-5" />
                Start Live Stream
              </>
            )}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="bg-black/30 rounded-lg p-4 space-y-3">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                RTMP Server (for OBS)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={streamInfo?.ingestUrl || 'rtmp://localhost:1935/live'}
                  className="flex-1 bg-gray-800 text-white px-3 py-2 rounded border border-gray-600 font-mono text-sm"
                />
                <button
                  onClick={() => copyToClipboard(streamInfo?.ingestUrl || 'rtmp://localhost:1935/live', 'rtmp')}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                >
                  {copied.rtmp ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Stream Key (for OBS)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={streamInfo?.streamKey || ''}
                  className="flex-1 bg-gray-800 text-white px-3 py-2 rounded border border-gray-600 font-mono text-sm"
                />
                <button
                  onClick={() => copyToClipboard(streamInfo?.streamKey || '', 'key')}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                >
                  {copied.key ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="bg-blue-500/20 border border-blue-400 rounded-lg p-4">
            <h4 className="font-semibold text-blue-300 mb-2">📺 OBS Studio Setup:</h4>
            <ol className="text-sm text-blue-200 space-y-1 list-decimal list-inside">
              <li>Open OBS Studio → Settings → Stream</li>
              <li>Service: <strong>Custom</strong></li>
              <li>Server: Copy the RTMP Server above</li>
              <li>Stream Key: Copy the Stream Key above</li>
              <li>Click &quot;Start Streaming&quot; in OBS</li>
            </ol>
          </div>

          <button
            onClick={handleStop}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Stopping...
              </>
            ) : (
              <>
                <VideoOff className="w-5 h-5" />
                End Live Stream
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
