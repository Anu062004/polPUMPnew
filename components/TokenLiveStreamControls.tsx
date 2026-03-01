/**
 * TokenLiveStreamControls Component
 *
 * Creator-only browser livestream controls powered by AWS IVS Web Broadcast SDK.
 * No OBS required.
 */

'use client'

import React, { useEffect, useRef, useState } from 'react'
import { useAccount } from 'wagmi'
import { useAuth } from '../app/providers/AuthContext'
import { Copy, Check, Video, VideoOff, Loader2, Camera, Mic } from 'lucide-react'

export interface TokenStreamInfo {
  tokenAddress: string
  streamKey: string
  ingestUrl: string
  ingestEndpoint?: string
  playbackUrl: string
  provider?: string
  channelType?: string
}

interface TokenLiveStreamControlsProps {
  tokenAddress: string
  tokenCreator: string | null
  onStreamStart?: (info: TokenStreamInfo) => void
  onStreamStop?: () => void
  onLocalPreviewChange?: (stream: MediaStream | null, source: 'camera' | 'screen') => void
}

declare global {
  interface Window {
    IVSBroadcastClient?: any
  }
}

const IVS_BROADCAST_SDK_URLS = [
  process.env.NEXT_PUBLIC_IVS_BROADCAST_SDK_URL,
  'https://web-broadcast.live-video.net/1.30.0/amazon-ivs-web-broadcast.js',
  'https://web-broadcast.live-video.net/1.29.0/amazon-ivs-web-broadcast.js',
  'https://cdn.jsdelivr.net/npm/amazon-ivs-web-broadcast@latest/dist/amazon-ivs-web-broadcast.js',
].filter(Boolean) as string[]

const PRIMARY_VIDEO_INPUT_NAME = 'primary-video'
const PRIMARY_AUDIO_INPUT_NAME = 'primary-audio'

function isSecureBrowserContext(): boolean {
  if (typeof window === 'undefined') return false
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  return window.isSecureContext || isLocalhost
}

function resolveStreamConfig(IVSBroadcastClient: any, channelType?: string | null) {
  const normalized = String(channelType || '').toUpperCase()
  if (normalized === 'STANDARD' || normalized === 'ADVANCED_HD') {
    return IVSBroadcastClient.STANDARD_LANDSCAPE || IVSBroadcastClient.BASIC_LANDSCAPE
  }
  return IVSBroadcastClient.BASIC_LANDSCAPE || IVSBroadcastClient.STANDARD_LANDSCAPE
}

function normalizeIvsIngestEndpoint(input: unknown): string {
  const raw = String(input || '').trim()
  if (!raw) return ''

  const withoutScheme = raw.replace(/^[a-z]+:\/\//i, '')
  const [hostPort = ''] = withoutScheme.split('/')
  const host = hostPort.split(':')[0]?.trim()
  return host || ''
}

function extractErrorMessage(error: any): string {
  if (!error) return ''
  if (typeof error === 'string') return error
  if (typeof error?.message === 'string' && error.message.trim()) return error.message.trim()
  if (typeof error?.error === 'string' && error.error.trim()) return error.error.trim()
  return ''
}

function formatStartError(error: any): string {
  if (error?.name === 'NotAllowedError') {
    return 'Camera/mic permission denied. Allow access and try again.'
  }
  if (error?.name === 'NotFoundError') {
    return 'No camera or microphone found on this device.'
  }
  if (error?.name === 'NotReadableError') {
    return 'Camera or microphone is already in use by another app.'
  }
  if (error?.name === 'OverconstrainedError') {
    return 'Your current camera/mic settings are not supported on this device.'
  }

  return extractErrorMessage(error) || 'Something went wrong while starting livestream'
}

async function loadIvsBroadcastSdk(): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('Browser environment required for livestream broadcast')
  }

  if (window.IVSBroadcastClient) {
    return window.IVSBroadcastClient
  }

  const existing = document.getElementById('ivs-broadcast-sdk') as HTMLScriptElement | null
  if (existing) {
    await new Promise<void>((resolve, reject) => {
      if (window.IVSBroadcastClient) {
        resolve()
        return
      }
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('Failed to load IVS broadcast SDK')), {
        once: true,
      })
    })
    if (!window.IVSBroadcastClient) {
      throw new Error('IVS broadcast SDK loaded but global client is unavailable')
    }
    return window.IVSBroadcastClient
  }

  let loadError: Error | null = null
  for (const sdkUrl of IVS_BROADCAST_SDK_URLS) {
    const script = document.createElement('script')
    script.id = 'ivs-broadcast-sdk'
    script.src = sdkUrl
    script.async = true

    try {
      await new Promise<void>((resolve, reject) => {
        script.onload = () => resolve()
        script.onerror = () => reject(new Error(`Failed to load IVS broadcast SDK from ${sdkUrl}`))
        document.head.appendChild(script)
      })

      if (window.IVSBroadcastClient) {
        return window.IVSBroadcastClient
      }
    } catch (error: any) {
      loadError = error
      script.remove()
      const stale = document.getElementById('ivs-broadcast-sdk')
      if (stale) stale.removeAttribute('id')
    }
  }

  throw loadError || new Error('IVS broadcast SDK is unavailable in this browser')
}

