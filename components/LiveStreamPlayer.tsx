/**
 * LiveStreamPlayer Component
 *
 * HLS video player for viewing live streams.
 * Uses hls.js for browsers without reliable native HLS playback.
 */

'use client'

import React, { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'

interface LiveStreamPlayerProps {
  streamUrl: string | null
  className?: string
}

function normalizeStreamUrl(url: string): string {
  const trimmed = url.trim()
  if (typeof window === 'undefined') return trimmed

  // Avoid mixed-content failures on HTTPS pages.
  if (window.location.protocol === 'https:' && trimmed.startsWith('http://')) {
    return `https://${trimmed.slice('http://'.length)}`
  }

  return trimmed
}

export default function LiveStreamPlayer({ streamUrl, className = '' }: LiveStreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const retryCountRef = useRef(0)
  const maxRetries = 20

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const nextUrl = streamUrl ? normalizeStreamUrl(streamUrl) : null

    if (!nextUrl) {
      setError(null)
      setLoading(false)
      if (hlsRef.current) {
        hlsRef.current.destroy()
        hlsRef.current = null
      }
      return
    }

    let hls: Hls | null = null
    setError(null)
    setLoading(true)
    retryCountRef.current = 0

    const handleCanPlay = () => {
      setError(null)
      setLoading(false)
      retryCountRef.current = 0
      console.log('Video can play, stream URL:', nextUrl)
    }

    const handleError = (e: Event) => {
      const el = e.target as HTMLVideoElement
      const mediaError = el.error
      if (mediaError?.code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED) {
        setError('Stream format not supported or stream not ready yet.')
      } else if (mediaError?.code === MediaError.MEDIA_ERR_NETWORK) {
        setError('Network error. Stream may not be available yet.')
      } else {
        setError('Stream not ready yet. Please wait a moment and retry.')
      }
      setLoading(false)
    }

    const handleLoadStart = () => {
      setLoading(true)
    }

    video.addEventListener('canplay', handleCanPlay)
    video.addEventListener('error', handleError)
    video.addEventListener('loadstart', handleLoadStart)

    // Prefer hls.js first for better Chrome/Edge/Firefox compatibility.
    if (Hls.isSupported()) {
      console.log('Using hls.js for HLS playback')
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
      })

      hls.loadSource(nextUrl)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setError(null)
        setLoading(false)
        video.play().catch(() => {
          // Autoplay can be blocked by browser policy.
        })
      })

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return

        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            retryCountRef.current += 1
            if (retryCountRef.current < maxRetries) {
              hls?.startLoad()
            } else {
              setError('Stream connection failed. Please refresh and try again.')
              setLoading(false)
            }
            break
          case Hls.ErrorTypes.MEDIA_ERROR:
            hls?.recoverMediaError()
            break
          default:
            hls?.destroy()
            setError('Stream playback error. Please try again.')
            setLoading(false)
            break
        }
      })

      hlsRef.current = hls
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      console.log('Using native HLS playback')
      video.src = nextUrl
      video.load()
    } else {
      setError('HLS playback not supported in this browser. Please use Chrome, Firefox, or Safari.')
      setLoading(false)
    }

    return () => {
      video.removeEventListener('canplay', handleCanPlay)
      video.removeEventListener('error', handleError)
      video.removeEventListener('loadstart', handleLoadStart)

      if (hls) {
        hls.destroy()
        hlsRef.current = null
      }
    }
  }, [streamUrl])

  if (!streamUrl) {
    return (
      <div className={`bg-black/50 rounded-xl aspect-video flex items-center justify-center ${className}`}>
        <div className="text-center text-gray-400">
          <p className="text-lg mb-2">Stream is offline</p>
          <p className="text-sm">The livestream will appear here when the creator goes live</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative bg-black rounded-xl overflow-hidden ${className}`}>
      <video
        ref={videoRef}
        className="w-full h-full"
        controls
        playsInline
        muted={false}
        style={{ aspectRatio: '16/9' }}
      />

      {loading && (
        <div className="absolute inset-0 bg-black/70 flex items-center justify-center">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
            <p className="text-white">Loading stream...</p>
          </div>
        </div>
      )}

      {error && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
          <div className="text-center p-4">
            <p className="text-red-400 mb-2">{error}</p>
            <button
              onClick={() => {
                setError(null)
                setLoading(true)
                if (videoRef.current) {
                  videoRef.current.load()
                }
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {!loading && !error && (
        <div className="absolute top-4 left-4 bg-red-600 text-white px-3 py-1 rounded-full flex items-center gap-2 font-bold text-sm">
          <span className="h-2 w-2 rounded-full bg-white animate-pulse"></span>
          LIVE
        </div>
      )}
    </div>
  )
}
