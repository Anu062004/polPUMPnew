'use client'

import React, { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useAccount } from 'wagmi'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Users,
  Activity,
  ExternalLink,
  Copy,
  Check,
} from 'lucide-react'
import PremiumNavbar from '../../components/PremiumNavbar'
import BlobBackground from '../../components/BlobBackground'
import CoinImage from '../../components/CoinImage'
import EnhancedTradingCard from '../../components/EnhancedTradingCard'
import LiveStreamPlayer from '../../../components/LiveStreamPlayer'
import TokenLiveStreamControls, { TokenStreamInfo } from '../../../components/TokenLiveStreamControls'
import Link from 'next/link'
import { usePumpAI } from '../../providers/PumpAIContext'

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

export default function TokenDetailPage() {
  const params = useParams()
  const address = params.address as string
  const { address: userAddress } = useAccount()
  const [token, setToken] = useState<TokenDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  
  // Livestream state
  const [isLive, setIsLive] = useState(false)
  const [playbackUrl, setPlaybackUrl] = useState<string | null>(null)
  const [streamInfo, setStreamInfo] = useState<TokenStreamInfo | null>(null)
  const { setMemory } = usePumpAI()

  const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'
  
  // Check if current user is creator (handle empty creator string)
  const isCreator = userAddress && token && token.creator && 
    userAddress.toLowerCase() === token.creator.toLowerCase()

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

  async function checkLivestreamStatus() {
    if (!address) return // address is the token address from URL params
    
    try {
      const res = await fetch(`/api/stream/status?tokenAddress=${encodeURIComponent(address)}`)
      const data = await res.json()
      
      if (data.success) {
        setIsLive(data.isLive)
        if (data.playbackUrl) {
          setPlaybackUrl(data.playbackUrl)
        } else if (data.isLive) {
          // Build playback URL if live but URL not provided
          const streamKey = `token_${address.toLowerCase()}`
          const playbackBase = process.env.NEXT_PUBLIC_LIVE_PLAYBACK_BASE_URL || 'https://your-stream-server.com/hls'
          setPlaybackUrl(`${playbackBase.replace(/\/$/, '')}/${streamKey}.m3u8`)
        }
      }
    } catch (e) {
      // Silently fail - status check is optional
      console.warn('Failed to check livestream status:', e)
    }
  }

  const loadTokenDetail = async () => {
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
              <div className="glass-card">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-bold text-white">Livestream</h2>
                  {isLive && (
                    <div className="flex items-center gap-2 bg-red-600 px-3 py-1 rounded-full">
                      <span className="h-2 w-2 rounded-full bg-white animate-pulse"></span>
                      <span className="text-white font-bold text-sm">LIVE</span>
                    </div>
                  )}
                </div>
                
                {isLive && playbackUrl ? (
                  <div className="mb-6">
                    <LiveStreamPlayer streamUrl={playbackUrl} />
                  </div>
                ) : (
                  <div className="mb-6 rounded-xl bg-[#1a0b2e]/60 aspect-video flex items-center justify-center">
                    <div className="text-center text-gray-400">
                      <p className="text-lg mb-2">Creator is currently offline</p>
                      <p className="text-sm">The livestream will appear here when the creator goes live</p>
                    </div>
                  </div>
                )}

                {isCreator && (
                  <div className="border-t border-white/10 pt-6 mt-6">
                    <TokenLiveStreamControls
                      tokenAddress={token.token_address}
                      tokenCreator={token.creator}
                      onStreamStart={(info) => {
                        setStreamInfo(info)
                        setPlaybackUrl(info.playbackUrl)
                        setIsLive(true)
                        // Refresh status after a short delay
                        setTimeout(() => checkLivestreamStatus(), 2000)
                      }}
                      onStreamStop={() => {
                        setStreamInfo(null)
                        setPlaybackUrl(null)
                        setIsLive(false)
                        // Refresh status
                        setTimeout(() => checkLivestreamStatus(), 1000)
                      }}
                    />
                  </div>
                )}
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
                description={`${token.name} (${token.symbol}) - A memecoin on Polygon Amoy`}
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
