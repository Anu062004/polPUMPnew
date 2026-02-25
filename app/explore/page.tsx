'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Search, TrendingUp, Clock, Flame, ArrowUpDown, Sparkles, Users } from 'lucide-react'
import PremiumNavbar from '../components/PremiumNavbar'
import BlobBackground from '../components/BlobBackground'
import PremiumTokenCard from '../components/PremiumTokenCard'
import { Button } from '@/components/ui/button'
import { ogStorageSDK } from '../../lib/0gStorageSDK'

interface Token {
  id: number | string
  token_address: string
  name: string
  symbol: string
  creator: string
  volume_24h: string
  trades_count: number
  unique_traders: number
  created_at: string
  imageHash?: string
  description?: string
  imageRootHash?: string
}

interface Creator {
  wallet: string
  createdAt: number
  followerCount: number
  tokenCount: number
  latestTokenAddress: string | null
}

type SortOption = 'volume_24h' | 'created_at' | 'trades_count' | 'name'
type FilterOption = 'all' | 'trending' | 'newest' | 'most_traded'
type ExploreTab = 'tokens' | 'creators'

function mapToExploreToken(coin: any): Token {
  const tokenAddress = coin.tokenAddress || coin.token_address || ''
  const createdAtRaw = coin.created_at || coin.createdAt || 0
  const createdAt =
    typeof createdAtRaw === 'number'
      ? new Date(createdAtRaw).toISOString()
      : typeof createdAtRaw === 'string'
        ? createdAtRaw
        : new Date(0).toISOString()

  return {
    id: coin.id || coin.txHash || `${coin.symbol || 'token'}-${coin.name || 'coin'}-${createdAt}`,
    token_address: tokenAddress,
    name: coin.name || 'Unknown Token',
    symbol: coin.symbol || 'UNK',
    creator: coin.creator || '',
    volume_24h: String(coin.volume_24h ?? coin.volume24h ?? 0),
    trades_count: Number(coin.trades_count ?? coin.totalTransactions ?? 0),
    unique_traders: Number(coin.unique_traders ?? coin.holders ?? 0),
    created_at: createdAt,
    imageHash: coin.imageHash || coin.image_hash,
    description: coin.description || '',
    imageRootHash: coin.imageRootHash || coin.imageHash || coin.image_hash,
  }
}