export default function TokenLiveStreamControls({
  tokenAddress,
  tokenCreator,
  onStreamStart,
  onStreamStop,
  onLocalPreviewChange,
}: TokenLiveStreamControlsProps) {
  const { address: userAddress, isConnected } = useAccount()
  const { user, accessToken, refreshAuth } = useAuth()

  const [isLive, setIsLive] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [streamInfo, setStreamInfo] = useState<TokenStreamInfo | null>(null)
  const [startedAt, setStartedAt] = useState<Date | null>(null)
  const [elapsed, setElapsed] = useState<string>('00:00')
  const [copied, setCopied] = useState<{ [key: string]: boolean }>({})
  const [isSharingScreen, setIsSharingScreen] = useState(false)
  const [isSwitchingVideoSource, setIsSwitchingVideoSource] = useState(false)
  const [videoSource, setVideoSource] = useState<'camera' | 'screen'>('camera')
  const [localPreviewStream, setLocalPreviewStream] = useState<MediaStream | null>(null)

  const previewVideoRef = useRef<HTMLVideoElement | null>(null)
  const previewStreamRef = useRef<MediaStream | null>(null)
  const isMountedRef = useRef(true)
  const broadcastClientRef = useRef<any>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const videoCompositionRef = useRef<{ index: number; x: number; y: number; width: number; height: number }>({
    index: 0,
    x: 0,
    y: 0,
    width: 1280,
    height: 720,
  })

  const creatorByRole = user?.role === 'CREATOR'
  const creatorWalletMatches = !tokenCreator || !userAddress || userAddress.toLowerCase() === tokenCreator.toLowerCase()
  const isCreator = isConnected && !!userAddress && creatorByRole && creatorWalletMatches

  const getAccessTokenFromStorage = () => {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem('polpump_access_token')
  }

  const parseResponseData = async (response: Response) => {
    const contentType = response.headers.get('content-type') || ''
    if (contentType.toLowerCase().includes('application/json')) {
      return (await response.json().catch(() => ({}))) as Record<string, any>
    }

    const text = await response.text().catch(() => '')
    const trimmed = text.trim()
    if (!trimmed) return {}

    try {
      return JSON.parse(trimmed)
    } catch {
      if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html')) {
        return { error: 'Server returned a non-JSON response. Check API server logs.' }
      }
      return { error: trimmed.slice(0, 240) }
    }
  }

  const postWithAuthRetry = async (url: string, payload: Record<string, any>) => {
    const makeRequest = (token: string | null) =>
      fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      })

    let response = await makeRequest(accessToken)
    let data = await parseResponseData(response)

    const tokenError = response.status === 401

    if (tokenError) {
      try {
        await refreshAuth()
        const refreshedToken = getAccessTokenFromStorage()
        response = await makeRequest(refreshedToken)
        data = await parseResponseData(response)
      } catch {
        // Keep original 401 response payload path below.
      }
    }

    return { response, data }
  }

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

  const clearLocalPreview = (source: 'camera' | 'screen' = videoSource) => {
    if (previewStreamRef.current) {
      previewStreamRef.current.getTracks().forEach((track) => track.stop())
      previewStreamRef.current = null
    }
    if (isMountedRef.current) {
      setLocalPreviewStream(null)
    }

    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = null
    }

    onLocalPreviewChange?.(null, source)
  }

  const attachLocalPreviewTrack = async (track: MediaStreamTrack, source: 'camera' | 'screen') => {
    clearLocalPreview(source)

    const previewStream = new MediaStream([track.clone()])
    previewStreamRef.current = previewStream
    if (isMountedRef.current) {
      setLocalPreviewStream(previewStream)
    }

    if (previewVideoRef.current) {
      previewVideoRef.current.srcObject = previewStream
      previewVideoRef.current.muted = true
      previewVideoRef.current.playsInline = true
      await previewVideoRef.current.play().catch(() => undefined)
    }

    onLocalPreviewChange?.(previewStream, source)
  }

  useEffect(() => {
    const previewVideo = previewVideoRef.current
    if (!previewVideo) return

    if (!localPreviewStream) {
      previewVideo.srcObject = null
      return
    }

    if (previewVideo.srcObject !== localPreviewStream) {
      previewVideo.srcObject = localPreviewStream
    }
    previewVideo.muted = true
    previewVideo.playsInline = true
    previewVideo.play().catch(() => undefined)
  }, [localPreviewStream, isLive])

  const updateBroadcastVideoInput = async (track: MediaStreamTrack, source: 'camera' | 'screen') => {
    const client = broadcastClientRef.current
    if (!client) {
      throw new Error('Broadcast client is not initialized')
    }

    if (typeof client.removeVideoInputDevice === 'function') {
      try {
        await client.removeVideoInputDevice(PRIMARY_VIDEO_INPUT_NAME)
      } catch {
        // Ignore if device was not added yet.
      }
    }

    await client.addVideoInputDevice(
      new MediaStream([track]),
      PRIMARY_VIDEO_INPUT_NAME,
      videoCompositionRef.current
    )

    await attachLocalPreviewTrack(track, source)
  }

  const stopScreenShare = async () => {
    if (!screenStreamRef.current) return

    setIsSwitchingVideoSource(true)

    try {
      const cameraTrack = mediaStreamRef.current?.getVideoTracks?.()[0]
      if (!cameraTrack) {
        throw new Error('Camera stream unavailable. Restart livestream to restore camera.')
      }

      await updateBroadcastVideoInput(cameraTrack, 'camera')
      setIsSharingScreen(false)
      setVideoSource('camera')
    } finally {
      screenStreamRef.current?.getTracks().forEach((track) => track.stop())
      screenStreamRef.current = null
      setIsSwitchingVideoSource(false)
    }
  }

  const startScreenShare = async () => {
    if (!isLive || isSwitchingVideoSource) return

    setError(null)
    setIsSwitchingVideoSource(true)

    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          frameRate: { ideal: 30, max: 30 },
        },
        audio: false,
      })

      const screenTrack = screenStream.getVideoTracks?.()[0]
      if (!screenTrack) {
        throw new Error('Screen sharing did not provide a video track')
      }

      screenTrack.addEventListener('ended', () => {
        stopScreenShare().catch(() => undefined)
      })

      screenStreamRef.current = screenStream
      await updateBroadcastVideoInput(screenTrack, 'screen')
      setIsSharingScreen(true)
      setVideoSource('screen')
    } catch (e: any) {
      setError(e?.message || 'Failed to share screen')
    } finally {
      setIsSwitchingVideoSource(false)
    }
  }

  const stopLocalBroadcast = async () => {
    try {
      if (broadcastClientRef.current) {
        await broadcastClientRef.current.stopBroadcast?.()
      }
    } catch {
      // Ignore local stop errors during cleanup.
    } finally {
      broadcastClientRef.current = null
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop())
      mediaStreamRef.current = null
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop())
      screenStreamRef.current = null
    }

    clearLocalPreview()
  }

  // Check stream status periodically.
  useEffect(() => {
    if (!tokenAddress || !isCreator) return

    const checkStatus = async () => {
      try {
        const res = await fetch(`/api/stream/status?tokenAddress=${encodeURIComponent(tokenAddress)}`, {
          cache: 'no-store',
        })
        if (!res.ok) return

        const data = await res.json()
        if (data.success) {
          setIsLive(!!data.isLive)
          if (data.isLive && data.playbackUrl) {
            setStreamInfo((prev) => {
              if (prev) {
                return { ...prev, playbackUrl: data.playbackUrl }
              }
              return {
                tokenAddress: data.tokenAddress || tokenAddress,
                streamKey: data.streamKey || '',
                ingestUrl: '',
                playbackUrl: data.playbackUrl,
              }
            })
          }
        }
      } catch {
        // Non-blocking.
      }
    }

    checkStatus()
    const interval = setInterval(checkStatus, 5000)
    return () => clearInterval(interval)
  }, [tokenAddress, isCreator])

  // Cleanup local media/broadcast on unmount.
  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      stopLocalBroadcast().catch(() => undefined)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const copyToClipboard = async (text: string, key: string) => {
    if (!text) return
    try {
      await navigator.clipboard.writeText(text)
      setCopied((prev) => ({ ...prev, [key]: true }))
      setTimeout(() => {
        setCopied((prev) => ({ ...prev, [key]: false }))
      }, 2000)
    } catch {
      // Ignore clipboard failures.
    }
  }

  async function handleStart() {
    if (!isConnected || !userAddress) {
      setError('Please connect your wallet')
      return
    }

    if (!accessToken) {
      setError('Please authenticate as CREATOR before starting livestream')
      return
    }

    if (!isCreator) {
      setError('Only the token creator can start a livestream')
      return
    }

    if (!isSecureBrowserContext()) {
      setError('Camera/mic livestream requires HTTPS or localhost.')
      return
    }

    setIsLoading(true)
    setError(null)

    let serverStreamStarted = false

    try {
      const { response: startRes, data: startData } = await postWithAuthRetry('/api/stream/start', {
        tokenAddress,
      })

      if (!startRes.ok || !startData.success) {
        throw new Error(startData.error || `Failed to start livestream (HTTP ${startRes.status})`)
      }

      const ingestEndpoint = normalizeIvsIngestEndpoint(
        startData.ingestEndpoint || startData.ingestUrl || startData.ingestUrlFull
      )
      const streamKey = String(startData.streamKey || '').trim()
      const playbackUrl = String(startData.playbackUrl || '').trim()

      if (!ingestEndpoint || !streamKey || !playbackUrl) {
        throw new Error('Livestream setup returned incomplete IVS stream details')
      }

      serverStreamStarted = true

      const IVSBroadcastClient = await loadIvsBroadcastSdk()
      if (
        typeof IVSBroadcastClient?.isSupported === 'function' &&
        !IVSBroadcastClient.isSupported()
      ) {
        throw new Error(
          'This browser does not support IVS browser livestreaming. Use latest Chrome or Edge.'
        )
      }
      const streamConfig = resolveStreamConfig(IVSBroadcastClient, startData.channelType)

      const media = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30, max: 30 },
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      })

      const client = IVSBroadcastClient.create({
        streamConfig,
        ingestEndpoint,
      })

      const videoWidth = streamConfig?.maxResolution?.width ?? 1280
      const videoHeight = streamConfig?.maxResolution?.height ?? 720
      const videoCompositionRefValue = {
        index: 0,
        x: 0,
        y: 0,
        width: videoWidth,
        height: videoHeight,
      }
      videoCompositionRef.current = videoCompositionRefValue

      const videoStream = new MediaStream(media.getVideoTracks())
      const audioStream = new MediaStream(media.getAudioTracks())
      await client.addVideoInputDevice(videoStream, PRIMARY_VIDEO_INPUT_NAME, videoCompositionRefValue)
      await client.addAudioInputDevice(audioStream, PRIMARY_AUDIO_INPUT_NAME)

      const cameraTrack = media.getVideoTracks()[0]
      if (cameraTrack) {
        await attachLocalPreviewTrack(cameraTrack, 'camera')
      }

      await client.startBroadcast(streamKey)

      broadcastClientRef.current = client
      mediaStreamRef.current = media

      const info: TokenStreamInfo = {
        tokenAddress: startData.tokenAddress || tokenAddress,
        streamKey,
        ingestUrl: startData.ingestUrl || '',
        ingestEndpoint,
        playbackUrl,
        provider: startData.provider || 'aws-ivs',
        channelType: startData.channelType || undefined,
      }

      setStreamInfo(info)
      setIsLive(true)
      setStartedAt(new Date())
      setIsSharingScreen(false)
      setVideoSource('camera')
      onStreamStart?.(info)
    } catch (e: any) {
      await stopLocalBroadcast()

      // If backend stream was marked live but browser broadcast failed,
      // immediately reset status to offline.
      if (serverStreamStarted) {
        try {
          await postWithAuthRetry('/api/stream/stop', { tokenAddress })
        } catch {
          // Ignore reset failures.
        }
      }

      setError(formatStartError(e))
      setIsLive(false)
      setStreamInfo(null)
      setStartedAt(null)
      setIsSharingScreen(false)
      setVideoSource('camera')
    } finally {
      setIsLoading(false)
    }
  }

  async function handleStop() {
    if (!tokenAddress) return

    setIsLoading(true)
    setError(null)

    try {
      await stopLocalBroadcast()

      if (accessToken) {
        const { response: res, data } = await postWithAuthRetry('/api/stream/stop', {
          tokenAddress,
        })
        if (!res.ok || !data.success) {
          throw new Error(data.error || 'Failed to stop livestream')
        }
      }

      setIsLive(false)
      setStreamInfo(null)
      setStartedAt(null)
      setIsSharingScreen(false)
      setVideoSource('camera')
      onStreamStop?.()
    } catch (e: any) {
      setError(e?.message || 'Something went wrong while stopping livestream')
    } finally {
      setIsLoading(false)
    }
  }

  if (!isCreator) {
    return null
  }

  return (
    <div className="bg-gradient-to-br from-cyan-900/35 to-sky-900/35 backdrop-blur-xl border border-cyan-400/40 rounded-2xl p-6 shadow-[0_0_28px_rgba(6,182,212,0.18)]">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Video className="w-5 h-5 text-cyan-300" />
          Browser Livestream
        </h3>
        {isLive && (
          <div className="flex items-center gap-2">
            <span className="h-3 w-3 rounded-full bg-red-500 animate-pulse"></span>
            <span className="text-red-400 font-bold">LIVE</span>
            <span className="text-gray-300 text-sm">{elapsed}</span>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/20 border border-red-500 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      <div className="mb-4 rounded-xl border border-white/10 bg-black/30 p-3">
        <div className="flex items-center gap-2 text-sm text-cyan-200 mb-2">
          <Camera className="w-4 h-4" />
          <Mic className="w-4 h-4" />
          <span>Live directly from browser (camera + microphone)</span>
        </div>
        <p className="text-xs text-gray-400">
          When you click start, your browser will request camera/mic permission and publish to AWS IVS.
        </p>
      </div>

      {!isLive ? (
        <button
          onClick={handleStart}
          disabled={isLoading}
          className="w-full bg-gradient-to-r from-cyan-500 to-sky-600 hover:from-cyan-600 hover:to-sky-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <Video className="w-5 h-5" />
              Go Live (No OBS)
            </>
          )}
        </button>
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-white/10 bg-black/35 p-3">
            <p className="text-xs text-gray-300 mb-2">Local broadcast preview</p>
            <div className="aspect-video rounded-xl bg-black/60 overflow-hidden">
              <video
                ref={previewVideoRef}
                className="w-full h-full object-cover"
                autoPlay
                muted
                playsInline
                style={{
                  transform: videoSource === 'camera' ? 'scaleX(-1)' : 'none',
                }}
              />
            </div>
          </div>

          <div className="rounded-xl border border-white/10 bg-black/30 p-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="text-sm font-semibold text-white">
                  {isSharingScreen ? 'Screen share is live' : 'Camera is live'}
                </p>
                <p className="text-xs text-gray-400">
                  {isSharingScreen
                    ? 'Viewers are watching your shared screen'
                    : 'Switch to screen share anytime during livestream'}
                </p>
              </div>
              <button
                type="button"
                onClick={isSharingScreen ? () => stopScreenShare() : () => startScreenShare()}
                disabled={isLoading || isSwitchingVideoSource}
                className="px-4 py-2 rounded-lg border border-cyan-300/40 text-cyan-200 hover:bg-cyan-500/10 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-semibold"
              >
                {isSwitchingVideoSource
                  ? 'Switching...'
                  : isSharingScreen
                  ? 'Stop Screen Share'
                  : 'Share Screen'}
              </button>
            </div>
          </div>

          <div className="bg-black/30 rounded-lg p-4 space-y-3">
            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">Playback URL</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  readOnly
                  value={streamInfo?.playbackUrl || ''}
                  className="flex-1 bg-gray-800 text-white px-3 py-2 rounded border border-gray-600 font-mono text-sm"
                />
                <button
                  onClick={() => copyToClipboard(streamInfo?.playbackUrl || '', 'playback')}
                  className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
                >
                  {copied.playback ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </button>
              </div>
            </div>
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
                End Livestream
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
