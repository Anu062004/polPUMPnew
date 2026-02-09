'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Search, TrendingUp, Clock, Flame, ArrowUpDown, Sparkles } from 'lucide-react'
import PremiumNavbar from '../components/PremiumNavbar'
import BlobBackground from '../components/BlobBackground'
import PremiumTokenCard from '../components/PremiumTokenCard'
import { Button } from '@/components/ui/button'

interface Token {
  id: number
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

type SortOption = 'volume_24h' | 'created_at' | 'trades_count' | 'name'
type FilterOption = 'all' | 'trending' | 'newest' | 'most_traded'

export default function ExplorePage() {
  const [tokens, setTokens] = useState<Token[]>([])
  const [filteredTokens, setFilteredTokens] = useState<Token[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortOption>('volume_24h')
  const [filterBy, setFilterBy] = useState<FilterOption>('all')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'

  useEffect(() => {
    loadTokens()
  }, [page, sortBy, filterBy])

  useEffect(() => {
    applyFilters()
  }, [searchQuery, tokens, sortBy, filterBy])

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

      // Try /api/coins first (Next.js API route)
      let response = await fetch(`/api/coins?${params}`)
      if (!response.ok) {
        // Fallback to backend server
        response = await fetch(`${API_BASE}/api/coins?${params}`)
      }

      const data = await response.json()
      console.log('✅ Loaded tokens:', data.coins?.length || data.tokens?.length || 0)

      // Map API response to expected format
      const coins = (data.coins || data.tokens || []).map((c: any) => ({
        ...c,
        token_address: c.tokenAddress || c.token_address || '',
      }))
      setTokens(coins)
      setTotalPages(data.pagination?.totalPages || 1)
    } catch (error) {
      console.error('Failed to load tokens:', error)
      // Fallback to local storage if API fails
      try {
        const { ogStorageSDK } = await import('../../lib/0gStorageSDK')
        const storedCoins = await ogStorageSDK.getAllCoins()
        const mapped = storedCoins.map((c: any) => ({
          id: c.id || c.txHash,
          token_address: c.tokenAddress || '',
          name: c.name,
          symbol: c.symbol,
          creator: c.creator || '',
          volume_24h: '0',
          trades_count: 0,
          unique_traders: 0,
          created_at: c.createdAt || new Date().toISOString(),
          imageHash: c.imageHash || c.imageRootHash,
          description: c.description,
        }))
        setTokens(mapped)
      } catch (e) {
        console.error('Failed to load from storage:', e)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const applyFilters = () => {
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
              <Sparkles className="w-8 h-8 text-blue-400" />
              <h1 className="text-5xl font-bold text-white">Explore Tokens</h1>
            </div>
            <p className="text-[#E3E4E8] text-lg">
              Discover and trade memecoins on POL Pump
            </p>
          </motion.div>

          {/* Search and Filters */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="glass-card mb-8"
          >
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-[#E3E4E8]/60 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search tokens by name or symbol..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-glass pl-12"
                />
              </div>

              {/* Sort */}
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
            </div>

            {/* Filter Pills */}
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
          </motion.div>

          {/* Results */}
          {isLoading ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
              <p className="text-[#E3E4E8] mt-4">Loading tokens...</p>
            </div>
          ) : filteredTokens.length === 0 ? (
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
          )}
        </div>
      </div>
    </div>
  )
}
