/**
 * Creator Dashboard
 * Role-protected page for CREATOR users
 * Features:
 * - Start live stream
 * - Promote own token
 * - Creator community chat room
 * - Post trade signals
 * - View analytics (viewers, engagement, volume impact)
 */

'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../providers/AuthContext'
import { useAccount } from 'wagmi'
import PremiumNavbar from '../components/PremiumNavbar'
import BlobBackground from '../components/BlobBackground'
import Link from 'next/link'
import {
  Video,
  TrendingUp,
  MessageSquare,
  BarChart3,
  Send,
  Users,
  ArrowRight,
  Crown,
  AlertCircle,
} from 'lucide-react'

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

function shortWallet(wallet: string): string {
  if (!wallet) return '-'
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`
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

export default function CreatorDashboard() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading, login, accessToken, refreshAuth } = useAuth()
  const { isConnected } = useAccount()
  const [mounted, setMounted] = useState(false)
  const autoLoginAttemptedRef = useRef(false)

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [chatSending, setChatSending] = useState(false)
  const [stickerSending, setStickerSending] = useState(false)
  const [chatError, setChatError] = useState<string | null>(null)
  const [followerCount, setFollowerCount] = useState(0)

  const creatorWallet = user?.wallet?.toLowerCase() || null

  const fetchWithAuthRetry = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const tokenFromStorage =
        (typeof window !== 'undefined' ? localStorage.getItem('polpump_access_token') : null) ||
        accessToken

      const firstResponse = await fetch(input, {
        ...init,
        headers: {
          ...(init?.headers || {}),
          ...(tokenFromStorage ? { Authorization: `Bearer ${tokenFromStorage}` } : {}),
        },
      })

      if (firstResponse.status !== 401) {
        return firstResponse
      }

      try {
        await refreshAuth()
      } catch {
        return firstResponse
      }

      const refreshedToken =
        typeof window !== 'undefined' ? localStorage.getItem('polpump_access_token') : null
      if (!refreshedToken) {
        return firstResponse
      }

      return fetch(input, {
        ...init,
        headers: {
          ...(init?.headers || {}),
          Authorization: `Bearer ${refreshedToken}`,
        },
      })
    },
    [accessToken, refreshAuth]
  )

  const loadFollowerCount = useCallback(async () => {
    if (!accessToken || !creatorWallet) return

    try {
      const response = await fetchWithAuthRetry(`/api/creator-follow?creatorWallet=${creatorWallet}`)
      const data = await response.json()

      if (response.ok && data.success) {
        setFollowerCount(Number(data.followerCount || 0))
      }
    } catch {
      // Keep UI stable even if follower count fails.
    }
  }, [accessToken, creatorWallet, fetchWithAuthRetry])

  const loadChatMessages = useCallback(async () => {
    if (!accessToken || !creatorWallet) {
      setChatMessages([])
      return
    }

    setChatLoading(true)
    try {
      const roomId = `creator:${creatorWallet}`
      const response = await fetchWithAuthRetry(
        `/api/chat/messages?roomId=${encodeURIComponent(roomId)}&limit=50`
      )
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
  }, [accessToken, creatorWallet, fetchWithAuthRetry])

  const handleSendChat = useCallback(async () => {
    if (!accessToken || !creatorWallet) return
    const trimmedMessage = chatInput.trim()
    if (!trimmedMessage) return

    setChatSending(true)
    setChatError(null)

    try {
      const roomId = `creator:${creatorWallet}`
      const response = await fetchWithAuthRetry('/api/chat/messages', {
        method: 'POST',
        headers: {
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
  }, [accessToken, creatorWallet, chatInput, fetchWithAuthRetry])

  const handleSendSticker = useCallback(async (stickerId: string) => {
    if (!accessToken || !creatorWallet) return
    if (!STICKER_BY_ID[stickerId]) return

    setStickerSending(true)
    setChatError(null)

    try {
      const roomId = `creator:${creatorWallet}`
      const response = await fetchWithAuthRetry('/api/chat/messages', {
        method: 'POST',
        headers: {
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
  }, [accessToken, creatorWallet, fetchWithAuthRetry])

  useEffect(() => {
    setMounted(true)
  }, [])

  // Redirect if not authenticated or not CREATOR
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
      login('CREATOR').catch(() => {
        router.replace('/')
      })
      return
    }

    autoLoginAttemptedRef.current = false

    if (user?.role !== 'CREATOR') {
      // Redirect to trader dashboard if user is TRADER
      if (user?.role === 'TRADER') {
        router.replace('/trader')
      } else {
        router.replace('/')
      }
    }
  }, [isLoading, mounted, isAuthenticated, user?.role, isConnected, router, login])

  useEffect(() => {
    if (!mounted || !isAuthenticated || !accessToken || user?.role !== 'CREATOR' || !creatorWallet) {
      return
    }

    loadFollowerCount()
    loadChatMessages()

    const interval = setInterval(() => {
      loadFollowerCount()
      loadChatMessages()
    }, 5000)

    return () => clearInterval(interval)
  }, [
    mounted,
    isAuthenticated,
    accessToken,
    user?.role,
    creatorWallet,
    loadFollowerCount,
    loadChatMessages,
  ])

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

  if (!isAuthenticated || user?.role !== 'CREATOR') {
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
            <Crown className="w-8 h-8 text-yellow-500" />
            <h1 className="text-4xl font-bold text-white">Creator Dashboard</h1>
          </div>
          <p className="text-[#E3E4E8] text-lg">
            Welcome, {user.wallet.slice(0, 6)}...{user.wallet.slice(-4)}
          </p>
        </div>

        {/* Role Info Banner */}
        <div className="glass-card p-4 mb-6 border-l-4 border-yellow-500">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-500 mt-0.5" />
            <div>
              <h3 className="font-semibold text-white mb-1">Creator Account</h3>
              <p className="text-sm text-gray-400">
                You have CREATOR privileges! Start live streams, promote your tokens, post trading signals,
                and lead communities. This role is locked to your wallet and separated from TRADER accounts.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {/* Start Live Stream */}
          <Link href="/livestreams" className="glass-card p-6 hover:bg-white/5 transition-colors group border-2 border-[#FF4F84]">
            <Video className="w-10 h-10 text-[#FF4F84] mb-4 group-hover:scale-110 transition-transform" />
            <h3 className="text-xl font-bold text-white mb-2">Start Live Stream</h3>
            <p className="text-gray-400 mb-4">
              Go live and promote your token. Connect with your community in real-time.
            </p>
            <div className="flex items-center text-[#FF4F84] group-hover:gap-2 transition-all">
              Go Live <ArrowRight className="w-4 h-4 ml-1" />
            </div>
          </Link>

          {/* Promote Token */}
          <Link href="/explore" className="glass-card p-6 hover:bg-white/5 transition-colors group border-2 border-yellow-500">
            <TrendingUp className="w-10 h-10 text-yellow-500 mb-4 group-hover:scale-110 transition-transform" />
            <h3 className="text-xl font-bold text-white mb-2">Promote Token</h3>
            <p className="text-gray-400 mb-4">
              Promote your token to the community. Increase visibility and volume.
            </p>
            <div className="flex items-center text-yellow-500 group-hover:gap-2 transition-all">
              Promote <ArrowRight className="w-4 h-4 ml-1" />
            </div>
          </Link>

          {/* Post Trading Signals */}
          <div className="glass-card p-6 border-2 border-[#12D9C8]">
            <Send className="w-10 h-10 text-[#12D9C8] mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Post Signals</h3>
            <p className="text-gray-400 mb-4">
              Share buy/sell signals with your followers. Help them copy your trades.
            </p>
            <div className="text-sm text-gray-500">Coming Soon</div>
          </div>

          {/* Creator Chat Rooms */}
          <div className="glass-card p-6 md:col-span-2 lg:col-span-2">
            <MessageSquare className="w-10 h-10 text-[#FF4F84] mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Creator Community Chat</h3>
            <p className="text-gray-400 mb-4">
              This room is shared with traders currently following your wallet.
            </p>

            <div className="text-xs text-gray-400 mb-3">
              Room: <span className="text-[#12D9C8]">{creatorWallet ? shortWallet(creatorWallet) : '-'}</span>
            </div>

            <div className="h-56 overflow-y-auto rounded border border-white/10 bg-black/20 p-3 space-y-2 mb-3">
              {chatLoading ? (
                <div className="text-sm text-gray-500">Loading messages...</div>
              ) : chatMessages.length === 0 ? (
                <div className="text-sm text-gray-500">No messages yet. Say hello to your community.</div>
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
                        <span className={isMine ? 'text-yellow-400' : 'text-white'}>
                          {isMine ? 'You (Creator)' : shortWallet(msg.sender_wallet)}
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

            {chatError && <div className="text-xs text-red-400 mb-3">{chatError}</div>}

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
                placeholder="Send update to your community"
                className="flex-1 rounded bg-black/20 border border-white/10 px-3 py-2 text-sm text-white placeholder:text-gray-500"
                maxLength={800}
              />
              <button
                type="button"
                onClick={handleSendChat}
                disabled={chatSending || stickerSending || !chatInput.trim()}
                className="px-3 py-2 rounded bg-yellow-500 text-black text-sm font-semibold disabled:opacity-60"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-2 flex flex-wrap items-center gap-2">
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

          {/* Analytics */}
          <div className="glass-card p-6">
            <BarChart3 className="w-10 h-10 text-[#12D9C8] mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Analytics</h3>
            <p className="text-gray-400 mb-4">
              View your stream analytics: viewers, engagement, volume impact.
            </p>
            <div className="text-sm text-gray-500">Coming Soon</div>
          </div>

          {/* Followers */}
          <div className="glass-card p-6">
            <Users className="w-10 h-10 text-[#12D9C8] mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Followers</h3>
            <p className="text-gray-400 mb-4">
              See who is following you and track your community growth.
            </p>
            <div className="text-sm text-[#12D9C8]">{followerCount} followers</div>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="glass-card p-6">
            <div className="text-3xl font-bold text-white mb-2">0</div>
            <div className="text-gray-400">Total Streams</div>
          </div>
          <div className="glass-card p-6">
            <div className="text-3xl font-bold text-white mb-2">0</div>
            <div className="text-gray-400">Total Viewers</div>
          </div>
          <div className="glass-card p-6">
            <div className="text-3xl font-bold text-white mb-2">{followerCount}</div>
            <div className="text-gray-400">Followers</div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="glass-card p-6">
          <h2 className="text-2xl font-bold text-white mb-4">Recent Activity</h2>
          <div className="text-center py-8 text-gray-400">
            <p>No recent activity yet.</p>
            <p className="text-sm mt-2">Start streaming, posting updates, and chatting with followers.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
