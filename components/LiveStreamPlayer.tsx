/**
 * LiveStreamPlayer Component
 * 
 * HLS video player for viewing live streams.
 * Uses hls.js for browsers that don't support native HLS.
 */

'use client'

import React, { useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'

interface LiveStreamPlayerProps {
  streamUrl: string | null
  className?: string
}

export default function LiveStreamPlayer({ streamUrl, className = '' }: LiveStreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const hlsRef = useRef<Hls | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const retryCountRef = useRef(0)
  const maxRetries = 10 // Retry for up to ~50 seconds

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    
    if (!streamUrl) {
      setError(null)
      setLoading(false)
      // Clean up existing HLS instance
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
      console.log('✅ Video can play, stream URL:', streamUrl)
    }

    const handleError = (e: Event) => {
      const video = e.target as HTMLVideoElement
      if (video.error) {
        switch (video.error.code) {
          case video.error.MEDIA_ERR_SRC_NOT_SUPPORTED:
            setError('Stream format not supported or stream not ready yet.')
            break
          case video.error.MEDIA_ERR_NETWORK:
            setError('Network error. Stream may not be available yet.')
            break
          default:
            setError('Stream not ready. Start broadcasting from OBS to begin the stream.')
        }
      } else {
        setError('Stream not ready. Start broadcasting from OBS to begin the stream.')
      }
      setLoading(false)
    }

    const handleLoadStart = () => {
      console.log('📺 Video loading started:', streamUrl)
      setLoading(true)
    }

    video.addEventListener('canplay', handleCanPlay)
    video.addEventListener('error', handleError)
    video.addEventListener('loadstart', handleLoadStart)

    // Safari / iOS can play HLS directly
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      console.log('🍎 Using native HLS support (Safari/iOS)')
      video.src = streamUrl
      video.load()
    } else if (Hls.isSupported()) {
      // Other browsers use hls.js
      console.log('🌐 Using hls.js for HLS playback')
      hls = new Hls({
        enableWorker: true,
        lowLatencyMode: true,
        backBufferLength: 90,
        maxBufferLength: 30,
        maxMaxBufferLength: 60,
        xhrSetup: (xhr, url) => {
          // Handle CORS if needed
          xhr.withCredentials = false
        },
      })

      hls.loadSource(streamUrl)
      hls.attachMedia(video)

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log('✅ HLS manifest parsed, starting playback')
        video.play().catch((err) => {
          console.warn('Auto-play prevented:', err)
          setError('Click to play (autoplay blocked)')
        })
      })

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn('⚠️ Network error, retrying...', retryCountRef.current)
              retryCountRef.current++
              if (retryCountRef.current < maxRetries) {
                hls?.startLoad()
              } else {
                setError('Stream connection failed. Please refresh the page.')
                setLoading(false)
              }
              break
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('⚠️ Media error, recovering...')
              hls?.recoverMediaError()
              break
            default:
              console.error('❌ Fatal HLS error:', data)
              hls?.destroy()
              setError('Stream playback error. Please try again.')
              setLoading(false)
              break
          }
        }
      })

      hlsRef.current = hls
    } else {
      setError('HLS playback not supported in this browser. Please use Chrome, Firefox, or Safari.')
      setLoading(false)
    }

    // Cleanup
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
