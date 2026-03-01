'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams } from 'next/navigation'
import { useAccount } from 'wagmi'
import { motion } from 'framer-motion'
import { ethers } from 'ethers'
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Users,
  Activity,
  ExternalLink,
  Copy,
  Check,
  MessageSquare,
  Send,
} from 'lucide-react'
import PremiumNavbar from '../../components/PremiumNavbar'
import BlobBackground from '../../components/BlobBackground'
import CoinImage from '../../components/CoinImage'
import EnhancedTradingCard from '../../components/EnhancedTradingCard'
import LiveStreamPlayer from '../../../components/LiveStreamPlayer'
import TokenLiveStreamControls, { TokenStreamInfo } from '../../../components/TokenLiveStreamControls'
import Link from 'next/link'
import { usePumpAI } from '../../providers/PumpAIContext'
import { useAuth } from '../../providers/AuthContext'
import { SUPER_CHAT_ABI } from '../../../lib/abis'

interface TokenDetail {
  id: number
  token_address: string
  curve_address: string
  name: string
  symbol: string
  creator: string
  created_at: string
  seed_og: string
  seed_tokens: string
  imageHash?: string
  stats?: {
    total_trades: number
    unique_traders: number
    total_volume_buy: string
    total_volume_sell: string
    volume_24h: string
  }
  recentTrades?: any[]
}

interface ChatMessage {
  id: number
  sender_wallet: string
  role: 'TRADER' | 'CREATOR'
  room_id: string
  message: string
  message_type?: 'TEXT' | 'STICKER' | 'SUPER_CHAT'
  sticker_id?: string | null
  sticker_pack?: string | null
  superchat_amount?: string | null
  superchat_token?: string | null
  superchat_tx_hash?: string | null
  token_symbol: string | null
  created_at: number
}

interface StickerOption {
  id: string
  pack: string
  emoji: string
  label: string
}

const CHAT_STICKERS: StickerOption[] = [
  { id: 'rocket', pack: 'default', emoji: '🚀', label: 'Rocket' },
  { id: 'bull', pack: 'default', emoji: '🐂', label: 'Bull' },
  { id: 'diamond', pack: 'default', emoji: '💎', label: 'Diamond' },
  { id: 'fire', pack: 'default', emoji: '🔥', label: 'Fire' },
  { id: 'moon', pack: 'default', emoji: '🌕', label: 'Moon' },
]

const STICKER_BY_ID: Record<string, StickerOption> = CHAT_STICKERS.reduce(
  (acc, sticker) => {
    acc[sticker.id] = sticker
    return acc
  },
  {} as Record<string, StickerOption>
)

function normalizeWallet(wallet?: string | null): string {
  return typeof wallet === 'string' ? wallet.toLowerCase() : ''
}

function formatMessageTime(createdAt: number): string {
  if (!createdAt) return ''
  try {
    return new Date(createdAt).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return ''
  }
}

function getStickerOption(stickerId?: string | null): StickerOption | null {
  if (!stickerId) return null
  return STICKER_BY_ID[stickerId] || null
}

function formatSuperChatAmount(amountRaw?: string | null): string {
  if (!amountRaw) return ''
  const parsed = Number(amountRaw)
  if (!Number.isFinite(parsed)) return amountRaw
  if (parsed >= 1000) {
    return parsed.toLocaleString(undefined, { maximumFractionDigits: 2 })
  }
  return parsed.toLocaleString(undefined, { maximumFractionDigits: 6 })
}

function getReadableError(error: any, fallback: string): string {
  if (!error) return fallback
  if (typeof error?.shortMessage === 'string' && error.shortMessage) return error.shortMessage
  if (typeof error?.reason === 'string' && error.reason) return error.reason
  if (typeof error?.message === 'string' && error.message) return error.message
  return fallback
}

