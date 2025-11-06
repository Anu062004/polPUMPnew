'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import TokenCreatorModal from './components/TokenCreatorModal'
// Removed CoinDetailModal import - no card clicks wanted
import CoinImage from './components/CoinImage'
import EnhancedTradingCard from './components/EnhancedTradingCard'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { CoinData, ogStorageSDK } from '../lib/0gStorageSDK'

// Extended interface for coins with additional properties from backend
interface ExtendedCoinData extends CoinData {
  tokenAddress?: string
  curveAddress?: string // Add curve address for trading
  txHash?: string
  telegramUrl?: string
  xUrl?: string
  discordUrl?: string
  websiteUrl?: string
  imageHash?: string // Alias for imageRootHash for compatibility
}
import Link from 'next/link'
import {
  Home,
  Video,
  Zap,
  MessageCircle,
  User,
  HelpCircle,
  MoreHorizontal,
  Search,
  Plus,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  Filter,
  TrendingUp,
  Wallet,
  TrendingDown
} from 'lucide-react'

// Removed mock trending coins to avoid SSR/client mismatch

// Category definitions
const categoryDefinitions = [
  { name: 'Trending Titles', keywords: ['trending', 'popular', 'viral'], color: 'bg-slate-700/60', activeColor: 'bg-orange-500/60' },
  { name: 'Fast Money', keywords: ['fast', 'money', 'quick'], color: 'bg-slate-700/60', activeColor: 'bg-orange-500/60' },
  { name: 'Apple Companion', keywords: ['apple', 'tech', 'companion'], color: 'bg-slate-700/60', activeColor: 'bg-orange-500/60' },
  { name: 'Onchain House', keywords: ['onchain', 'house', 'defi'], color: 'bg-slate-700/60', activeColor: 'bg-orange-500/60' },
  { name: 'Pepeverse', keywords: ['pepe', 'frog', 'meme'], color: 'bg-slate-700/60', activeColor: 'bg-orange-500/60' },
  { name: 'Dog Obsession', keywords: ['dog', 'doge', 'puppy'], color: 'bg-slate-700/60', activeColor: 'bg-orange-500/60' },
  { name: 'NaiLo', keywords: ['nailo', 'nail'], color: 'bg-slate-700/60', activeColor: 'bg-orange-500/60' }
]

type SortOption = 'featured' | 'newest' | 'oldest' | 'name' | 'volume'

