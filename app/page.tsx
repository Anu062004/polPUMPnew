'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Sparkles, TrendingUp, Zap } from 'lucide-react'
import Link from 'next/link'
import PremiumNavbar from './components/PremiumNavbar'
import PremiumTokenCard from './components/PremiumTokenCard'
import TokenCreatorModal from './components/TokenCreatorModal'
import { useAccount } from 'wagmi'
import { CoinData, ogStorageSDK } from '../lib/0gStorageSDK'

interface ExtendedCoinData extends CoinData {
  tokenAddress?: string
  curveAddress?: string
  txHash?: string
  telegramUrl?: string
  xUrl?: string
  discordUrl?: string
  websiteUrl?: string
  imageHash?: string
  volume_24h?: string
  trades_count?: number
  unique_traders?: number
}

export default function HomePage() {
  const { isConnected, address } = useAccount()
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false)
  const [trendingCoins, setTrendingCoins] = useState<ExtendedCoinData[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    console.log('🟢 Modal state changed:', isTokenModalOpen)
  }, [isTokenModalOpen])

  // Helper function to deduplicate coins based on unique identifiers
  const deduplicateCoins = (coins: ExtendedCoinData[]): ExtendedCoinData[] => {
    const seen = new Set<string>()
    const unique: ExtendedCoinData[] = []

    for (const coin of coins) {
      // Create a unique key from tokenAddress, id, or symbol
      const key = coin.tokenAddress?.toLowerCase() ||
        coin.id?.toLowerCase() ||
        `${coin.symbol?.toLowerCase()}-${coin.name?.toLowerCase()}` ||
        coin.txHash?.toLowerCase() ||
        ''

      if (key && !seen.has(key)) {
        seen.add(key)
        unique.push(coin)
      }
    }

    return unique
  }

  const loadStoredCoins = async () => {
    try {
      console.log('🔄 Loading coins...')

      // Always try backend first for most up-to-date data
      const backendBase =
        (typeof process !== 'undefined' &&
          (process as any).env &&
          (process as any).env.NEXT_PUBLIC_BACKEND_URL) ||
        'http://localhost:4000'

      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3000) // 3 second timeout

        const res = await fetch(`${backendBase}/api/coins`, {
          cache: 'no-store',
          signal: controller.signal
        }).catch((fetchError: any) => {
          // Silently handle connection errors
          if (fetchError.name === 'AbortError' ||
            fetchError.message?.includes('Failed to fetch') ||
            fetchError.message?.includes('ERR_CONNECTION_REFUSED')) {
            return null
          }
          throw fetchError
        })

        clearTimeout(timeoutId)

        if (!res) {
          throw new Error('Backend not available')
        }

        if (res.ok) {
          const data = await res.json()
          console.log('✅ Loaded coins from backend:', data.coins?.length || 0)

          const mapped = (data.coins || []).map((c: any) => ({
            id: c.id || c.txHash,
            name: c.name,
            symbol: c.symbol,
            supply: c.supply,
            description: c.description,
            imageUrl: c.imageHash ? `/api/image/${c.imageHash}` : '',
            imageHash: c.imageHash,
            imageRootHash: c.imageHash,
            createdAt: new Date(c.createdAt).toISOString(),
            creator: c.creator,
            txHash: c.txHash,
            tokenAddress: c.tokenAddress,
            curveAddress: c.curveAddress,
            volume_24h: c.volume_24h || '0',
            trades_count: c.trades_count || 0,
            unique_traders: c.unique_traders || 0,
          })) as ExtendedCoinData[]

          // Deduplicate coins before sorting
          const unique = deduplicateCoins(mapped)

          const sorted = [...unique].sort(
            (a, b) =>
              new Date(b.createdAt as any).getTime() -
              new Date(a.createdAt as any).getTime()
          )
          setTrendingCoins(sorted.slice(0, 6))

          // Also sync to localStorage for offline access
          if (unique.length > 0) {
            await ogStorageSDK.saveCoinToLocal(unique[0])
          }
          return
        }
      } catch (e: any) {
        // Silently fall back to localStorage if backend is not available
        // Don't log connection errors to avoid console spam
        if (e.name !== 'AbortError' &&
          !e.message?.includes('Failed to fetch') &&
          !e.message?.includes('ERR_CONNECTION_REFUSED')) {
          console.log('⚠️ Backend not available, using localStorage')
        }
      }

      // Fallback to localStorage if backend fails
      const storedCoins = await ogStorageSDK.getAllCoins()
      console.log('📦 Loaded coins from localStorage:', storedCoins.length)

      if (storedCoins.length > 0) {
        // Deduplicate coins from localStorage
        const unique = deduplicateCoins(storedCoins as ExtendedCoinData[])
        const sorted = [...unique].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        setTrendingCoins(sorted.slice(0, 6))
      }
    } catch (error) {
      console.error('❌ Error loading coins:', error)
    }
  }

  useEffect(() => {
    if (mounted) {
      loadStoredCoins()
    }
  }, [mounted])

  const handleCoinCreated = async (tokenData: any) => {
    try {
      console.log('🎉 Token created, refreshing list...', tokenData)

      // Validate that we have both addresses before proceeding
      if (!tokenData.tokenAddress || !tokenData.curveAddress) {
        console.error('❌ Token data missing addresses:', {
          tokenAddress: tokenData.tokenAddress,
          curveAddress: tokenData.curveAddress
        })
        alert('Error: Token addresses are missing. Please try creating the token again.')
        return
      }

      // Save to backend database
      const backendBase =
        (typeof process !== 'undefined' &&
          (process as any).env &&
          (process as any).env.NEXT_PUBLIC_BACKEND_URL) ||
        'http://localhost:4000'

      let saveSuccess = false
      let saveError: string | null = null

      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // Increased timeout

        const response = await fetch(`${backendBase}/api/coins`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: tokenData.name,
            symbol: tokenData.symbol,
            supply: tokenData.supply,
            description: tokenData.description,
            imageHash: tokenData.imageHash,
            tokenAddress: tokenData.tokenAddress,
            curveAddress: tokenData.curveAddress,
            txHash: tokenData.txHash,
            creator: address || 'Unknown',
            telegramUrl: tokenData.telegramUrl,
            xUrl: tokenData.xUrl,
            discordUrl: tokenData.discordUrl,
            websiteUrl: tokenData.websiteUrl,
          }),
          signal: controller.signal
        }).catch((fetchError: any) => {
          // Silently handle connection errors - backend not available
          if (fetchError.name === 'AbortError' ||
            fetchError.message?.includes('Failed to fetch') ||
            fetchError.message?.includes('ERR_CONNECTION_REFUSED')) {
            return null
          }
          throw fetchError
        })

        clearTimeout(timeoutId)

        if (response && response.ok) {
          const result = await response.json()
          if (result.success) {
            console.log('✅ Token saved to backend database')
            saveSuccess = true
          } else {
            saveError = result.error || 'Failed to save token'
            console.error('❌ Backend save failed:', saveError)
          }
        } else if (!response) {
          // Backend not available, try Next.js API route instead
          console.log('Backend not available, trying Next.js API...')
          try {
            const localResponse = await fetch('/api/coins', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                name: tokenData.name,
                symbol: tokenData.symbol,
                supply: tokenData.supply,
                description: tokenData.description,
                imageHash: tokenData.imageHash,
                tokenAddress: tokenData.tokenAddress,
                curveAddress: tokenData.curveAddress,
                txHash: tokenData.txHash,
                creator: address || 'Unknown',
                telegramUrl: tokenData.telegramUrl,
                xUrl: tokenData.xUrl,
                discordUrl: tokenData.discordUrl,
                websiteUrl: tokenData.websiteUrl,
              }),
            })
            if (localResponse.ok) {
              const result = await localResponse.json()
              if (result.success) {
                console.log('✅ Token saved to local database')
                saveSuccess = true
              } else {
                saveError = result.error || 'Failed to save token'
                console.error('❌ Local save failed:', saveError)
              }
            } else {
              const errorData = await localResponse.json().catch(() => ({}))
              saveError = errorData.error || `HTTP ${localResponse.status}: Failed to save token`
              console.error('❌ Local API returned error:', saveError)
            }
          } catch (localErr: any) {
            saveError = localErr.message || 'Failed to save token'
            console.error('❌ Local API exception:', localErr)
          }
        } else {
          const errorData = await response.json().catch(() => ({}))
          saveError = errorData.error || `HTTP ${response.status}: Failed to save token`
          console.error('❌ Backend API returned error:', saveError)
        }
      } catch (e: any) {
        saveError = e.message || 'Failed to save token'
        console.error('❌ Save exception:', e)
      }

      // Only proceed if save was successful
      if (!saveSuccess) {
        alert(`Failed to save token to database: ${saveError}\n\nThe token was created on-chain, but couldn't be saved. Please refresh the page and try again.`)
        return
      }

      // Create coin object for immediate display
      const coin: ExtendedCoinData = {
        id: tokenData.txHash || `coin-${Date.now()}`,
        name: tokenData.name,
        symbol: tokenData.symbol,
        supply: tokenData.supply,
        description: tokenData.description,
        imageUrl: tokenData.imageHash ? `/api/image/${tokenData.imageHash}` : '',
        imageHash: tokenData.imageHash,
        imageRootHash: tokenData.imageHash,
        createdAt: new Date().toISOString(),
        creator: address || 'Unknown',
        txHash: tokenData.txHash,
        tokenAddress: tokenData.tokenAddress,
        curveAddress: tokenData.curveAddress,
      } as any

      // Save to localStorage as backup
      await ogStorageSDK.saveCoinToLocal(coin)

      // Add to trending coins immediately (with deduplication)
      setTrendingCoins((prev) => {
        const combined = [coin, ...prev]
        const unique = deduplicateCoins(combined)
        return unique.slice(0, 6)
      })

      // Reload all coins from backend to ensure sync
      setTimeout(() => {
        loadStoredCoins()
      }, 1000)
    } catch (e) {
      console.error('❌ Failed to handle coin creation:', e)
    }
  }

  return (
    <div className="min-h-screen text-white bg-[#0f172a]">
      <PremiumNavbar />

      {/* Hero Section */}
      <section className="relative pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center space-y-8"
          >
            <h1 className="text-6xl md:text-7xl font-bold leading-tight">
              <span className="text-white">Create, Trade &</span>
              <br />
              <span className="text-blue-500">Earn Tokens</span>
            </h1>

            <p className="text-xl md:text-2xl text-[#E3E4E8] max-w-3xl mx-auto leading-relaxed">
              Launch your memecoin in seconds with bonding curves. Trade instantly,
              earn XP, and compete on leaderboards. The future of token creation is here.
            </p>

            <div className="flex flex-col items-center justify-center gap-4 pt-4">
              {!isConnected && mounted && (
                <div className="text-yellow-300 text-sm bg-yellow-500/20 px-4 py-2 rounded-lg border border-yellow-500/30">
                  ⚠️ Please connect your wallet first to create tokens
                </div>
              )}
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <motion.button
                  whileHover={{ scale: mounted && isConnected ? 1.05 : 1 }}
                  whileTap={{ scale: mounted && isConnected ? 0.95 : 1 }}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (!mounted || !isConnected) {
                      alert('Please connect your wallet first!\n\nClick the "Connect Wallet" button in the top right corner.')
                      return
                    }
                    setIsTokenModalOpen(true)
                  }}
                  disabled={!mounted || !isConnected}
                  className={`btn-primary ${!mounted || !isConnected ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:shadow-lg'}`}
                  type="button"
                  title={!mounted || !isConnected ? 'Connect wallet first' : 'Create your first token'}
                >
                  {!mounted || !isConnected ? '🔒 Connect Wallet to Create Token' : 'Create Your First Token'}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </motion.button>
                <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                  <Link href="/explore" className="btn-secondary inline-flex items-center justify-center cursor-pointer">
                    Explore Tokens
                    <Sparkles className="w-5 h-5 ml-2" />
                  </Link>
                </motion.div>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.8 }}
              className="flex flex-wrap items-center justify-center gap-8 pt-12"
            >
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-500">{trendingCoins.length}+</div>
                <div className="text-sm text-slate-400 mt-1">Tokens Created</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-emerald-500">Instant</div>
                <div className="text-sm text-slate-400 mt-1">Trading</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-500">0.5%</div>
                <div className="text-sm text-slate-400 mt-1">Low Fees</div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Trending Tokens Section */}
      {trendingCoins.length > 0 && (
        <section className="relative py-20 px-6">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="mb-12"
            >
              <div className="flex items-center gap-3 mb-4">
                <TrendingUp className="w-6 h-6 text-blue-500" />
                <h2 className="text-4xl font-bold text-white">Trending Tokens</h2>
              </div>
              <p className="text-slate-400 text-lg">Discover the hottest tokens on POL Pump</p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {trendingCoins.map((coin, index) => (
                <PremiumTokenCard key={coin.id || index} token={coin} index={index} />
              ))}
            </div>

            <div className="text-center mt-12">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                <Link href="/explore" className="btn-secondary inline-flex items-center justify-center">
                  View All Tokens
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Link>
              </motion.div>
            </div>
          </div>
        </section>
      )}

      {/* Features Section */}
      <section className="relative py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            <div className="glass-card p-6">
              <Zap className="w-10 h-10 text-blue-500 mb-4" />
              <h3 className="text-2xl font-bold text-white mb-2">Instant Launch</h3>
              <p className="text-slate-400">
                Deploy your memecoin with a single click. Bonding curve ensures immediate liquidity.
              </p>
            </div>
            <div className="glass-card p-6">
              <Sparkles className="w-10 h-10 text-emerald-500 mb-4" />
              <h3 className="text-2xl font-bold text-white mb-2">Creator Rewards</h3>
              <p className="text-slate-400">
                Earn XP, climb leaderboards, and unlock exclusive perks as you create tokens.
              </p>
            </div>
            <div className="glass-card p-6">
              <TrendingUp className="w-10 h-10 text-blue-500 mb-4" />
              <h3 className="text-2xl font-bold text-white mb-2">Built for Trading</h3>
              <p className="text-slate-400">
                Trade instantly with bonding curves. Sell when you're ready or migrate to DEX.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      <TokenCreatorModal
        isOpen={isTokenModalOpen}
        onClose={() => setIsTokenModalOpen(false)}
        onTokenCreated={handleCoinCreated}
      />
    </div>
  )
}
