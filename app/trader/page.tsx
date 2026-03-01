/**
 * Trader Dashboard
 * Role-protected page for TRADER users
 * Features:
 * - Market overview
 * - Watch live streams
 * - Community chat (followed creator room)
 * - Follow creators
 * - Copy trading signals (manual)
 * - Read-only access to promotions
 */

'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../providers/AuthContext'
import { useAccount } from 'wagmi'
import PremiumNavbar from '../components/PremiumNavbar'
import BlobBackground from '../components/BlobBackground'
import Link from 'next/link'
import {
  TrendingUp,
  Video,
  MessageSquare,
  Users,
  Copy,
  ArrowRight,
  Shield,
  AlertCircle,
  Send,
  Wallet,
  Coins,
} from 'lucide-react'

interface CreatorSummary {
  wallet: string
  createdAt: number
  followerCount: number
  tokenCount: number
  latestTokenAddress: string | null
  isFollowed: boolean
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

const CHAT_STICKERS = [
  { id: 'rocket', emoji: '🚀', label: 'Rocket' },
  { id: 'bull', emoji: '🐂', label: 'Bull' },
  { id: 'diamond', emoji: '💎', label: 'Diamond' },
  { id: 'fire', emoji: '🔥', label: 'Fire' },
  { id: 'moon', emoji: '🌕', label: 'Moon' },
]

const STICKER_BY_ID = CHAT_STICKERS.reduce<Record<string, (typeof CHAT_STICKERS)[number]>>(
  (acc, sticker) => {
    acc[sticker.id] = sticker
    return acc
  },
  {}
)

interface HoldingSnapshot {
  id: string
  symbol: string
  name: string
  tokenAddress: string | null
  balance: string
}

interface FollowedCreatorMeta {
  creatorWallet: string
  followerCount: number
  associatedTokenCount: number
  latestTokenAddress: string | null
}

function shortWallet(wallet: string): string {
  if (!wallet) return '-'
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`
}

function normalizeWallet(wallet?: string | null): string {
  return typeof wallet === 'string' ? wallet.toLowerCase() : ''
}

function sameWallet(a?: string | null, b?: string | null): boolean {
  const normalizedA = normalizeWallet(a)
  const normalizedB = normalizeWallet(b)
  return !!normalizedA && !!normalizedB && normalizedA === normalizedB
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

function formatBalance(balanceRaw: string): string {
  const value = Number(balanceRaw)
  if (!Number.isFinite(value)) return balanceRaw
  if (value === 0) return '0'
  if (value >= 1000) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 2 })
  }
  if (value >= 1) {
    return value.toLocaleString(undefined, { maximumFractionDigits: 4 })
  }
  return value.toPrecision(3)
}

export default function TraderDashboard() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading, login, accessToken } = useAuth()
  const { isConnected } = useAccount()
  const autoLoginAttemptedRef = useRef(false)

  const [mounted, setMounted] = useState(false)
  const [creators, setCreators] = useState<CreatorSummary[]>([])
  const [creatorsLoading, setCreatorsLoading] = useState(false)

  const [selectedCreator, setSelectedCreator] = useState('')
  const [followedCreator, setFollowedCreator] = useState<string | null>(null)
  const [followSubmitting, setFollowSubmitting] = useState(false)
  const [followError, setFollowError] = useState<string | null>(null)
  const [followSuccess, setFollowSuccess] = useState<string | null>(null)

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatSending, setChatSending] = useState(false)
  const [stickerSending, setStickerSending] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [holdings, setHoldings] = useState<HoldingSnapshot[]>([])
  const [holdingsLoading, setHoldingsLoading] = useState(false)
  const [holdingsError, setHoldingsError] = useState<string | null>(null)
  const [followedCreatorMeta, setFollowedCreatorMeta] = useState<FollowedCreatorMeta | null>(null)

  const authHeaders = useMemo<Record<string, string>>(() => {
    const headers: Record<string, string> = {}
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`
    }
    return headers
  }, [accessToken])

  const loadCreators = useCallback(async () => {
    if (!accessToken) return

    setCreatorsLoading(true)
    setFollowError(null)

    try {
      const response = await fetch('/api/creators?limit=50', {
        headers: authHeaders,
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load creators')
      }

      const nextCreators: CreatorSummary[] = Array.isArray(data.creators)
        ? data.creators
            .map((creator: any) => ({
              ...creator,
              wallet: normalizeWallet(creator?.wallet),
            }))
            .filter((creator: CreatorSummary) => !!creator.wallet)
        : []
      const nextFollowedCreator: string | null =
        typeof data.followedCreator === 'string' ? normalizeWallet(data.followedCreator) : null

      setCreators(nextCreators)
      setFollowedCreator(nextFollowedCreator)

      setSelectedCreator((prev) => {
        if (nextFollowedCreator) {
          const matchedCreator = nextCreators.find((c) => sameWallet(c.wallet, nextFollowedCreator))
          return matchedCreator?.wallet || nextFollowedCreator
        }
        if (prev) {
          const matchedCreator = nextCreators.find((c) => sameWallet(c.wallet, prev))
          if (matchedCreator) return matchedCreator.wallet
        }
        return nextCreators[0]?.wallet || ''
      })
    } catch (error: any) {
      setFollowError(error.message || 'Failed to load creators')
    } finally {
      setCreatorsLoading(false)
    }
  }, [accessToken, authHeaders])

  const loadFollowedCreatorMeta = useCallback(async (creatorWalletOverride?: string) => {
    const creatorWallet = creatorWalletOverride || followedCreator
    if (!accessToken || !creatorWallet) {
      setFollowedCreatorMeta(null)
      return
    }

    try {
      const response = await fetch(
        `/api/creator-follow?creatorWallet=${encodeURIComponent(creatorWallet)}`,
        { headers: authHeaders }
      )
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load followed creator details')
      }

      const associatedTokens = Array.isArray(data.associatedTokens) ? data.associatedTokens : []
      setFollowedCreatorMeta({
        creatorWallet,
        followerCount: Number(data.followerCount || 0),
        associatedTokenCount: associatedTokens.length,
        latestTokenAddress: associatedTokens[0]?.tokenAddress || null,
      })
    } catch {
      // Keep dashboard usable if metadata call fails.
      setFollowedCreatorMeta({
        creatorWallet,
        followerCount: 0,
        associatedTokenCount: 0,
        latestTokenAddress: null,
      })
    }
  }, [accessToken, followedCreator, authHeaders])

  const loadHoldings = useCallback(async () => {
    if (!user?.wallet) return

    setHoldingsLoading(true)
    setHoldingsError(null)

    try {
      const response = await fetch(`/api/gaming/coins/${encodeURIComponent(user.wallet.toLowerCase())}`, {
        cache: 'no-store',
      })
      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load holdings')
      }

      const nextHoldings: HoldingSnapshot[] = Array.isArray(data.userHoldings)
        ? data.userHoldings.map((item: any, index: number) => ({
            id: String(item.id || `${item.tokenAddress || 'coin'}-${index}`),
            symbol: String(item.symbol || 'TOKEN'),
            name: String(item.name || 'Unknown Token'),
            tokenAddress: item.tokenAddress ? String(item.tokenAddress) : null,
            balance: String(item.balance || '0'),
          }))
        : []

      setHoldings(nextHoldings)
    } catch (error: any) {
      setHoldings([])
      setHoldingsError(error.message || 'Failed to load holdings')
    } finally {
      setHoldingsLoading(false)
    }
  }, [user?.wallet])

  const loadChatMessages = useCallback(async (creatorOverride?: string) => {
    const activeCreator = creatorOverride || followedCreator
    if (!accessToken || !activeCreator) {
      setChatMessages([])
      return
    }

    setChatLoading(true)
    try {
      const roomId = `creator:${activeCreator}`
      const response = await fetch(`/api/chat/messages?roomId=${encodeURIComponent(roomId)}&limit=50`, {
        headers: authHeaders,
      })
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load chat messages')
      }

      setChatMessages(Array.isArray(data.messages) ? data.messages : [])
      setChatError(null)
    } catch (error: any) {
      setChatError(error.message || 'Failed to load chat messages')
    } finally {
      setChatLoading(false)
    }
  }, [accessToken, followedCreator, authHeaders])

  const handleFollow = useCallback(async () => {
    if (!accessToken || !selectedCreator) return

    setFollowSubmitting(true)
    setFollowError(null)
    setFollowSuccess(null)

    try {
      const response = await fetch('/api/creator-follow', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ creatorWallet: selectedCreator }),
      })

      let data: any = null
      const responseText = await response.text()
      try {
        data = responseText ? JSON.parse(responseText) : {}
      } catch {
        data = { error: responseText || null }
      }

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || `Failed to follow creator (${response.status})`)
      }

      const creatorWallet = normalizeWallet(data?.follow?.creatorWallet || selectedCreator)
      setFollowedCreator(creatorWallet)
      setFollowSuccess(`Following ${shortWallet(creatorWallet)}`)
      setChatError(null)

      await loadCreators()
      await loadFollowedCreatorMeta(creatorWallet)
      await loadChatMessages(creatorWallet)
    } catch (error: any) {
      setFollowError(error.message || 'Failed to follow creator')
    } finally {
      setFollowSubmitting(false)
    }
  }, [accessToken, selectedCreator, authHeaders, loadCreators, loadChatMessages])

  const isSelectedCreatorFollowed = sameWallet(selectedCreator, followedCreator)

  const handleUnfollow = useCallback(async () => {
    if (!accessToken) return

    setFollowSubmitting(true)
    setFollowError(null)
    setFollowSuccess(null)

    try {
      const response = await fetch('/api/creator-follow', {
        method: 'DELETE',
        headers: authHeaders,
      })

      let data: any = null
      const responseText = await response.text()
      try {
        data = responseText ? JSON.parse(responseText) : {}
      } catch {
        data = { error: responseText || null }
      }

      if (!response.ok || !data?.success) {
        throw new Error(data?.error || `Failed to unfollow creator (${response.status})`)
      }

      setFollowedCreator(null)
      setChatMessages([])
      setFollowedCreatorMeta(null)
      setFollowSuccess('Unfollowed creator')

      await loadCreators()
    } catch (error: any) {
      setFollowError(error.message || 'Failed to unfollow creator')
    } finally {
      setFollowSubmitting(false)
    }
  }, [accessToken, authHeaders, loadCreators])

  const handleSendChat = useCallback(async () => {
    if (!accessToken || !followedCreator) return
    const trimmedMessage = chatInput.trim()
    if (!trimmedMessage) return

    setChatSending(true)
    setChatError(null)

    try {
      const roomId = `creator:${followedCreator}`
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ roomId, message: trimmedMessage }),
      })

      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to send message')
      }

      setChatMessages((prev) => {
        const next = [...prev, data.message]
        return next.slice(-50)
      })
      setChatInput('')
    } catch (error: any) {
      setChatError(error.message || 'Failed to send message')
    } finally {
      setChatSending(false)
    }
  }, [accessToken, followedCreator, chatInput, authHeaders])

  const handleSendSticker = useCallback(async (stickerId: string) => {
    if (!accessToken || !followedCreator) return
    if (!STICKER_BY_ID[stickerId]) return

    setStickerSending(true)
    setChatError(null)

    try {
      const roomId = `creator:${followedCreator}`
      const response = await fetch('/api/chat/messages', {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          roomId,
          message: '',
          messageType: 'STICKER',
          stickerId,
          stickerPack: 'default',
        }),
      })

      const data = await response.json()
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to send sticker')
      }

      setChatMessages((prev) => {
        const next = [...prev, data.message]
        return next.slice(-50)
      })
    } catch (error: any) {
      setChatError(error.message || 'Failed to send sticker')
    } finally {
      setStickerSending(false)
    }
  }, [accessToken, followedCreator, authHeaders])

  useEffect(() => {
    setMounted(true)
  }, [])

  // Redirect if not authenticated or not TRADER
  useEffect(() => {
    if (isLoading || !mounted) {
      return
    }

    if (!isConnected) {
      router.replace('/')
      return
    }

    if (!isAuthenticated) {
      if (autoLoginAttemptedRef.current) {
        return
      }

      autoLoginAttemptedRef.current = true
      login('TRADER').catch(() => {
        router.replace('/')
      })
      return
    }

    autoLoginAttemptedRef.current = false

    if (user?.role !== 'TRADER') {
      // Redirect to creator dashboard if user is CREATOR
      if (user?.role === 'CREATOR') {
        router.replace('/creator')
      } else {
        router.replace('/')
      }
    }
  }, [isLoading, mounted, isAuthenticated, user?.role, isConnected, router, login])

  useEffect(() => {
    if (!mounted || !isAuthenticated || !accessToken || user?.role !== 'TRADER') return
    loadCreators()
    loadHoldings()
  }, [mounted, isAuthenticated, accessToken, user?.role, loadCreators, loadHoldings])

  useEffect(() => {
    if (!mounted || !isAuthenticated || !accessToken || !followedCreator) {
      setFollowedCreatorMeta(null)
      return
    }
    loadFollowedCreatorMeta()
  }, [mounted, isAuthenticated, accessToken, followedCreator, loadFollowedCreatorMeta])

  useEffect(() => {
    if (!mounted || !isAuthenticated || !accessToken || !followedCreator) {
      setChatMessages([])
      return
    }

    loadChatMessages()
    const interval = setInterval(() => {
      loadChatMessages()
    }, 5000)

    return () => clearInterval(interval)
  }, [mounted, isAuthenticated, accessToken, followedCreator, loadChatMessages])

  if (!mounted || isLoading) {
    return (
      <div className="min-h-screen relative overflow-hidden">
        <BlobBackground />
        <PremiumNavbar />
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF4F84]"></div>
            <p className="text-[#E3E4E8] mt-4">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || user?.role !== 'TRADER') {
    return null
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <BlobBackground />
      <PremiumNavbar />

      <div className="relative z-10 max-w-7xl mx-auto px-4 pt-24 pb-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-8 h-8 text-[#12D9C8]" />
            <h1 className="text-4xl font-bold text-white">Trader Dashboard</h1>
          </div>
          <p className="text-[#E3E4E8] text-lg">
            Welcome, {user.wallet.slice(0, 6)}...{user.wallet.slice(-4)}
          </p>
        </div>

        {/* Role Info Banner */}
        <div className="glass-card p-4 mb-6 border-l-4 border-[#12D9C8]">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[#12D9C8] mt-0.5" />
            <div>
              <h3 className="font-semibold text-white mb-1">Trader Account</h3>
              <p className="text-sm text-gray-400">
                You can watch streams, chat in communities, follow creators, and manually copy trades.
                This role is locked to your wallet and cannot access CREATOR-only actions.
              </p>
            </div>
          </div>
        </div>

        {/* Snapshot Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-5 h-5 text-[#12D9C8]" />
              <h3 className="text-sm font-semibold text-white">Followed Creator</h3>
            </div>
            <p className="text-xl font-bold text-white mb-1">
              {followedCreator ? shortWallet(followedCreator) : 'None'}
            </p>
            <p className="text-xs text-gray-400">
              {followedCreatorMeta
                ? `${followedCreatorMeta.followerCount} followers`
                : 'Follow a creator to unlock community data'}
            </p>
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-3">
              <Coins className="w-5 h-5 text-[#FF4F84]" />
              <h3 className="text-sm font-semibold text-white">Creator Tokens</h3>
            </div>
            <p className="text-xl font-bold text-white mb-1">
              {followedCreatorMeta ? followedCreatorMeta.associatedTokenCount : 0}
            </p>
            {followedCreatorMeta?.latestTokenAddress ? (
              <Link
                href={`/token/${followedCreatorMeta.latestTokenAddress}`}
                className="text-xs text-[#12D9C8] hover:underline"
              >
                View latest token
              </Link>
            ) : (
              <p className="text-xs text-gray-400">No linked tokens yet</p>
            )}
          </div>

          <div className="glass-card p-6">
            <div className="flex items-center gap-2 mb-3">
              <Wallet className="w-5 h-5 text-yellow-500" />
              <h3 className="text-sm font-semibold text-white">Your Assets</h3>
            </div>
            <p className="text-xl font-bold text-white mb-1">
              {holdingsLoading ? 'Loading...' : holdings.length}
            </p>
            <p className="text-xs text-gray-400">Tokens with non-zero balance</p>
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Market Overview */}
          <Link href="/explore" className="glass-card p-6 hover:bg-white/5 transition-colors group">
            <TrendingUp className="w-10 h-10 text-[#FF4F84] mb-4 group-hover:scale-110 transition-transform" />
            <h3 className="text-xl font-bold text-white mb-2">Market Overview</h3>
            <p className="text-gray-400 mb-4">
              Browse and explore all available tokens. View prices, volume, and trends.
            </p>
            <div className="flex items-center text-[#12D9C8] group-hover:gap-2 transition-all">
              Explore <ArrowRight className="w-4 h-4 ml-1" />
            </div>
          </Link>

          {/* Live Streams */}
          <Link href="/livestreams" className="glass-card p-6 hover:bg-white/5 transition-colors group">
            <Video className="w-10 h-10 text-[#FF4F84] mb-4 group-hover:scale-110 transition-transform" />
            <h3 className="text-xl font-bold text-white mb-2">Watch Streams</h3>
            <p className="text-gray-400 mb-4">
              Watch live streams from creators. Learn about tokens and trading strategies.
            </p>
            <div className="flex items-center text-[#12D9C8] group-hover:gap-2 transition-all">
              Watch Now <ArrowRight className="w-4 h-4 ml-1" />
            </div>
          </Link>

          {/* Community Chat */}
          <div className="glass-card p-6">
            <MessageSquare className="w-10 h-10 text-[#FF4F84] mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Community Chat</h3>
            <p className="text-gray-400 mb-4">
              Chat with the creator community you follow.
            </p>

            {!followedCreator ? (
              <div className="text-sm text-gray-400">Follow a creator to unlock their chat room.</div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-gray-400">
                  Room: <span className="text-[#12D9C8]">{shortWallet(followedCreator)}</span>
                </div>

                <div className="h-52 overflow-y-auto rounded border border-white/10 bg-black/20 p-3 space-y-2">
                  {chatLoading ? (
                    <div className="text-sm text-gray-500">Loading messages...</div>
                  ) : chatMessages.length === 0 ? (
                    <div className="text-sm text-gray-500">No messages yet. Start the conversation.</div>
                  ) : (
                    chatMessages.map((msg, index) => {
                      const ownWallet = user.wallet.toLowerCase()
                      const senderWallet = (msg.sender_wallet || '').toLowerCase()
                      const isMine = senderWallet === ownWallet
                      const messageType = msg.message_type || 'TEXT'
                      const sticker = msg.sticker_id ? STICKER_BY_ID[msg.sticker_id] : null

                      return (
                        <div
                          key={msg.id || `${msg.created_at}-${index}`}
                          className={`text-sm rounded px-2 py-1 ${
                            messageType === 'SUPER_CHAT'
                              ? 'bg-yellow-500/10 border border-yellow-500/30'
                              : ''
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className={isMine ? 'text-[#12D9C8]' : 'text-white'}>
                              {isMine ? 'You' : shortWallet(msg.sender_wallet)}
                            </span>
                            <div className="flex items-center gap-2">
                              {messageType === 'SUPER_CHAT' && (
                                <span className="text-[10px] px-2 py-0.5 rounded bg-yellow-500/20 text-yellow-300 border border-yellow-500/40">
                                  SUPER CHAT
                                </span>
                              )}
                              <span className="text-[11px] text-gray-500">{formatMessageTime(msg.created_at)}</span>
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
                              {msg.message && <p className="text-gray-300 break-words mt-1">{msg.message}</p>}
                            </>
                          )}
                          {messageType === 'SUPER_CHAT' && (
                            <div className="mt-1 text-[11px] text-yellow-300">
                              {msg.superchat_amount || '-'} {msg.superchat_token || 'NATIVE'}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}
                </div>

                {chatError && <div className="text-xs text-red-400">{chatError}</div>}

                <div className="flex items-center gap-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleSendChat()
                      }
                    }}
                    placeholder="Write a message"
                    className="flex-1 rounded bg-black/20 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-gray-500"
                    maxLength={800}
                  />
                  <button
                    type="button"
                    onClick={handleSendChat}
                    disabled={chatSending || stickerSending || !chatInput.trim()}
                    className="px-3 py-2 rounded bg-[#12D9C8] text-black text-sm font-semibold disabled:opacity-60"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-gray-500">Stickers:</span>
                  {CHAT_STICKERS.map((sticker) => (
                    <button
                      key={sticker.id}
                      type="button"
                      onClick={() => handleSendSticker(sticker.id)}
                      disabled={chatSending || stickerSending}
                      title={sticker.label}
                      className="rounded border border-white/15 bg-black/20 px-2 py-1 text-lg leading-none hover:bg-white/10 disabled:opacity-60"
                    >
                      {sticker.emoji}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Follow Creators */}
          <div className="glass-card p-6">
            <Users className="w-10 h-10 text-[#12D9C8] mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Follow Creators</h3>
            <p className="text-gray-400 mb-4">
              Follow one creator wallet and join their community room.
            </p>

            <div className="space-y-3">
              {creatorsLoading ? (
                <div className="text-sm text-gray-500">Loading creators...</div>
              ) : creators.length === 0 ? (
                <div className="text-sm text-gray-500">No creators available yet.</div>
              ) : (
                <>
                  <select
                    value={selectedCreator}
                    onChange={(e) => setSelectedCreator(e.target.value)}
                    className="w-full rounded bg-black/20 border border-white/10 px-3 py-2 text-sm text-white"
                  >
                    {creators.map((creator) => (
                      <option key={creator.wallet} value={creator.wallet}>
                        {shortWallet(creator.wallet)} | {creator.followerCount} followers{sameWallet(creator.wallet, followedCreator) ? ' (Following)' : ''}
                      </option>
                    ))}
                  </select>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleFollow}
                      disabled={followSubmitting || !selectedCreator || isSelectedCreatorFollowed}
                      className="px-3 py-2 rounded bg-[#12D9C8] text-black text-sm font-semibold disabled:opacity-60"
                    >
                      {isSelectedCreatorFollowed ? 'Following' : 'Follow'}
                    </button>

                    <button
                      type="button"
                      onClick={handleUnfollow}
                      disabled={followSubmitting || !followedCreator}
                      className="px-3 py-2 rounded border border-white/20 text-white text-sm disabled:opacity-60"
                    >
                      Unfollow
                    </button>
                  </div>
                </>
              )}

              <div className="text-xs text-gray-400">
                {followedCreator
                  ? `Current follow: ${shortWallet(followedCreator)}`
                  : 'Current follow: none'}
              </div>

              {followError && <div className="text-xs text-red-400">{followError}</div>}
              {followSuccess && <div className="text-xs text-[#12D9C8]">{followSuccess}</div>}
            </div>
          </div>

          {/* Copy Trading */}
          <div className="glass-card p-6">
            <Copy className="w-10 h-10 text-[#12D9C8] mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Copy Trading</h3>
            <p className="text-gray-400 mb-4">
              View trading signals from creators. Manually copy their trades.
            </p>
            <div className="text-sm text-gray-500">Coming Soon</div>
          </div>

          {/* Promotions (Read-only) */}
          <div className="glass-card p-6 border border-yellow-500/30">
            <TrendingUp className="w-10 h-10 text-yellow-500 mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Promotions</h3>
            <p className="text-gray-400 mb-4">
              View token promotions from creators. Read-only access.
            </p>
            <div className="text-sm text-yellow-500">View Only</div>
          </div>
        </div>

        {/* Holdings */}
        <div className="glass-card p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white">Asset Holdings</h2>
            <button
              type="button"
              onClick={loadHoldings}
              className="px-3 py-2 text-xs rounded border border-white/20 text-white hover:bg-white/10"
            >
              Refresh
            </button>
          </div>

          {holdingsLoading ? (
            <div className="text-gray-400 text-sm">Loading holdings...</div>
          ) : holdingsError ? (
            <div className="text-red-400 text-sm">{holdingsError}</div>
          ) : holdings.length === 0 ? (
            <div className="text-gray-400 text-sm">No token holdings yet.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {holdings.slice(0, 12).map((holding) => (
                <div key={holding.id} className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-white font-semibold">{holding.symbol}</p>
                    <p className="text-xs text-gray-500">{shortWallet(holding.tokenAddress || '')}</p>
                  </div>
                  <p className="text-sm text-gray-400 mb-2">{holding.name}</p>
                  <p className="text-[#12D9C8] font-bold">{formatBalance(holding.balance)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Activity */}
        <div className="glass-card p-6">
          <h2 className="text-2xl font-bold text-white mb-4">Recent Activity</h2>
          <div className="text-center py-8 text-gray-400">
            <p>No recent activity yet.</p>
            <p className="text-sm mt-2">Start exploring tokens, following creators, and using chat.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
