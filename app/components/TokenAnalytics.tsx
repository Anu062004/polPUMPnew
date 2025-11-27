'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, TrendingDown, Users, Activity, DollarSign, Info } from 'lucide-react'
import { InfoTooltip } from '@/components/InfoTooltip'
import { Skeleton } from '@/components/ui/skeleton'

interface TokenAnalyticsProps {
  tokenAddress: string
  curveAddress?: string
}

interface AnalyticsData {
  price: string
  priceChange24h: number
  volume24h: string
  trades24h: number
  holders: number
  marketCap: string
  raised: string
  graduationCap: string
  progress: number
}

export default function TokenAnalytics({ tokenAddress, curveAddress }: TokenAnalyticsProps) {
  const [timeframe, setTimeframe] = useState<'24h' | '7d' | 'all'>('24h')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadAnalytics()
  }, [tokenAddress, timeframe])

  const loadAnalytics = async () => {
    setLoading(true)
    try {
      // Simulate API call - replace with actual backend call
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      setData({
        price: '0.00042',
        priceChange24h: 15.3,
        volume24h: '1,234.56',
        trades24h: 89,
        holders: 156,
        marketCap: '42,000',
        raised: '2.5',
        graduationCap: '10',
        progress: 25
      })
    } catch (error) {
      console.error('Failed to load analytics:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="glass-card space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="glass-card p-8 text-center">
        <Activity className="w-12 h-12 text-white/40 mx-auto mb-3" />
        <p className="text-white/60">No analytics data available</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Timeframe Filters */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h3 className="text-xl font-bold text-white">Analytics</h3>
        <div className="flex gap-2">
          {(['24h', '7d', 'all'] as const).map((tf) => (
            <button
              key={tf}
              onClick={() => setTimeframe(tf)}
              className={`filter-pill ${timeframe === tf ? 'active' : ''}`}
            >
              {tf === '24h' ? '24 Hours' : tf === '7d' ? '7 Days' : 'All Time'}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Price */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/60">Price</span>
            <InfoTooltip content="Current token price in MATIC" />
          </div>
          <div className="text-2xl font-bold text-white">{data.price} MATIC</div>
          <div className={`flex items-center gap-1 text-sm mt-1 ${
            data.priceChange24h >= 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {data.priceChange24h >= 0 ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            <span>{Math.abs(data.priceChange24h)}%</span>
          </div>
        </motion.div>

        {/* Volume */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/60">Volume (24h)</span>
            <InfoTooltip content="Total trading volume in the last 24 hours" />
          </div>
          <div className="text-2xl font-bold text-white">{data.volume24h} MATIC</div>
          <div className="text-sm text-white/60 mt-1">{data.trades24h} trades</div>
        </motion.div>

        {/* Holders */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/60">Holders</span>
            <InfoTooltip content="Number of unique wallet addresses holding this token" />
          </div>
          <div className="text-2xl font-bold text-white">{data.holders}</div>
          <div className="text-sm text-white/60 mt-1">Unique wallets</div>
        </motion.div>

        {/* Market Cap */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-4"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-white/60">Market Cap</span>
            <InfoTooltip content="Total value of all tokens in circulation" />
          </div>
          <div className="text-2xl font-bold text-white">{data.marketCap} MATIC</div>
          <div className="text-sm text-white/60 mt-1">Fully diluted</div>
        </motion.div>
      </div>

      {/* Bonding Curve Progress */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-card p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-bold text-white">Bonding Curve Progress</h4>
          <InfoTooltip content="Progress towards graduation cap. When reached, liquidity will be migrated to a DEX." />
        </div>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-white/60">Raised</span>
            <span className="text-white font-semibold">{data.raised} / {data.graduationCap} MATIC</span>
          </div>
          
          <div className="relative h-4 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${data.progress}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-[#FF4F84] to-[#12D9C8] rounded-full"
            />
          </div>
          
          <div className="flex items-center justify-between text-xs text-white/60">
            <span>0%</span>
            <span className="text-white font-semibold">{data.progress}%</span>
            <span>100%</span>
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-500/20 border border-blue-500/30 rounded-lg">
          <div className="text-sm text-blue-300">
            <strong>What happens at graduation?</strong>
            <p className="text-xs mt-1 text-blue-200/80">
              When the bonding curve reaches its cap, liquidity will be automatically migrated to a decentralized exchange for enhanced trading.
            </p>
          </div>
        </div>
      </motion.div>

      {/* Learn More */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glass-card p-4"
      >
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-[#12D9C8] flex-shrink-0 mt-0.5" />
          <div className="text-sm text-white/80">
            <strong className="text-white">How Bonding Curves Work</strong>
            <p className="mt-1 text-white/60">
              Bonding curves use a mathematical formula (x * y = k) to automatically adjust token prices based on supply and demand. As more people buy, the price increases. As people sell, the price decreases.
            </p>
            <a
              href="#"
              className="text-[#12D9C8] hover:text-[#12D9C8]/80 mt-2 inline-block"
            >
              Learn more →
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
