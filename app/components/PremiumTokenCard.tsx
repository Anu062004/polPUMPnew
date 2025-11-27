'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { TrendingUp, Users, Clock } from 'lucide-react'
import CoinImage from './CoinImage'
import Link from 'next/link'

interface PremiumTokenCardProps {
  token: {
    id?: string
    name: string
    symbol: string
    description?: string
    imageHash?: string
    imageRootHash?: string
    tokenAddress?: string
    creator?: string
    createdAt?: string
    volume_24h?: string
    trades_count?: number
    unique_traders?: number
  }
  index?: number
}

export default function PremiumTokenCard({ token, index = 0 }: PremiumTokenCardProps) {
  const formatVolume = (volume: string | undefined) => {
    if (!volume) return '0'
    const num = parseFloat(volume)
    if (num >= 1000000) return `${(num / 1000000).toFixed(2)}M`
    if (num >= 1000) return `${(num / 1000).toFixed(2)}K`
    return num.toFixed(2)
  }

  const shortenAddress = (addr: string | undefined) => {
    if (!addr) return 'N/A'
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5 }}
      whileHover={{ y: -8, scale: 1.02 }}
      className="glass-card group cursor-pointer relative z-10"
    >
      <Link 
        href={token.tokenAddress ? `/token/${token.tokenAddress}` : '#'}
        className="block w-full h-full"
      >
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start gap-4">
            <div className="relative">
              <CoinImage
                imageHash={token.imageHash || token.imageRootHash}
                tokenName={token.name}
                className="w-16 h-16 rounded-full"
              />
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-[#FF4F84]/20 to-[#8C52FF]/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-xl font-bold text-white truncate mb-1">
                {token.name}
              </h3>
              <p className="text-sm text-[#E3E4E8] font-medium">{token.symbol}</p>
            </div>
            {parseFloat(token.volume_24h || '0') > 0 && (
              <div className="px-3 py-1 rounded-full bg-gradient-to-r from-[#FF4F84]/20 to-[#8C52FF]/20 border border-[#FF4F84]/30">
                <TrendingUp className="w-4 h-4 text-[#FF4F84]" />
              </div>
            )}
          </div>

          {/* Description */}
          {token.description && (
            <p className="text-sm text-[#E3E4E8]/70 line-clamp-2">
              {token.description}
            </p>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 pt-2 border-t border-white/10">
            <div>
              <p className="text-xs text-[#E3E4E8]/60 mb-1">24h Volume</p>
              <p className="text-sm font-semibold text-[#12D9C8]">
                {formatVolume(token.volume_24h)} MATIC
              </p>
            </div>
            <div>
              <p className="text-xs text-[#E3E4E8]/60 mb-1">Trades</p>
              <p className="text-sm font-semibold text-white">
                {token.trades_count || 0}
              </p>
            </div>
            <div>
              <p className="text-xs text-[#E3E4E8]/60 mb-1">Traders</p>
              <p className="text-sm font-semibold text-white">
                {token.unique_traders || 0}
              </p>
            </div>
          </div>

          {/* Creator */}
          {token.creator && (
            <div className="flex items-center gap-2 text-xs text-[#E3E4E8]/60">
              <Users className="w-3 h-3" />
              <span className="font-mono">{shortenAddress(token.creator)}</span>
            </div>
          )}
        </div>
      </Link>
    </motion.div>
  )
}