export default function App() {
  const { isConnected, address } = useAccount()
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false)
  const [trendingCoins, setTrendingCoins] = useState<ExtendedCoinData[]>([])
  const [allCoins, setAllCoins] = useState<ExtendedCoinData[]>([]) // Store all coins for search
  const [searchQuery, setSearchQuery] = useState('') // Search query state
  const [isLoading, setIsLoading] = useState(false) // Start with false since we don't have initial data
  const [mounted, setMounted] = useState(false)
  const [logoFailed, setLogoFailed] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<Set<string>>(new Set(['Trending Titles', 'Fast Money']))
  const [sortOption, setSortOption] = useState<SortOption>('featured')
  // Removed selectedCoin and isCoinDetailOpen - no card clicks wanted

  useEffect(() => {
    setMounted(true)
  }, [])

  // Load previously created coins from storage on startup
  useEffect(() => {
    const loadStoredCoins = async () => {
      try {
        setIsLoading(true);
        console.log('Loading coins from storage...');
        
        // Get all coins from storage
        const storedCoins = await ogStorageSDK.getAllCoins();
        
        if (storedCoins.length > 0) {
          console.log('Found stored coins:', storedCoins);
          const sorted = [...storedCoins].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          setAllCoins(sorted); // Store all coins for search
          setTrendingCoins(sorted); // Show ALL coins, not just first 6
        } else {
          console.log('No stored coins found');
          // Load from backend server (multi-wallet support)
          try {
            const backendBase = (typeof process !== 'undefined' && (process as any).env && (process as any).env.NEXT_PUBLIC_BACKEND_URL) || 'http://localhost:4000'
            const res = await fetch(`${backendBase}/coins`, { cache: 'no-store' });
            if (res.ok) {
              const data = await res.json();
              const mapped = (data.coins || []).map((c: any) => ({
                id: c.txHash || c.id,
                name: c.name,
                symbol: c.symbol,
                supply: c.supply,
                description: c.description,
                imageUrl: c.imageUrl || (c.imageHash ? `/api/image/${c.imageHash}` : ''),
                imageHash: c.imageHash, // Preserve imageHash for CoinImage component
                imageRootHash: c.imageHash, // Also set imageRootHash for compatibility
                createdAt: new Date(c.createdAt).toISOString(),
                creator: c.creator,
                txHash: c.txHash,
                tokenAddress: c.tokenAddress,
                curveAddress: c.curveAddress, // Add curve address
                telegramUrl: c.telegramUrl,
                xUrl: c.xUrl,
                discordUrl: c.discordUrl,
                websiteUrl: c.websiteUrl,
              })) as ExtendedCoinData[];
              
              console.log('🔍 Loaded coins with image data:', mapped.map(c => ({
                name: c.name,
                imageUrl: c.imageUrl,
                imageHash: (c as ExtendedCoinData).imageHash,
                imageRootHash: c.imageRootHash
              })));
              const sorted = [...mapped].sort((a,b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime())
              setAllCoins(sorted);
              setTrendingCoins(sorted);
            }
          } catch (e) {
            console.error('Failed to load coins from backend server:', e);
          }
        }
      } catch (error) {
        console.error('Error loading coins from storage:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (mounted) {
      loadStoredCoins();
    }
  }, [mounted]);

  // Toggle category selection
  const toggleCategory = (categoryName: string) => {
    setSelectedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(categoryName)) {
        // Don't allow deselecting all categories
        if (newSet.size > 1) {
          newSet.delete(categoryName)
        }
      } else {
        newSet.add(categoryName)
      }
      return newSet
    })
  }

  // Filter and sort coins based on search query, categories, and sort option
  useEffect(() => {
    let filtered = [...allCoins]

    // Apply category filters
    if (selectedCategories.size > 0) {
      const categoryFiltered = filtered.filter(coin => {
        const coinText = `${coin.name} ${coin.symbol} ${coin.description || ''}`.toLowerCase()
        return Array.from(selectedCategories).some(catName => {
          const category = categoryDefinitions.find(c => c.name === catName)
          if (!category) return false
          return category.keywords.some(keyword => coinText.includes(keyword.toLowerCase()))
        })
      })
      // If category filter returns results, use them; otherwise show all (user-friendly fallback)
      if (categoryFiltered.length > 0 || filtered.length === 0) {
        filtered = categoryFiltered
      }
      // If no matches but we have coins, show all (categories are just suggestions)
    }

    // Apply search query filter
    if (searchQuery.trim()) {
      filtered = filtered.filter(coin => 
        coin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        coin.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (coin.description?.toLowerCase() || '').includes(searchQuery.toLowerCase())
      )
    }

    // Apply sorting
    switch (sortOption) {
      case 'newest':
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
      case 'oldest':
        filtered.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        break
      case 'name':
        filtered.sort((a, b) => a.name.localeCompare(b.name))
        break
      case 'volume':
        // Sort by creation time as proxy for volume (newer = more activity)
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
      case 'featured':
      default:
        // Default: newest first
        filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        break
    }

    setTrendingCoins(filtered)
  }, [searchQuery, allCoins, selectedCategories, sortOption])

  // Note: Storage is primarily for storing data, not querying it
  // To display coins, we need additional infrastructure like:
  // 1. A separate database/index to track stored coins
  // 2. Storage events to monitor new uploads
  // 3. A backend service to maintain the index
  
  // For now, we'll start with an empty list and add coins as they're created
  useEffect(() => {
    // This would be replaced with actual storage event monitoring
    // or a separate indexing service in production
    console.log('Storage integration: Ready to store new coins');
  }, [])

  // Helper function to format time ago
  const formatTimeAgo = (timestamp: number) => {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  }

  // Handle coin card click - REMOVED - no card clicks wanted

  // Handle trading actions
  const handleTrade = async (coin: ExtendedCoinData, action: 'buy' | 'sell', amount: string) => {
    console.log(`Trade executed: ${action} ${amount} of ${coin.symbol}`)
    
    // TODO: In production, this would:
    // 1. Connect to DEX smart contract
    // 2. Execute the trade on blockchain
    // 3. Update user's portfolio
    // 4. Update token price and volume
    
    // For now, just show a success message
    alert(`${action.toUpperCase()} order for ${amount} ${coin.symbol} submitted successfully!`)
  }

  const handleCoinCreated = async (tokenData: any) => {
    try {
      const coin: ExtendedCoinData = {
        id: tokenData.txHash,
        name: tokenData.name,
        symbol: tokenData.symbol,
        supply: tokenData.supply,
        description: tokenData.description,
        imageUrl: tokenData.imageHash ? `/api/image/${tokenData.imageHash}` : '',
        imageHash: tokenData.imageHash, // Preserve imageHash for CoinImage component
        imageRootHash: tokenData.imageHash, // Also set imageRootHash for compatibility
        createdAt: new Date().toISOString(),
        creator: address || 'Unknown',
        // pass-through chain fields for explorer buttons
        txHash: tokenData.txHash,
        tokenAddress: tokenData.tokenAddress,
        curveAddress: tokenData.curveAddress, // Add curve address for trading
        telegramUrl: tokenData.telegramUrl,
        xUrl: tokenData.xUrl,
        discordUrl: tokenData.discordUrl,
        websiteUrl: tokenData.websiteUrl
      } as any
      await ogStorageSDK.saveCoinToLocal(coin)
      setAllCoins((prev) => [coin, ...prev])
      setTrendingCoins((prev) => [coin, ...prev])

      // Persist to backend server so the coin appears across browsers/devices
      try {
        const backendBase = (typeof process !== 'undefined' && (process as any).env && (process as any).env.NEXT_PUBLIC_BACKEND_URL) || 'http://localhost:4000'
        await fetch(`${backendBase}/createCoin`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: tokenData.name,
            symbol: tokenData.symbol,
            supply: tokenData.supply,
            imageHash: tokenData.imageHash || null,
            tokenAddress: tokenData.tokenAddress || null,
            curveAddress: tokenData.curveAddress || null, // Add curve address
            txHash: tokenData.txHash,
            creator: address || 'Unknown',
            description: tokenData.description,
            telegramUrl: tokenData.telegramUrl || null,
            xUrl: tokenData.xUrl || null,
            discordUrl: tokenData.discordUrl || null,
            websiteUrl: tokenData.websiteUrl || null,
          }),
        })
      } catch (e) {
        console.error('Failed to persist coin to backend server:', e)
      }
    } catch (e) {
      console.error('Failed to add coin locally:', e)
    }
  }

  return (
    <div className="min-h-screen text-white flex">
      {/* Animated background overlay */}
      <div className="fixed inset-0 -z-10" />
      
      {/* Left Sidebar */}
        <div className="w-64 funky-box border-r border-emerald-400/30 p-6 flex flex-col">
        {/* Logo */}
        <div className="flex items-center gap-3 mb-8">
          {logoFailed ? (
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-blue-500 rounded-2xl nb-border nb-shadow-sm" />
          ) : (
            // Provide your image at /og-logo.png or via NEXT_PUBLIC_LOGO_URL (e.g., /download/<rootHash>)
            <img
              src={(process.env.NEXT_PUBLIC_LOGO_URL as string) || '/og-logo.jpg'}
              alt="App logo"
              className="w-14 h-14 rounded-2xl nb-border nb-shadow-sm object-cover"
              onError={() => setLogoFailed(true)}
            />
          )}
          <span className="text-4xl funky-text funky-glow" style={{ fontFamily: 'fantasy' }}>POL Pump</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-3">
          <a href="#" className="funky-card flex items-center gap-3 px-4 py-3 mb-2 hover:scale-105">
            <Home className="w-5 h-5 text-emerald-300" />
            <span className="text-white font-semibold">Home</span>
          </a>

          <Link href="/livestreams" className="funky-card flex items-center gap-3 px-4 py-3 mb-2 hover:scale-105">
            <Video className="w-5 h-5 text-teal-300" />
            <span className="text-white font-semibold">Livestreams</span>
          </Link>
          <Link href="/ai-suggestions" className="funky-card flex items-center gap-3 px-4 py-3 mb-2 hover:scale-105">
            <Zap className="w-5 h-5 text-cyan-300" />
            <span className="text-white font-semibold">Advanced</span>
          </Link>
          <Link href="/ai-chat" className="funky-card flex items-center gap-3 px-4 py-3 mb-2 hover:scale-105">
            <MessageCircle className="w-5 h-5 text-emerald-300" />
            <span className="text-white font-semibold">Ask PumpAI</span>
          </Link>
          <Link href="/gaming" className="funky-card flex items-center gap-3 px-4 py-3 mb-2 hover:scale-105">
            <Zap className="w-5 h-5 text-teal-300" />
            <span className="text-white font-semibold">Gaming</span>
          </Link>
          <Link href="/profile" className="funky-card flex items-center gap-3 px-4 py-3 mb-2 hover:scale-105">
            <User className="w-5 h-5 text-cyan-300" />
            <span className="text-white font-semibold">Profile</span>
          </Link>
          <a href="#" className="funky-card flex items-center gap-3 px-4 py-3 mb-2 hover:scale-105">
            <HelpCircle className="w-5 h-5 text-emerald-300" />
            <span className="text-white font-semibold">Support</span>
          </a>
          <a href="#" className="funky-card flex items-center gap-3 px-4 py-3 mb-2 hover:scale-105">
            <MoreHorizontal className="w-5 h-5 text-teal-300" />
            <span className="text-white font-semibold">More</span>
          </a>
        </nav>

        {/* Wallet Status */}
        {mounted && isConnected && (
          <div className="mb-4 p-3 funky-card border-green-400/50 animate-pulse-glow">
            <div className="flex items-center gap-2 mb-2">
              <Wallet className="w-4 h-4 text-green-400" />
              <span className="text-sm font-bold text-green-300 funky-glow">Wallet Connected</span>
            </div>
            <div className="text-xs text-green-200 font-mono">
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </div>
          </div>
        )}

        {/* Create Coin Button */}
        <Button
          onClick={() => setIsTokenModalOpen(true)}
          disabled={mounted ? !isConnected : true}
          className="funky-button w-full text-white font-black rounded-2xl py-4 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Plus className="w-5 h-5" />
          {mounted && isConnected ? 'Create coin' : 'Connect wallet to create coin'}
        </Button>

        {/* Clear Data Button (for testing) */}
        {mounted && trendingCoins.length > 0 && (
          <Button
            onClick={async () => {
              localStorage.removeItem('pol_coins_data');
              setTrendingCoins([]);
              setAllCoins([]);
            }}
            variant="danger"
            className="w-full mt-3 text-sm py-2"
          >
            Clear Stored Data
          </Button>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Top Bar */}
        <div className="funky-box border-b border-emerald-400/30 p-6">
          <div className="flex items-center justify-between">
            {/* Alert Banner */}
            <div className="px-4 py-2 rounded-xl funky-card border-emerald-400/50 animate-pulse-glow">
              <span className="text-sm text-white font-bold funky-glow">(DEMO-ALERT)Live bought 1.4703 MATIC of DINO ~ 1 min(s): $25.7K</span>
            </div>

            {/* Search and Actions */}
            <div className="flex items-center gap-4">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-emerald-300" />
                <Input 
                  placeholder="Search coins by name, symbol, or description..." 
                  className="funky-input pl-12 w-64"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                {searchQuery && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-cyan-300 font-bold">
                    {trendingCoins.length} result{trendingCoins.length !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
              <Button onClick={() => setSearchQuery('')} className="funky-button">
                {searchQuery ? 'Clear Search' : 'Search'}
              </Button>
              {mounted && <ConnectButton />}
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-6 overflow-y-auto">
          {/* Status Banner */}
          {mounted && (
            <div className="mb-4 px-4 py-3 funky-card border-emerald-400/50">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full animate-pulse-glow"></div>
                  <span className="text-sm text-white font-bold funky-glow">
                    {searchQuery ? `Search results for "${searchQuery}"` : 'Real Trading Platform • Polygon Amoy Integration'}
                  </span>
                </div>
                <span className="text-xs px-2 py-1 rounded funky-card border-emerald-400/50 text-white font-bold">
                  {searchQuery ? `${trendingCoins.length} search result${trendingCoins.length !== 1 ? 's' : ''}` : `${allCoins.length} real tokens`}
                </span>
              </div>
            </div>
          )}

          {/* Polygon Network Info Banner */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 funky-box border-emerald-400/50 animate-float"
          >
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-500/30 to-teal-500/30 rounded-full flex items-center justify-center border-2 border-emerald-400/50">
                <svg className="w-5 h-5 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-emerald-300 funky-glow">Powered by Polygon Amoy</h3>
                <p className="text-xs text-cyan-200">
                  All coins are permanently stored on Polygon Amoy testnet. Fast, secure, and scalable trading platform! 🚀
                </p>
              </div>
            </div>
          </motion.div>

          {/* Portfolio Section - Removed fake data */}
          {mounted && isConnected && (
            <div className="mb-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-3xl funky-text funky-glow" style={{ fontFamily: 'fantasy' }}>
                  Your Trading Dashboard
                </h2>
                <Badge className="funky-card border-green-400/50 text-green-300 animate-pulse-glow">
                  Connected
                </Badge>
              </div>
              
              <div className="funky-box border-emerald-400/50 animate-float">
                <div className="text-center py-6">
                  <div className="w-16 h-16 bg-gradient-to-br from-emerald-500/30 to-teal-500/30 rounded-full flex items-center justify-center mx-auto mb-4 border-2 border-emerald-400/50 animate-pulse-glow">
                    <TrendingUp className="w-8 h-8 text-cyan-300" />
                  </div>
                  <h4 className="text-lg font-bold text-white mb-2 funky-glow">Ready to Trade!</h4>
                  <p className="text-cyan-200 mb-4">
                    Connect your wallet and start trading tokens. All data shown is real and user-generated.
                  </p>
                  <Button
                    onClick={() => setIsTokenModalOpen(true)}
                    className="funky-button"
                    size="lg"
                  >
                    Create Your First Token
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Trading Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-3xl font-bold funky-text funky-glow">
                {searchQuery ? `Search Results for "${searchQuery}"` : 'Trade Tokens'}
              </h2>
              <div className="flex items-center gap-2">
                <Button
                  onClick={async () => {
                    setIsLoading(true);
                    try {
                      const backendBase = (typeof process !== 'undefined' && (process as any).env && (process as any).env.NEXT_PUBLIC_BACKEND_URL) || 'http://localhost:4000'
                      const res = await fetch(`${backendBase}/coins`, { cache: 'no-store' });
                      if (res.ok) {
                        const data = await res.json();
                        const mapped = (data.coins || []).map((c: any) => ({
                          id: c.txHash || c.id,
                          name: c.name,
                          symbol: c.symbol,
                          supply: c.supply,
                          description: c.description,
                          imageUrl: c.imageUrl || (c.imageHash ? `/api/image/${c.imageHash}` : ''),
                          createdAt: new Date(c.createdAt).toISOString(),
                          creator: c.creator,
                          txHash: c.txHash,
                          tokenAddress: c.tokenAddress,
                          telegramUrl: c.telegramUrl,
                          xUrl: c.xUrl,
                          discordUrl: c.discordUrl,
                          websiteUrl: c.websiteUrl,
                        })) as ExtendedCoinData[];
                        const sorted = [...mapped].sort((a,b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime())
                        setAllCoins(sorted); // Update allCoins with refreshed data
                        setTrendingCoins(sorted); // Show ALL refreshed coins
                      }
                    } catch (e) {
                      console.error('Manual refresh failed:', e)
                    }
                    setIsLoading(false);
                  }}
                  className="funky-button px-4 py-2"
                >
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Refresh
                </Button>
                <Button
                  className="funky-button w-10 h-10 p-0"
                >
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <Button
                  className="funky-button w-10 h-10 p-0"
                >
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Categories */}
            <div className="flex gap-3 mb-8 flex-wrap">
              {categoryDefinitions.map((category, index) => {
                const isActive = selectedCategories.has(category.name)
                return (
                  <Button
                    key={index}
                    onClick={() => toggleCategory(category.name)}
                    className={`funky-button text-sm px-4 py-2 ${isActive ? 'border-cyan-400' : 'border-emerald-400/30'} ${isActive ? 'animate-pulse-glow' : ''}`}
                  >
                    {category.name}
                  </Button>
                )
              })}
              <div className="relative">
                <Button
                  onClick={() => {
                    const options: SortOption[] = ['featured', 'newest', 'oldest', 'name', 'volume']
                    const currentIndex = options.indexOf(sortOption)
                    const nextIndex = (currentIndex + 1) % options.length
                    setSortOption(options[nextIndex])
                  }}
                  className="funky-button text-sm px-4 py-2 flex items-center gap-2"
                >
                  <Filter className="w-4 h-4" />
                  sort: {sortOption}
                </Button>
              </div>
            </div>

            {/* Coin Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isLoading ? (
                // Loading skeleton - show more items since we're displaying all tokens
                Array.from({ length: Math.min(12, allCoins.length || 12) }).map((_, index) => (
                  <div key={index} className="funky-card animate-pulse">
                    <div className="flex items-start gap-4 mb-4">
                      <div className="w-14 h-14 rounded-2xl bg-purple-900/40"></div>
                      <div className="flex-1">
                        <div className="h-6 bg-purple-900/40 rounded mb-2"></div>
                        <div className="h-4 bg-purple-900/40 rounded mb-3 w-20"></div>
                        <div className="h-4 bg-purple-900/40 rounded mb-4"></div>
                        <div className="h-3 bg-purple-900/40 rounded w-32"></div>
                      </div>
                    </div>
                  </div>
                ))
              ) : trendingCoins.length === 0 ? (
                // No results message
                <div className="col-span-full text-center py-12">
                  <div className="funky-box border-emerald-400/50">
                    <Search className="w-16 h-16 text-emerald-300 mx-auto mb-4 animate-float" />
                    <h3 className="text-xl font-bold text-white mb-2 funky-glow">
                      {searchQuery ? 'No coins found' : 'No tokens created yet'}
                    </h3>
                    <p className="text-cyan-200 mb-4">
                      {searchQuery 
                        ? `No coins match your search for "${searchQuery}". Try different keywords.`
                        : 'Be the first to create a token! Connect your wallet and click "Create coin" to get started.'
                      }
                    </p>
                    {searchQuery && (
                      <Button 
                        onClick={() => setSearchQuery('')}
                        className="funky-button"
                      >
                        Clear Search
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                trendingCoins.map((coin, index) => (
                  <motion.div
                    key={coin.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    whileHover={{ scale: 1.05, y: -8 }}
                    className="funky-card"
                  >
                    <EnhancedTradingCard 
                      tokenAddress={coin.tokenAddress || ''}
                      tokenName={coin.name}
                      tokenSymbol={coin.symbol}
                      description={coin.description || ''}
                      imageUrl={coin.imageUrl}
                      metadataUrl={coin.imageUrl}
                      creator={coin.creator}
                      createdAt={coin.createdAt}
                      curveAddress={coin.curveAddress || undefined}
                    />
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* Trading History Section removed as requested */}
        </div>
      </div>

      {/* Token Creator Modal */}
      <TokenCreatorModal
        isOpen={isTokenModalOpen}
        onClose={() => setIsTokenModalOpen(false)}
        onTokenCreated={handleCoinCreated}
      />

      {/* Coin Detail Modal removed - no card clicks */}
    </div>
  )
}