export default function TokenDetailPage() {
  const params = useParams()
  const address = params.address as string
  const { address: userAddress } = useAccount()
  const { accessToken, user } = useAuth()
  const [token, setToken] = useState<TokenDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  // Livestream state
  const [isLive, setIsLive] = useState(false)
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null)
  const [streamInfo, setStreamInfo] = useState<TokenStreamInfo | null>(null)
  const [viewerCount, setViewerCount] = useState(0)

  // Livestream chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatSending, setChatSending] = useState(false)
  const [stickerSending, setStickerSending] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [chatInfo, setChatInfo] = useState<string | null>(null)
  const [chatAccessBlocked, setChatAccessBlocked] = useState(false)
  const [superChatAmount, setSuperChatAmount] = useState('0.01')
  const [superChatSending, setSuperChatSending] = useState(false)
  const [superChatConfiguring, setSuperChatConfiguring] = useState(false)
  const [superChatStickerId, setSuperChatStickerId] = useState<string>('')
  const [localPreviewStream, setLocalPreviewStream] = useState<MediaStream | null>(null)
  const [localPreviewSource, setLocalPreviewSource] = useState<'camera' | 'screen'>('camera')
  const chatScrollRef = useRef<HTMLDivElement | null>(null)
  const localPreviewVideoRef = useRef<HTMLVideoElement | null>(null)
  const { setMemory } = usePumpAI()

  const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'
  const getAuthHeaders = useCallback(
    (includeJsonContentType = false): HeadersInit => {
      const headers: Record<string, string> = {}
      if (accessToken) {
        headers.Authorization = `Bearer ${accessToken}`
      }
      if (includeJsonContentType) {
        headers['Content-Type'] = 'application/json'
      }
      return headers
    },
    [accessToken]
  )
  const creatorRoomId = token?.creator ? `creator:${normalizeWallet(token.creator)}` : null

  // Check if current user is creator (handle empty creator string)
  const isCreator = userAddress && token && token.creator &&
    userAddress.toLowerCase() === token.creator.toLowerCase()
  const normalizedCurrentWallet = normalizeWallet(user?.wallet || userAddress || null)

  async function checkLivestreamStatus() {
    if (!address) return // address is the token address from URL params

    try {
      const res = await fetch(`/api/stream/status?tokenAddress=${encodeURIComponent(address)}`, {
        cache: 'no-store',
      })
      const data = await res.json()

      if (data.success) {
        setIsLive(data.isLive)
        if (data.playbackUrl) {
          setPlaybackUrl(data.playbackUrl)
        } else {
          setPlaybackUrl(null)
        }
      }
    } catch (e) {
      // Silently fail - status check is optional
      console.warn('Failed to check livestream status:', e)
    }
  }

  const loadViewerCount = useCallback(async () => {
    if (!address || !isLive) {
      setViewerCount(0)
      return
    }

    try {
      const response = await fetch(
        `/api/stream/viewers?tokenAddress=${encodeURIComponent(address)}`,
        { cache: 'no-store' }
      )
      const data = await response.json()
      if (response.ok && data.success) {
        setViewerCount(Number(data.viewerCount || 0))
      }
    } catch {
      // Keep UI stable if viewer count endpoint fails.
    }
  }, [address, isLive])

  const sendViewerHeartbeat = useCallback(async () => {
    if (!address || !isLive || !accessToken) return

    try {
      await fetch('/api/stream/viewers', {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ tokenAddress: address }),
      })
    } catch {
      // Non-blocking.
    }
  }, [address, isLive, accessToken, getAuthHeaders])

  const leaveViewerPresence = useCallback(async () => {
    if (!address || !accessToken) return
    try {
      await fetch('/api/stream/viewers', {
        method: 'DELETE',
        headers: getAuthHeaders(true),
        body: JSON.stringify({ tokenAddress: address }),
      })
    } catch {
      // Non-blocking.
    }
  }, [address, accessToken, getAuthHeaders])

  const loadChatMessages = useCallback(async () => {
    if (!isLive || !creatorRoomId) {
      setChatMessages([])
      setChatError(null)
      setChatAccessBlocked(false)
      return
    }

    if (!accessToken) {
      setChatMessages([])
      setChatAccessBlocked(false)
      setChatError('Connect wallet and sign in to join chat')
      return
    }

    setChatLoading(true)

    try {
      const response = await fetch(
        `/api/chat/messages?roomId=${encodeURIComponent(creatorRoomId)}&limit=80`,
        { headers: getAuthHeaders() }
      )
      const data = await response.json()

      if (!response.ok || !data.success) {
        if (response.status === 403) {
          setChatMessages([])
          setChatAccessBlocked(true)
          setChatError(data.error || 'Follow this creator to access chat')
          return
        }
        throw new Error(data.error || 'Failed to load chat messages')
      }

      setChatMessages(Array.isArray(data.messages) ? data.messages : [])
      setChatError(null)
      setChatAccessBlocked(false)
    } catch (error: any) {
      setChatError(error.message || 'Failed to load chat messages')
      setChatAccessBlocked(false)
    } finally {
      setChatLoading(false)
    }
  }, [isLive, creatorRoomId, accessToken, getAuthHeaders])

  const handleSendChat = useCallback(async () => {
    if (!creatorRoomId || !accessToken || chatAccessBlocked) return

    const trimmedMessage = chatInput.trim()
    if (!trimmedMessage) return

    setChatSending(true)
    setChatError(null)
    setChatInfo(null)

    try {
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          roomId: creatorRoomId,
          message: trimmedMessage,
          messageType: 'TEXT',
          tokenSymbol: token?.symbol || null,
        }),
      })
      const data = await response.json()
      if (!response.ok || !data.success) throw new Error(data.error || 'Failed to send message')
      setChatMessages((prev) => [...prev, data.message].slice(-80))
      setChatInput('')
    } catch (error: any) {
      setChatError(error.message || 'Failed to send message')
    } finally {
      setChatSending(false)
    }
  }, [creatorRoomId, accessToken, chatInput, chatAccessBlocked, getAuthHeaders, token?.symbol])

  const postChatMessage = useCallback(
    async (payload: {
      message: string
      messageType?: 'TEXT' | 'STICKER' | 'SUPER_CHAT'
      stickerId?: string | null
      stickerPack?: string | null
      superchatAmount?: string | null
      superchatToken?: string | null
      superchatTxHash?: string | null
    }) => {
      if (!creatorRoomId || !accessToken || chatAccessBlocked) {
        throw new Error('Chat is not currently available')
      }

      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: getAuthHeaders(true),
        body: JSON.stringify({
          roomId: creatorRoomId,
          message: payload.message,
          messageType: payload.messageType || 'TEXT',
          stickerId: payload.stickerId || null,
          stickerPack: payload.stickerPack || null,
          superchatAmount: payload.superchatAmount || null,
          superchatToken: payload.superchatToken || null,
          superchatTxHash: payload.superchatTxHash || null,
          tokenSymbol: token?.symbol || null,
        }),
      })

      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to send message')
      }

      setChatMessages((prev) => [...prev, data.message].slice(-80))
      return data.message as ChatMessage
    },
    [creatorRoomId, accessToken, chatAccessBlocked, getAuthHeaders, token?.symbol]
  )

  const handleSendSticker = useCallback(
    async (stickerId: string) => {
      if (!creatorRoomId || !accessToken || chatAccessBlocked) return

      const sticker = getStickerOption(stickerId)
      if (!sticker) return

      setStickerSending(true)
      setChatError(null)
      setChatInfo(null)
      try {
        await postChatMessage({
          message: '',
          messageType: 'STICKER',
          stickerId: sticker.id,
          stickerPack: sticker.pack,
        })
      } catch (error: any) {
        setChatError(getReadableError(error, 'Failed to send sticker'))
      } finally {
        setStickerSending(false)
      }
    },
    [creatorRoomId, accessToken, chatAccessBlocked, postChatMessage]
  )

  const handleSendSuperChat = useCallback(async () => {
    if (!creatorRoomId || !accessToken || chatAccessBlocked) return
    if (!token?.creator || !token?.token_address) return

    const trimmedMessage = chatInput.trim()
    const selectedSticker = superChatStickerId ? getStickerOption(superChatStickerId) : null
    if (!trimmedMessage && !selectedSticker) {
      setChatError('Add text or a sticker before sending Super Chat')
      return
    }

    const contractAddress = process.env.NEXT_PUBLIC_SUPERCHAT_ADDRESS || ''
    if (!contractAddress || !ethers.isAddress(contractAddress)) {
      setChatError('NEXT_PUBLIC_SUPERCHAT_ADDRESS is not configured')
      return
    }

    let valueWei: bigint
    try {
      valueWei = ethers.parseEther(superChatAmount || '0')
    } catch {
      setChatError('Invalid Super Chat amount')
      return
    }

    if (valueWei <= 0n) {
      setChatError('Super Chat amount must be greater than zero')
      return
    }

    if (!(window as any).ethereum) {
      setChatError('Wallet provider not detected')
      return
    }

    setSuperChatSending(true)
    setChatError(null)
    setChatInfo(null)

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum)
      const signer = await provider.getSigner()
      const signerAddress = await signer.getAddress()
      if (normalizeWallet(signerAddress) !== normalizedCurrentWallet) {
        throw new Error('Connected wallet does not match the authenticated account')
      }

      const contract = new ethers.Contract(contractAddress, SUPER_CHAT_ABI, signer)
      const messageCidPayload = JSON.stringify({
        roomId: creatorRoomId,
        message: trimmedMessage,
        stickerId: selectedSticker?.id || null,
        sender: normalizedCurrentWallet,
        createdAt: Date.now(),
      })
      const messageCid = `local:${ethers.keccak256(ethers.toUtf8Bytes(messageCidPayload))}`
      const clientMessageId = ethers.hexlify(ethers.randomBytes(32))

      const tx = await contract.sendSuperChatNative(
        token.creator,
        token.token_address,
        messageCid,
        selectedSticker?.pack || '',
        selectedSticker?.id || '',
        clientMessageId,
        { value: valueWei }
      )

      const receipt = await tx.wait()
      if (!receipt || receipt.status !== 1) {
        throw new Error('Super Chat transaction failed')
      }

      await postChatMessage({
        message: trimmedMessage,
        messageType: 'SUPER_CHAT',
        stickerId: selectedSticker?.id || null,
        stickerPack: selectedSticker?.pack || null,
        superchatAmount: superChatAmount,
        superchatToken: 'NATIVE',
        superchatTxHash: tx.hash,
      })

      setChatInput('')
      setSuperChatStickerId('')
    } catch (error: any) {
      setChatError(getReadableError(error, 'Failed to send Super Chat'))
    } finally {
      setSuperChatSending(false)
    }
  }, [
    creatorRoomId,
    accessToken,
    chatAccessBlocked,
    token?.creator,
    token?.token_address,
    chatInput,
    superChatStickerId,
    superChatAmount,
    normalizedCurrentWallet,
    postChatMessage,
  ])

  const handleConfigureSuperChat = useCallback(async (active: boolean) => {
    if (!isCreator || !token?.token_address || !token?.creator) return

    const contractAddress = process.env.NEXT_PUBLIC_SUPERCHAT_ADDRESS || ''
    if (!contractAddress || !ethers.isAddress(contractAddress)) {
      setChatError('NEXT_PUBLIC_SUPERCHAT_ADDRESS is not configured')
      return
    }

    if (!(window as any).ethereum) {
      setChatError('Wallet provider not detected')
      return
    }

    setSuperChatConfiguring(true)
    setChatError(null)
    setChatInfo(null)

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(contractAddress, SUPER_CHAT_ABI, signer)
      const tx = await contract.registerOwnStream(token.token_address, token.creator, active)
      const receipt = await tx.wait()
      if (!receipt || receipt.status !== 1) {
        throw new Error('Super Chat stream update failed')
      }
      setChatInfo(
        active
          ? 'Super Chat enabled for this token stream'
          : 'Super Chat disabled for this token stream'
      )
    } catch (error: any) {
      setChatError(getReadableError(error, 'Failed to update Super Chat stream status'))
    } finally {
      setSuperChatConfiguring(false)
    }
  }, [isCreator, token?.token_address, token?.creator])

  const handleLocalPreviewChange = useCallback(
    (stream: MediaStream | null, source: 'camera' | 'screen') => {
      setLocalPreviewStream(stream)
      setLocalPreviewSource(source)
    },
    []
  )

  useEffect(() => {
    if (address) {
      loadTokenDetail()
      checkLivestreamStatus()
    }
  }, [address])

  // Poll livestream status every 5 seconds
  useEffect(() => {
    if (!address) return

    const interval = setInterval(() => {
      checkLivestreamStatus()
    }, 5000)

    return () => clearInterval(interval)
  }, [address])

  // Viewer count polling while stream is live.
  useEffect(() => {
    if (!isLive || !address) {
      setViewerCount(0)
      return
    }

    loadViewerCount()
    const interval = setInterval(loadViewerCount, 5000)

    return () => clearInterval(interval)
  }, [isLive, address, loadViewerCount])

  // Viewer heartbeat for authenticated viewers.
  useEffect(() => {
    if (!isLive || !address || !accessToken) return

    sendViewerHeartbeat()
    const interval = setInterval(sendViewerHeartbeat, 12000)

    return () => {
      clearInterval(interval)
      leaveViewerPresence()
    }
  }, [isLive, address, accessToken, sendViewerHeartbeat, leaveViewerPresence])

  // Token-specific creator chat polling while stream is live.
  useEffect(() => {
    if (!isLive) {
      setChatMessages([])
      setChatError(null)
      setChatAccessBlocked(false)
      return
    }

    loadChatMessages()
    const interval = setInterval(loadChatMessages, 5000)
    return () => clearInterval(interval)
  }, [isLive, loadChatMessages])

  useEffect(() => {
    if (!chatScrollRef.current) return
    chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
  }, [chatMessages])

  useEffect(() => {
    if (!localPreviewVideoRef.current) return

    if (!localPreviewStream) {
      localPreviewVideoRef.current.srcObject = null
      return
    }

    localPreviewVideoRef.current.srcObject = localPreviewStream
    localPreviewVideoRef.current.muted = true
    localPreviewVideoRef.current.playsInline = true
    localPreviewVideoRef.current.play().catch(() => undefined)
  }, [localPreviewStream, isLive])

  useEffect(() => {
    if (isLive) return
    setLocalPreviewStream(null)
    setLocalPreviewSource('camera')
  }, [isLive])

  async function loadTokenDetail() {
    try {
      setIsLoading(true)
      console.log('🔍 Loading token:', address)

      // Try new API endpoint first
      const response = await fetch(`/api/coins/${address}`)
      const data = await response.json()

      if (response.ok && data.found) {
        console.log('✅ Token found:', data.data.name)
        // Map the API response to TokenDetail format
        const tokenData = data.data

        // If curve address is missing, try to resolve it
        let curveAddress = tokenData.curveAddress || ''
        if (!curveAddress && tokenData.address) {
          try {
            const curveRes = await fetch(`/api/token/curve?tokenAddress=${tokenData.address}`)
            const curveData = await curveRes.json()
            if (curveData.success && curveData.curveAddress) {
              curveAddress = curveData.curveAddress
              console.log('✅ Resolved curve address:', curveAddress)
            }
          } catch (e) {
            console.warn('Failed to resolve curve address:', e)
          }
        }

        // Ensure we have a valid token address
        const tokenAddr = tokenData.address || address
        if (!tokenAddr || tokenAddr === 'undefined' || tokenAddr === 'null') {
          console.error('❌ Invalid token address:', tokenAddr)
          setToken(null)
          setIsLoading(false)
          return
        }

        const mappedToken: TokenDetail = {
          id: 0,
          token_address: tokenAddr,
          curve_address: curveAddress,
          name: tokenData.name,
          symbol: tokenData.symbol,
          creator: tokenData.creator || '',
          created_at: tokenData.createdAt || new Date().toISOString(),
          seed_og: '0',
          seed_tokens: tokenData.supply || '0',
          imageHash: tokenData.imageHash,
        }

        console.log('✅ Token loaded successfully:', {
          name: mappedToken.name,
          symbol: mappedToken.symbol,
          token_address: mappedToken.token_address,
          curve_address: mappedToken.curve_address
        })

        setToken(mappedToken)

        // Update Pump AI memory with last viewed token
        if (mappedToken.symbol) {
          setMemory({
            lastViewedToken: mappedToken.symbol,
            lastAction: 'view'
          })
        }
        return
      }

      // Fallback to old backend API
      try {
        const backendResponse = await fetch(`${API_BASE}/api/tokens/${address}`)
        if (backendResponse.ok) {
          const backendData = await backendResponse.json()
          setToken(backendData)
          if ((backendData as any).symbol) {
            setMemory({
              lastViewedToken: (backendData as any).symbol,
              lastAction: 'view'
            })
          }
          return
        }
      } catch (e) {
        console.log('Backend API not available')
      }

      // Fallback to local storage
      try {
        const { ogStorageSDK } = await import('../../../lib/0gStorageSDK')
        const coins = await ogStorageSDK.getAllCoins()
        const found: any = coins.find((c: any) =>
          c.tokenAddress === address ||
          c.id === address ||
          c.symbol?.toLowerCase() === address.toLowerCase()
        )
        if (found) {
          console.log('✅ Token found in localStorage:', found.name)

          // Ensure we have a valid token address
          const tokenAddr = found.tokenAddress || address
          if (!tokenAddr || tokenAddr === 'undefined' || tokenAddr === 'null') {
            console.error('❌ Invalid token address in localStorage:', tokenAddr)
            setToken(null)
            setIsLoading(false)
            return
          }

          const mappedToken: TokenDetail = {
            id: 0,
            token_address: tokenAddr,
            curve_address: found.curveAddress || '',
            name: found.name,
            symbol: found.symbol,
            creator: found.creator || '',
            created_at: found.createdAt || new Date().toISOString(),
            seed_og: '0',
            seed_tokens: found.supply || '0',
            imageHash: found.imageHash || found.imageRootHash || '',
          }
          setToken(mappedToken)
          if (mappedToken.symbol) {
            setMemory({
              lastViewedToken: mappedToken.symbol,
              lastAction: 'view'
            })
          }
          return
        }
      } catch (e) {
        console.error('Failed to load from storage:', e)
      }

      // Token not found anywhere
      console.log('❌ Token not found:', address)
      setToken(null)
    } catch (error) {
      console.error('❌ Failed to load token:', error)
      setToken(null)
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shortenAddress = (addr: string) => {
    if (!addr) return 'N/A'
    return `${addr.slice(0, 8)}...${addr.slice(-6)}`
  }

  const formatNumber = (num: string | number) => {
    const n = typeof num === 'string' ? parseFloat(num) : num
    if (n >= 1000000) return `${(n / 1000000).toFixed(2)}M`
    if (n >= 1000) return `${(n / 1000).toFixed(2)}K`
    return n.toFixed(2)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <BlobBackground />
        <PremiumNavbar />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF4F84]"></div>
            <p className="text-[#E3E4E8] mt-4">Loading token...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <BlobBackground />
        <PremiumNavbar />
        <div className="flex flex-col items-center justify-center min-h-screen px-6">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="text-center glass-card p-12 max-w-md"
          >
            <div className="text-6xl mb-6">🔍</div>
            <h2 className="text-3xl font-bold text-white mb-3">Token Not Found</h2>
            <p className="text-[#E3E4E8]/70 mb-2">
              The token you're looking for doesn't exist or hasn't been indexed yet.
            </p>
            <p className="text-[#E3E4E8]/50 text-sm mb-8 font-mono">
              {address}
            </p>
            <div className="flex flex-col gap-3">
              <Link href="/explore" className="btn-primary inline-flex items-center justify-center">
                <TrendingUp className="w-5 h-5 mr-2" />
                Explore Tokens
              </Link>
              <Link href="/" className="btn-secondary inline-flex items-center justify-center">
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to Home
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <BlobBackground />
      <PremiumNavbar />

      <div className="pt-24 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Back Button */}
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="mb-8"
          >
            <Link href="/explore" className="btn-secondary inline-flex items-center">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Explore
            </Link>
          </motion.div>

          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="glass-card mb-8"
          >
            <div className="flex flex-col md:flex-row gap-6">
              <CoinImage
                imageHash={token.imageHash}
                tokenName={token.name}
                className="w-24 h-24 rounded-full"
              />
              <div className="flex-1">
                <div className="flex items-center gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <h1 className="text-4xl font-bold text-white mb-2">{token.name}</h1>
                      {isLive && (
                        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/50">
                          <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse"></span>
                          <span className="text-xs font-medium text-red-400">LIVE</span>
                        </div>
                      )}
                    </div>
                    <p className="text-2xl text-[#E3E4E8]">{token.symbol}</p>
                  </div>
                  {token.stats && parseFloat(token.stats.volume_24h || '0') > 0 && (
                    <div className="px-4 py-2 rounded-full bg-gradient-to-r from-[#FF4F84]/20 to-[#8C52FF]/20 border border-[#FF4F84]/30">
                      <TrendingUp className="w-5 h-5 text-[#FF4F84]" />
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <p className="text-[#E3E4E8]/60 text-sm mb-1">Total Trades</p>
                    <p className="text-2xl font-bold text-white">
                      {token.stats?.total_trades || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#E3E4E8]/60 text-sm mb-1">Unique Traders</p>
                    <p className="text-2xl font-bold text-white">
                      {token.stats?.unique_traders || 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#E3E4E8]/60 text-sm mb-1">24h Volume</p>
                    <p className="text-2xl font-bold text-gradient-teal">
                      {formatNumber(token.stats?.volume_24h || '0')} MATIC
                    </p>
                  </div>
                  <div>
                    <p className="text-[#E3E4E8]/60 text-sm mb-1">Created</p>
                    <p className="text-sm text-[#E3E4E8]">
                      {new Date(token.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Contract Addresses */}
            <div className="mt-6 pt-6 border-t border-white/10">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {token.token_address && token.token_address !== 'undefined' && token.token_address !== 'null' ? (
                  <div>
                    <p className="text-[#E3E4E8]/60 text-sm mb-2">Token Address</p>
                    <div className="flex items-center gap-2">
                      <code className="text-[#E3E4E8] font-mono text-sm">
                        {shortenAddress(token.token_address)}
                      </code>
                      <button
                        onClick={() => copyToClipboard(token.token_address)}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      >
                        {copied ? (
                          <Check className="w-4 h-4 text-[#12D9C8]" />
                        ) : (
                          <Copy className="w-4 h-4 text-[#E3E4E8]" />
                        )}
                      </button>
                      <a
                        href={`https://amoy.polygonscan.com/address/${token.token_address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                      >
                        <ExternalLink className="w-4 h-4 text-[#E3E4E8]" />
                      </a>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-[#E3E4E8]/60 text-sm mb-2">Token Address</p>
                    <p className="text-yellow-300 text-sm">Pending on-chain address - finalizing bonding curve</p>
                  </div>
                )}
                <div>
                  <p className="text-[#E3E4E8]/60 text-sm mb-2">Creator</p>
                  <div className="flex items-center gap-2">
                    <code className="text-[#E3E4E8] font-mono text-sm">
                      {shortenAddress(token.creator)}
                    </code>
                    <a
                      href={`https://amoy.polygonscan.com/address/${token.creator}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-4 h-4 text-[#E3E4E8]" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Livestream Section - Show if live or if user is creator */}
          {(isLive || (isCreator && token)) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.6 }}
              className="mb-8"
            >
              <div className="glass-card p-0 overflow-hidden">
                <div className="px-6 pt-6 pb-4 border-b border-white/10 bg-white/[0.02]">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 className="text-2xl font-bold text-white">Livestream</h2>
                    <div className="flex items-center gap-3">
                      {isLive && (
                        <div className="flex items-center gap-2 bg-red-600 px-3 py-1 rounded-full">
                          <span className="h-2 w-2 rounded-full bg-white animate-pulse"></span>
                          <span className="text-white font-bold text-sm">LIVE</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-cyan-400/30 bg-cyan-500/10">
                        <Users className="w-4 h-4 text-cyan-300" />
                        <span className="text-cyan-200 text-sm font-medium">{viewerCount} watching</span>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm text-[#E3E4E8]/70 mt-2">
                    {isCreator
                      ? 'Creator studio is on the right. Your self-preview stays visible while you stream.'
                      : 'Watch live and join the creator community chat in real time.'}
                  </p>
                </div>

                <div className={`px-6 pb-6 pt-6 grid gap-6 ${isCreator ? 'xl:grid-cols-[minmax(0,1fr)_360px]' : 'grid-cols-1'}`}>
                  <div className="space-y-6 min-w-0">
                    <div className="rounded-2xl border border-white/10 bg-[#070b16]/80 p-2">
                      <div className="relative rounded-xl overflow-hidden">
                        {isLive && playbackUrl ? (
                          <LiveStreamPlayer streamUrl={playbackUrl} />
                        ) : (
                          <div className="rounded-xl bg-[#1a0b2e]/60 aspect-video flex items-center justify-center">
                            <div className="text-center text-gray-400">
                              <p className="text-lg mb-2">Creator is currently offline</p>
                              <p className="text-sm">The livestream will appear here when the creator goes live</p>
                            </div>
                          </div>
                        )}

                        {isCreator && isLive && localPreviewStream && (
                          <div className="absolute bottom-3 right-3 w-36 sm:w-44 md:w-52 rounded-xl overflow-hidden border border-cyan-300/50 bg-black/90 shadow-[0_8px_24px_rgba(0,0,0,0.45)]">
                            <video
                              ref={localPreviewVideoRef}
                              className="w-full aspect-video object-cover"
                              autoPlay
                              muted
                              playsInline
                              style={{
                                transform: localPreviewSource === 'camera' ? 'scaleX(-1)' : 'none',
                              }}
                            />
                            <div className="px-2 py-1 bg-black/70 flex items-center justify-between">
                              <span className="text-[11px] text-white font-semibold">You</span>
                              <span className="text-[11px] text-cyan-200">
                                {localPreviewSource === 'screen' ? 'Screen' : 'Camera'}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {isLive && (
                      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <MessageSquare className="w-5 h-5 text-cyan-300" />
                            <h3 className="text-lg font-semibold text-white">Live Chat</h3>
                          </div>
                          <span className="text-xs text-cyan-200">
                            Room: {token.creator ? shortenAddress(token.creator) : 'creator'}
                          </span>
                        </div>

                        {isCreator && (
                          <div className="mb-3 flex flex-wrap items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleConfigureSuperChat(true)}
                              disabled={superChatConfiguring}
                              className="px-3 py-1.5 rounded bg-yellow-500 text-black text-xs font-semibold disabled:opacity-60"
                            >
                              {superChatConfiguring ? 'Updating...' : 'Enable Super Chat'}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleConfigureSuperChat(false)}
                              disabled={superChatConfiguring}
                              className="px-3 py-1.5 rounded border border-white/20 text-white text-xs disabled:opacity-60"
                            >
                              Disable Super Chat
                            </button>
                          </div>
                        )}

                        {!accessToken ? (
                          <p className="text-sm text-gray-400">
                            Connect wallet and sign in to join livestream chat.
                          </p>
                        ) : chatAccessBlocked ? (
                          <p className="text-sm text-yellow-300">
                            {chatError || 'Follow this creator to access chat.'}
                          </p>
                        ) : (
                          <>
                            <div
                              ref={chatScrollRef}
                              className="h-64 overflow-y-auto rounded border border-white/10 bg-black/30 p-3 space-y-2 mb-3"
                            >
                              {chatLoading ? (
                                <div className="text-sm text-gray-500">Loading messages...</div>
                              ) : chatMessages.length === 0 ? (
                                <div className="text-sm text-gray-500">
                                  No messages yet. Start the conversation.
                                </div>
                              ) : (
                                chatMessages.map((msg, index) => {
                                  const isMine = normalizeWallet(msg.sender_wallet) === normalizedCurrentWallet
                                  const messageType = msg.message_type || 'TEXT'
                                  const sticker = getStickerOption(msg.sticker_id)
                                  const isSuperChat = messageType === 'SUPER_CHAT'
                                  return (
                                    <div
                                      key={msg.id || `${msg.created_at}-${index}`}
                                      className={`text-sm rounded px-2 py-1 ${
                                        isSuperChat
                                          ? 'bg-yellow-500/10 border border-yellow-500/30'
                                          : 'bg-transparent'
                                      }`}
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <span className={isMine ? 'text-[#12D9C8]' : 'text-white'}>
                                          {isMine ? 'You' : shortenAddress(msg.sender_wallet)}
                                        </span>
                                        <div className="flex items-center gap-2">
                                          {isSuperChat && (
                                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">
                                              SUPER CHAT
                                            </span>
                                          )}
                                          <span className="text-[11px] text-gray-500">
                                            {formatMessageTime(msg.created_at)}
                                          </span>
                                        </div>
                                      </div>
                                      {messageType === 'STICKER' ? (
                                        <div className="mt-1 flex items-center gap-2">
                                          <span className="text-2xl">{sticker?.emoji || '🎉'}</span>
                                          <span className="text-gray-300">{sticker?.label || msg.sticker_id}</span>
                                        </div>
                                      ) : (
                                        <>
                                          {sticker && (
                                            <div className="mt-1 flex items-center gap-2">
                                              <span className="text-xl">{sticker.emoji}</span>
                                              <span className="text-gray-400 text-xs uppercase tracking-wide">
                                                {sticker.label}
                                              </span>
                                            </div>
                                          )}
                                          {msg.message && (
                                            <p className="text-gray-300 break-words mt-1">{msg.message}</p>
                                          )}
                                        </>
                                      )}
                                      {isSuperChat && (
                                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
                                          <span className="text-yellow-300">
                                            {formatSuperChatAmount(msg.superchat_amount)}{' '}
                                            {msg.superchat_token || 'NATIVE'}
                                          </span>
                                          {msg.superchat_tx_hash && (
                                            <span className="text-gray-500 font-mono">
                                              tx: {shortenAddress(msg.superchat_tx_hash)}
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  )
                                })
                              )}
                            </div>

                            {chatError && <p className="text-xs text-red-400 mb-3">{chatError}</p>}
                            {chatInfo && <p className="text-xs text-cyan-300 mb-3">{chatInfo}</p>}

                            <div className="flex items-center gap-2 mb-2">
                              <input
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault()
                                    handleSendChat()
                                  }
                                }}
                                placeholder="Message the creator and followers"
                                className="flex-1 rounded bg-black/25 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-gray-500"
                                maxLength={800}
                              />
                              <button
                                type="button"
                                onClick={handleSendChat}
                                disabled={chatSending || stickerSending || superChatSending || !chatInput.trim()}
                                className="px-3 py-2 rounded bg-[#12D9C8] text-black text-sm font-semibold disabled:opacity-60"
                              >
                                <Send className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                onClick={handleSendSuperChat}
                                disabled={
                                  chatSending ||
                                  stickerSending ||
                                  superChatSending ||
                                  (!chatInput.trim() && !superChatStickerId)
                                }
                                className="px-3 py-2 rounded bg-yellow-500 text-black text-xs font-bold disabled:opacity-60"
                              >
                                {superChatSending ? 'Paying...' : 'Super Chat'}
                              </button>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 mb-2">
                              <span className="text-[11px] text-gray-500">Quick stickers:</span>
                              {CHAT_STICKERS.map((sticker) => (
                                <button
                                  key={sticker.id}
                                  type="button"
                                  onClick={() => handleSendSticker(sticker.id)}
                                  disabled={chatSending || stickerSending || superChatSending}
                                  className="rounded border border-white/15 bg-black/20 px-2 py-1 text-lg leading-none hover:bg-white/10 disabled:opacity-60"
                                  title={sticker.label}
                                >
                                  {sticker.emoji}
                                </button>
                              ))}
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-[120px_minmax(0,1fr)] gap-2">
                              <input
                                value={superChatAmount}
                                onChange={(e) => setSuperChatAmount(e.target.value)}
                                inputMode="decimal"
                                placeholder="0.01"
                                className="rounded bg-black/25 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-gray-500"
                              />
                              <select
                                value={superChatStickerId}
                                onChange={(e) => setSuperChatStickerId(e.target.value)}
                                className="rounded bg-black/25 border border-white/10 px-3 py-2 text-sm text-white"
                              >
                                <option value="">Super Chat sticker (optional)</option>
                                {CHAT_STICKERS.map((sticker) => (
                                  <option key={sticker.id} value={sticker.id}>
                                    {sticker.emoji} {sticker.label}
                                  </option>
                                ))}
                              </select>
                            </div>

                            <p className="mt-2 text-[11px] text-gray-500">
                              Super Chat sends an on-chain payment using the `SUPER_CHAT` contract and then posts
                              the verified message in this room.
                            </p>
                          </>
                        )}
                      </div>
                    )}
                  </div>

                  {isCreator && (
                    <div className="xl:sticky xl:top-24 h-fit">
                      <TokenLiveStreamControls
                        tokenAddress={token.token_address}
                        tokenCreator={token.creator}
                        onLocalPreviewChange={handleLocalPreviewChange}
                        onStreamStart={(info) => {
                          setStreamInfo(info)
                          setPlaybackUrl(info.playbackUrl)
                          setIsLive(true)
                          setViewerCount(0)
                          // Refresh status after a short delay
                          setTimeout(() => checkLivestreamStatus(), 2000)
                          setTimeout(() => loadViewerCount(), 2500)
                        }}
                        onStreamStop={() => {
                          setStreamInfo(null)
                          setPlaybackUrl(null)
                          setIsLive(false)
                          setViewerCount(0)
                          setLocalPreviewStream(null)
                          setLocalPreviewSource('camera')
                          // Refresh status
                          setTimeout(() => checkLivestreamStatus(), 1000)
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* Trading Card - Only show if we have a valid token address */}
          {token.token_address && token.token_address !== 'undefined' && token.token_address !== 'null' ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="mb-8"
            >
              <EnhancedTradingCard
                tokenAddress={token.token_address}
                tokenName={token.name}
                tokenSymbol={token.symbol}
                description={`${token.name} (${token.symbol}) - A memecoin on Polygon`}
                imageUrl=""
                metadataUrl=""
                creator={token.creator}
                createdAt={token.created_at}
                supply={token.seed_tokens}
                curveAddress={token.curve_address}
              />
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.6 }}
              className="mb-8"
            >
              <div className="glass-card p-8 text-center">
                <div className="text-6xl mb-4">⏳</div>
                <h3 className="text-2xl font-bold text-white mb-2">Token Address Pending</h3>
                <p className="text-[#E3E4E8]/70 mb-4">
                  This token's on-chain address is still being finalized. Please wait a moment and refresh the page.
                </p>
                <button
                  onClick={() => window.location.reload()}
                  className="btn-primary"
                >
                  Refresh Page
                </button>
              </div>
            </motion.div>
          )}

          {/* Recent Trades */}
          {token.recentTrades && token.recentTrades.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.6 }}
              className="glass-card"
            >
              <div className="flex items-center gap-3 mb-6">
                <Activity className="w-6 h-6 text-[#12D9C8]" />
                <h2 className="text-2xl font-bold text-white">Recent Trades</h2>
              </div>
              <div className="space-y-2">
                {token.recentTrades.slice(0, 10).map((trade: any, index: number) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-4 bg-white/5 rounded-lg border border-white/10"
                  >
                    <div className="flex items-center gap-3">
                      {trade.trade_type === 'buy' ? (
                        <TrendingUp className="w-5 h-5 text-[#12D9C8]" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-[#FF4F84]" />
                      )}
                      <div>
                        <p className="text-white text-sm font-medium">
                          {trade.trade_type === 'buy' ? 'Buy' : 'Sell'}
                        </p>
                        <p className="text-[#E3E4E8]/60 text-xs">
                          {shortenAddress(trade.trader)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-white text-sm font-medium">
                        {formatNumber(trade.amount_out)}{' '}
                        {trade.trade_type === 'buy' ? token.symbol : 'MATIC'}
                      </p>
                      <p className="text-[#E3E4E8]/60 text-xs">
                        {new Date(trade.timestamp).toLocaleTimeString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  )
}
