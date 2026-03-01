'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { TrendingUp, Clock, Flame, Sparkles, Users } from 'lucide-react'
import PremiumNavbar from '../components/PremiumNavbar'
import BlobBackground from '../components/BlobBackground'
import PremiumTokenCard from '../components/PremiumTokenCard'
import { Button } from '@/components/ui/button'

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
  const [sortBy, setSortBy] = useState<SortOption>('created_at')
  const [filterBy, setFilterBy] = useState<FilterOption>('all')
  const [activeTab, setActiveTab] = useState<ExploreTab>('tokens')
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [searchFocused, setSearchFocused] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const sortRef = useRef<HTMLDivElement>(null)

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
  }, [activeTab, page, sortBy, filterBy, searchQuery])

  useEffect(() => {
    setPage(1)
  }, [searchQuery, activeTab])

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

      const mappedCoins = resolvedCoins.map(mapToExploreToken)
      console.log('Loaded tokens:', mappedCoins.length)
      setTokens(mappedCoins)
      setTotalPages(Math.max(1, resolvedCoins.length > 0 ? resolvedTotalPages : 1))
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

  // Close sort dropdown on outside click
  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [])

  const sortLabels: Record<SortOption, string> = {
    volume_24h: 'Volume 24h',
    trades_count: 'Most Traded',
    created_at: 'Recently Created',
    name: 'Name',
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

          {/* ── Premium Search & Filter Panel ── */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mb-8 flex flex-col gap-8"
          >
            {/* ── Pill Tabs + Network Status Row ── */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <div className="flex items-center gap-2 p-1 bg-black/20 rounded-full border border-white/5 backdrop-blur-md self-start">
                {/* Tokens Tab */}
                <button
                  onClick={() => setActiveTab('tokens')}
                  className={`relative px-6 py-2.5 rounded-full text-sm font-medium text-white transition-all duration-300 group overflow-hidden ${activeTab === 'tokens' ? '' : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                  {activeTab === 'tokens' && (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-500 opacity-90 group-hover:opacity-100 transition-opacity rounded-full" />
                      <div className="absolute inset-0 rounded-full ring-1 ring-white/20" />
                    </>
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3" /><path d="M3 5v14a9 3 0 0 0 18 0V5" /><path d="M3 12a9 3 0 0 0 18 0" /></svg>
                    Tokens
                  </span>
                </button>
                {/* Creators Tab */}
                <button
                  onClick={() => setActiveTab('creators')}
                  className={`relative px-6 py-2.5 rounded-full text-sm font-medium transition-all duration-300 group overflow-hidden ${activeTab === 'creators'
                      ? 'text-white'
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                >
                  {activeTab === 'creators' && (
                    <>
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-cyan-500 opacity-90 group-hover:opacity-100 transition-opacity rounded-full" />
                      <div className="absolute inset-0 rounded-full ring-1 ring-white/20" />
                    </>
                  )}
                  <span className="relative z-10 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>
                    Creators
                  </span>
                </button>
              </div>

              <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-500">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
                </span>
                Network Sync Active
              </div>
            </div>

            {/* ── Mega Search Bar ── */}
            <div className="relative w-full" style={{ zIndex: 30 }}>
              {/* Hover ambient glow */}
              <div
                className="pointer-events-none absolute -inset-px rounded-[2rem] transition-opacity duration-500"
                style={{
                  background: 'linear-gradient(90deg,rgba(59,130,246,0.18),rgba(34,211,238,0.18),rgba(99,102,241,0.18))',
                  opacity: searchFocused ? 0 : undefined,
                  filter: 'blur(10px)',
                }}
              />
              {/* Focus glow */}
              {searchFocused && (
                <div
                  className="pointer-events-none absolute -inset-0.5 rounded-[2rem] transition-opacity duration-300"
                  style={{
                    background: 'linear-gradient(90deg,#3b82f6,#22d3ee,#6366f1)',
                    filter: 'blur(12px)',
                    opacity: 0.9,
                  }}
                />
              )}

              {/* Input container */}
              <div
                className="relative flex items-center rounded-[2rem] p-1.5 sm:p-2 border transition-all duration-300"
                style={{
                  background: searchFocused ? 'rgba(10,20,42,0.92)' : 'rgba(7,16,41,0.80)',
                  backdropFilter: 'blur(24px)',
                  borderColor: searchFocused ? 'transparent' : 'rgba(255,255,255,0.10)',
                  boxShadow: 'inset 0 2px 15px rgba(255,255,255,0.03)',
                }}
              >
                {/* Gradient border on focus */}
                {searchFocused && (
                  <div
                    className="pointer-events-none absolute inset-0 rounded-[2rem] p-px"
                    style={{
                      background: 'linear-gradient(90deg,#3b82f6,#22d3ee,#6366f1)',
                      WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                      WebkitMaskComposite: 'xor',
                      maskComposite: 'exclude',
                    }}
                  />
                )}

                {/* Search icon */}
                <div
                  className="flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center ml-1 transition-all duration-300"
                  style={{
                    background: searchFocused ? 'rgba(59,130,246,0.20)' : 'rgba(59,130,246,0.10)',
                    border: `1px solid ${searchFocused ? 'rgba(59,130,246,0.4)' : 'rgba(59,130,246,0.20)'}`,
                    color: searchFocused ? '#67e8f9' : '#60a5fa',
                    boxShadow: searchFocused
                      ? '0 0 25px rgba(34,211,238,0.30)'
                      : '0 0 20px rgba(59,130,246,0.15)',
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" /></svg>
                </div>

                {/* Input */}
                <input
                  type="text"
                  placeholder={
                    activeTab === 'tokens'
                      ? 'Search tokens, symbols, or creators...'
                      : 'Search creators by wallet address...'
                  }
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  className="w-full bg-transparent border-none outline-none text-slate-100 placeholder-slate-500 text-base sm:text-lg px-4 sm:px-6 font-medium h-12 sm:h-14 focus:ring-0"
                />

                {/* Right actions */}
                <div className="flex-shrink-0 flex items-center gap-2 sm:gap-3 pr-2">
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="w-8 h-8 rounded-full flex items-center justify-center text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all duration-200"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="m15 9-6 6M9 9l6 6" /></svg>
                    </button>
                  )}
                  <div className="hidden sm:flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-slate-400 text-xs font-medium">
                    <span style={{ fontSize: '0.8rem' }}>⌘</span><span className="tracking-widest">K</span>
                  </div>
                  <div className="w-px h-8 bg-white/10 hidden sm:block" />
                  <button className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-slate-400 hover:text-cyan-400 hover:bg-cyan-500/10 border border-transparent hover:border-cyan-500/20 transition-all duration-300">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><circle cx="17.5" cy="17.5" r="3.5" /><path d="M17.5 16v3M16 17.5h3" /></svg>
                  </button>
                </div>
              </div>
            </div>

            {/* ── Filter Pills + Sort Dropdown ── */}
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 w-full">
              {/* Filter pills */}
              {activeTab === 'tokens' ? (
                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  {/* All Tokens */}
                  <button
                    onClick={() => setFilterBy('all')}
                    className={`relative px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 flex items-center gap-2 overflow-hidden group ${filterBy === 'all'
                        ? 'text-white border border-indigo-400/40'
                        : 'text-slate-400 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white hover:border-cyan-500/30 hover:-translate-y-0.5'
                      }`}
                    style={filterBy === 'all' ? {
                      background: 'linear-gradient(135deg,rgba(99,102,241,0.2),rgba(59,130,246,0.2))',
                      boxShadow: '0 0 20px rgba(99,102,241,0.2),inset 0 0 15px rgba(99,102,241,0.1)',
                    } : {}}
                  >
                    {filterBy === 'all' && <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-blue-500 opacity-0 group-hover:opacity-20 transition-opacity" />}
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-indigo-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="9" height="9" rx="1" /><rect x="13" y="2" width="9" height="9" rx="1" /><rect x="2" y="13" width="9" height="9" rx="1" /><rect x="13" y="13" width="9" height="9" rx="1" /></svg>
                    All Tokens
                  </button>

                  <button
                    onClick={() => setFilterBy('trending')}
                    className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 flex items-center gap-2 ${filterBy === 'trending'
                        ? 'text-white bg-white/10 border border-white/20'
                        : 'text-slate-400 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white hover:border-cyan-500/30 hover:-translate-y-0.5'
                      }`}
                  >
                    <Flame className="w-4 h-4" />
                    Trending
                  </button>

                  <button
                    onClick={() => setFilterBy('newest')}
                    className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 flex items-center gap-2 ${filterBy === 'newest'
                        ? 'text-white bg-white/10 border border-white/20'
                        : 'text-slate-400 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white hover:border-blue-500/30 hover:-translate-y-0.5'
                      }`}
                  >
                    <Clock className="w-4 h-4" />
                    Newest
                  </button>

                  <button
                    onClick={() => setFilterBy('most_traded')}
                    className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 flex items-center gap-2 ${filterBy === 'most_traded'
                        ? 'text-white bg-white/10 border border-white/20'
                        : 'text-slate-400 bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white hover:border-violet-500/30 hover:-translate-y-0.5'
                      }`}
                  >
                    <TrendingUp className="w-4 h-4" />
                    Most Traded
                  </button>
                </div>
              ) : (
                <div className="flex items-center px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-sm text-slate-300">
                  {filteredCreators.length} creator wallets
                </div>
              )}

              {/* Sort Dropdown */}
              {activeTab === 'tokens' && (
                <div ref={sortRef} className="relative mt-2 md:mt-0 ml-auto md:ml-0">
                  <button
                    onClick={() => setSortOpen((o) => !o)}
                    className="px-5 py-2.5 rounded-xl text-sm font-medium text-slate-200 border border-white/10 hover:border-blue-500/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.2)] transition-all duration-300 flex items-center gap-3 w-full md:w-auto justify-between"
                    style={{ background: '#0d162b' }}
                  >
                    <span className="text-slate-500 font-normal">Sort by:</span>
                    {sortLabels[sortBy]}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className={`w-4 h-4 text-slate-400 transition-transform duration-300 ${sortOpen ? 'rotate-180 text-blue-400' : ''}`}
                      viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                    >
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>

                  {sortOpen && (
                    <div
                      className="absolute right-0 top-full mt-2 w-52 rounded-xl border border-white/10 overflow-hidden py-1"
                      style={{
                        background: 'rgba(11,18,32,0.97)',
                        backdropFilter: 'blur(24px)',
                        boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5),0 0 20px rgba(59,130,246,0.10)',
                        zIndex: 50,
                      }}
                    >
                      {([
                        { value: 'volume_24h', label: 'Volume 24h' },
                        { value: 'trades_count', label: 'Most Traded' },
                        { value: 'created_at', label: 'Recently Created' },
                        { value: 'name', label: 'Name' },
                      ] as { value: SortOption; label: string }[]).map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => { setSortBy(opt.value); setSortOpen(false) }}
                          className={`w-full text-left px-4 py-2.5 text-sm font-medium flex items-center justify-between transition-colors ${sortBy === opt.value
                              ? 'text-cyan-400 bg-blue-500/10'
                              : 'text-slate-300 hover:text-white hover:bg-white/5'
                            }`}
                        >
                          {opt.label}
                          {sortBy === opt.value && (
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
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
