/**
 * Trader Dashboard
 * Role-protected page for TRADER users
 * Features:
 * - Market overview
 * - Watch live streams
 * - Community chat
 * - Follow creators
 * - Copy trading signals (manual)
 * - Read-only access to promotions
 */

'use client'

import React, { useEffect, useState } from 'react'
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
  AlertCircle
} from 'lucide-react'

export default function TraderDashboard() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading, login } = useAuth()
  const { isConnected, address } = useAccount()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Redirect if not authenticated or not TRADER
  useEffect(() => {
    if (!isLoading && mounted) {
      if (!isConnected) {
        router.push('/')
        return
      }
      
      if (!isAuthenticated) {
        // Try to login automatically
        login().catch(() => {
          router.push('/')
        })
        return
      }

      if (user?.role !== 'TRADER') {
        // Redirect to creator dashboard if user is CREATOR
        if (user?.role === 'CREATOR') {
          router.push('/creator')
        } else {
          router.push('/')
        }
      }
    }
  }, [isLoading, mounted, isAuthenticated, user, isConnected, router, login])

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
                Upgrade to CREATOR by holding the required token amount to start your own streams and promotions.
              </p>
            </div>
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
              Join global and token-specific chat rooms. Connect with other traders.
            </p>
            <div className="text-sm text-gray-500">Coming Soon</div>
          </div>

          {/* Follow Creators */}
          <div className="glass-card p-6">
            <Users className="w-10 h-10 text-[#12D9C8] mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Follow Creators</h3>
            <p className="text-gray-400 mb-4">
              Follow your favorite creators to get notified about their signals and streams.
            </p>
            <div className="text-sm text-gray-500">Coming Soon</div>
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

        {/* Recent Activity */}
        <div className="glass-card p-6">
          <h2 className="text-2xl font-bold text-white mb-4">Recent Activity</h2>
          <div className="text-center py-8 text-gray-400">
            <p>No recent activity yet.</p>
            <p className="text-sm mt-2">Start exploring tokens and watching streams!</p>
          </div>
        </div>
      </div>
    </div>
  )
}