function shortWallet(wallet: string): string {
  if (!wallet) return '-'
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`
}

export default function ExplorePage() {
  const [tokens, setTokens] = useState<Token[]>([])
  const [filteredTokens, setFilteredTokens] = useState<Token[]>([])
  const [creators, setCreators] = useState<Creator[]>([])
  const [filteredCreators, setFilteredCreators] = useState<Creator[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('volume_24h')
  const [filterBy, setFilterBy] = useState<FilterOption>('all')
  const [activeTab, setActiveTab] = useState<ExploreTab>('tokens')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'

  const fetchTokenPayload = async (
    endpoint: string
  ): Promise<{ coins: any[]; totalPages: number } | null> => {
    try {
      const response = await fetch(endpoint, { cache: 'no-store' })
      if (!response.ok) return null

      const data = await response.json()
      if (data?.success === false) return null

      const coins = Array.isArray(data?.coins)
        ? data.coins
        : Array.isArray(data?.tokens)
          ? data.tokens
          : []

      return {
        coins,
        totalPages: Math.max(1, Number(data?.pagination?.totalPages || 1)),
      }
    } catch {
      return null
    }
  }

  useEffect(() => {
    if (activeTab === 'tokens') {
      loadTokens()
    } else {
      loadCreators()
    }
  }, [activeTab, page, sortBy, filterBy])

  useEffect(() => {
    applyFilters()
  }, [searchQuery, tokens, creators, sortBy, filterBy, activeTab])

  const loadTokens = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        sort: sortBy,
        order: 'DESC',
      })

      if (searchQuery) {
        params.append('search', searchQuery)
      }

      const endpoints = [
        `/api/coins?${params}`,
        `${API_BASE}/api/coins?${params}`,
        `${API_BASE}/api/tokens?${params}`,
      ]

      let resolvedCoins: any[] = []
      let resolvedTotalPages = 1

      for (const endpoint of endpoints) {
        const payload = await fetchTokenPayload(endpoint)
        if (!payload) continue
        resolvedCoins = payload.coins
        resolvedTotalPages = payload.totalPages
        if (payload.coins.length > 0) break
      }

      if (resolvedCoins.length === 0) {
        const localCoins = await ogStorageSDK.getAllCoins()
        resolvedCoins = localCoins.map((coin: any) => ({
          ...coin,
          tokenAddress: coin.tokenAddress || coin.token_address || '',
          volume_24h: String(coin.volume_24h ?? coin.volume24h ?? 0),
          trades_count: Number(coin.trades_count ?? 0),
          unique_traders: Number(coin.unique_traders ?? 0),
        }))
        resolvedTotalPages = 1
      }

      const mappedCoins = resolvedCoins.map(mapToExploreToken)
      console.log('Loaded tokens:', mappedCoins.length)
      setTokens(mappedCoins)
      setTotalPages(resolvedTotalPages)
    } catch (error) {
      console.error('Failed to load tokens:', error)
      setTokens([])
    } finally {
      setIsLoading(false)
    }
  }

  const loadCreators = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({
        limit: '200',
      })

      const response = await fetch(`/api/creators/public?${params}`)
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to load creators')
      }

      setCreators(Array.isArray(data.creators) ? data.creators : [])
    } catch (error) {
      console.error('Failed to load creators:', error)
      setCreators([])
    } finally {
      setIsLoading(false)
    }
  }

  const applyFilters = () => {
    if (activeTab === 'tokens') {
      let filtered = [...tokens]

      if (searchQuery) {
        filtered = filtered.filter(
          (token) =>
            token.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            token.symbol.toLowerCase().includes(searchQuery.toLowerCase())
        )
      }

      if (filterBy === 'trending') {
        filtered = filtered.filter((token) => parseFloat(token.volume_24h || '0') > 0)
        filtered.sort(
          (a, b) => parseFloat(b.volume_24h || '0') - parseFloat(a.volume_24h || '0')
        )
      } else if (filterBy === 'newest') {
        filtered.sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      } else if (filterBy === 'most_traded') {
        filtered.sort((a, b) => (b.trades_count || 0) - (a.trades_count || 0))
      }

      setFilteredTokens(filtered)
      return
    }

    let filtered = [...creators]

    if (searchQuery) {
      filtered = filtered.filter((creator) =>
        creator.wallet.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    if (sortBy === 'created_at') {
      filtered.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    } else {
      filtered.sort((a, b) => {
        if (b.followerCount !== a.followerCount) {
          return b.followerCount - a.followerCount
        }
        if (b.tokenCount !== a.tokenCount) {
          return b.tokenCount - a.tokenCount
        }
        return (b.createdAt || 0) - (a.createdAt || 0)
      })
    }

    setFilteredCreators(filtered)
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <BlobBackground />
      <PremiumNavbar />

      <div className="pt-24 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="mb-12"
          >
            <div className="flex items-center gap-3 mb-4">
              {activeTab === 'tokens' ? (
                <Sparkles className="w-8 h-8 text-blue-400" />
              ) : (
                <Users className="w-8 h-8 text-blue-400" />
              )}
              <h1 className="text-5xl font-bold text-white">
                {activeTab === 'tokens' ? 'Explore Tokens' : 'Explore Creators'}
              </h1>
            </div>
            <p className="text-[#E3E4E8] text-lg">
              {activeTab === 'tokens'
                ? 'Discover and trade memecoins on POL Pump'
                : 'Discover creator wallets, communities, and latest token launches'}
            </p>
          </motion.div>

          {/* Search and Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="glass-card mb-8"
          >
            {/* Explore Tabs */}
            <div className="flex flex-wrap gap-3 mb-6">
              <button
                onClick={() => setActiveTab('tokens')}
                className={`filter-pill ${activeTab === 'tokens' ? 'active' : ''}`}
              >
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Tokens
                </span>
              </button>
              <button
                onClick={() => setActiveTab('creators')}
                className={`filter-pill ${activeTab === 'creators' ? 'active' : ''}`}
              >
                <span className="flex items-center gap-2">
                  <Users className="w-4 h-4" />
                  Creators
                </span>
              </button>
            </div>

            <div className="flex flex-col md:flex-row gap-4 mb-6">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#E3E4E8]/60 w-5 h-5" />
                <input
                  type="text"
                  placeholder={
                    activeTab === 'tokens'
                      ? 'Search tokens by name or symbol...'
                      : 'Search creators by wallet address...'
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-glass pl-12"
                />
              </div>

              {/* Sort */}
              {activeTab === 'tokens' ? (
                <div className="flex items-center gap-2">
                  <ArrowUpDown className="w-5 h-5 text-[#E3E4E8]/60" />
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as SortOption)}
                    className="input-glass"
                  >
                    <option value="volume_24h">Volume 24h</option>
                    <option value="trades_count">Most Traded</option>
                    <option value="created_at">Newest</option>
                    <option value="name">Name</option>
                  </select>
                </div>
              ) : (
                <div className="flex items-center px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-sm text-[#E3E4E8]">
                  {filteredCreators.length} creator wallets
                </div>
              )}
            </div>

            {/* Token Filter Pills */}
            {activeTab === 'tokens' && (
              <div className="flex flex-wrap gap-3">
                {(['all', 'trending', 'newest', 'most_traded'] as FilterOption[]).map(
                  (filter) => (
                    <button
                      key={filter}
                      onClick={() => setFilterBy(filter)}
                      className={`filter-pill ${filterBy === filter ? 'active' : ''}`}
                    >
                      {filter === 'all' && 'All Tokens'}
                      {filter === 'trending' && (
                        <span className="flex items-center gap-2">
                          <Flame className="w-4 h-4" />
                          Trending
                        </span>
                      )}
                      {filter === 'newest' && (
                        <span className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          Newest
                        </span>
                      )}
                      {filter === 'most_traded' && (
                        <span className="flex items-center gap-2">
                          <TrendingUp className="w-4 h-4" />
                          Most Traded
                        </span>
                      )}
                    </button>
                  )
                )}
              </div>
            )}
          </motion.div>

          {/* Results */}
          {isLoading ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              <p className="text-[#E3E4E8] mt-4">
                {activeTab === 'tokens' ? 'Loading tokens...' : 'Loading creators...'}
              </p>
            </div>
          ) : activeTab === 'tokens' ? (
            filteredTokens.length === 0 ? (
              <div className="text-center py-20">
                <p className="text-[#E3E4E8] text-lg">No tokens found</p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                  {filteredTokens.map((token, index) => (
                    <PremiumTokenCard
                      key={token.id || index}
                      token={{
                        ...token,
                        id: String(token.id || ''),
                        tokenAddress: token.token_address,
                        imageHash: token.imageHash || token.imageRootHash,
                        imageRootHash: token.imageHash || token.imageRootHash,
                      }}
                      index={index}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center gap-4">
                    <Button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="btn-secondary disabled:opacity-50"
                    >
                      Previous
                    </Button>
                    <span className="px-6 py-3 text-[#E3E4E8] flex items-center">
                      Page {page} of {totalPages}
                    </span>
                    <Button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page >= totalPages}
                      className="btn-secondary disabled:opacity-50"
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )
          ) : filteredCreators.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-[#E3E4E8] text-lg">No creators found</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredCreators.map((creator) => (
                <div key={creator.wallet} className="glass-card p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="w-11 h-11 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white font-semibold">
                      {creator.wallet.slice(2, 4).toUpperCase()}
                    </div>
                    <span className="text-xs text-[#12D9C8] bg-[#12D9C8]/10 border border-[#12D9C8]/30 px-2 py-1 rounded-full">
                      {creator.followerCount} followers
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold text-white mb-1">{shortWallet(creator.wallet)}</h3>
                  <p className="text-sm text-gray-400 mb-4">{creator.tokenCount} associated tokens</p>

                  <div className="flex items-center gap-2">
                    <Link
                      href="/trader"
                      className="px-3 py-2 rounded-lg bg-[#12D9C8] text-black text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                      Follow Creator
                    </Link>
                    {creator.latestTokenAddress && (
                      <Link
                        href={`/token/${creator.latestTokenAddress}`}
                        className="px-3 py-2 rounded-lg border border-white/20 text-white text-sm hover:bg-white/10 transition-colors"
                      >
                        Latest Token
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
