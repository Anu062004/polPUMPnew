/**
 * Creator Dashboard
 * Role-protected page for CREATOR users
 * Features:
 * - Start live stream
 * - Promote own token
 * - Creator-only chat rooms
 * - Post trade signals
 * - View analytics (viewers, engagement, volume impact)
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
  Video, 
  TrendingUp, 
  MessageSquare, 
  BarChart3, 
  Send,
  Users,
  ArrowRight,
  Crown,
  AlertCircle
} from 'lucide-react'

export default function CreatorDashboard() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading, login } = useAuth()
  const { isConnected, address } = useAccount()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Redirect if not authenticated or not CREATOR
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

      if (user?.role !== 'CREATOR') {
        // Redirect to trader dashboard if user is TRADER
        if (user?.role === 'TRADER') {
          router.push('/trader')
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
                and lead communities. Your role is automatically maintained based on your token balance.
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
          <div className="glass-card p-6">
            <MessageSquare className="w-10 h-10 text-[#FF4F84] mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Creator Chat</h3>
            <p className="text-gray-400 mb-4">
              Access creator-only chat rooms. Connect with other creators.
            </p>
            <div className="text-sm text-gray-500">Coming Soon</div>
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
              See who's following you and track your community growth.
            </p>
            <div className="text-sm text-gray-500">Coming Soon</div>
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
            <div className="text-3xl font-bold text-white mb-2">0</div>
            <div className="text-gray-400">Followers</div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="glass-card p-6">
          <h2 className="text-2xl font-bold text-white mb-4">Recent Activity</h2>
          <div className="text-center py-8 text-gray-400">
            <p>No recent activity yet.</p>
            <p className="text-sm mt-2">Start streaming or promoting your tokens!</p>
          </div>
        </div>
      </div>
    </div>
  )
}






