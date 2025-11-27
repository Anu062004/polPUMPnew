'use client'

import React, { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import PremiumNavbar from '../components/PremiumNavbar'
import BlobBackground from '../components/BlobBackground'
import Link from 'next/link'
import { ArrowLeft, Video, ExternalLink } from 'lucide-react'

export default function LivestreamsPage() {
  const router = useRouter()
  const [liveTokens, setLiveTokens] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // This page can show a list of live tokens in the future
    // For now, redirect users to explore tokens
    setIsLoading(false)
  }, [])

  if (isLoading) {
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

  return (
    <div className="min-h-screen relative overflow-hidden">
      <BlobBackground />
      <PremiumNavbar />
      <div className="relative z-10 max-w-6xl mx-auto px-4 pt-24 pb-8 space-y-4">
        <header className="mb-6">
          <div className="flex items-center gap-4 mb-4">
            <Link href="/explore" className="btn-secondary inline-flex items-center">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Explore
            </Link>
          </div>
          <h1 className="text-2xl md:text-3xl font-semibold text-white">
            Livestreams
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Watch live streams from token creators. Each token has its own dedicated livestream.
          </p>
        </header>

        <div className="glass-card p-8 text-center">
          <Video className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">
            Token-Based Livestreams
          </h2>
          <p className="text-gray-400 mb-6">
            Livestreams are now integrated into each token's detail page. 
            Visit any token page to watch live streams from creators.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/explore" className="btn-primary inline-flex items-center justify-center">
              Explore Tokens
            </Link>
            <Link href="/" className="btn-secondary inline-flex items-center justify-center">
              Go Home
            </Link>
          </div>
        </div>

        {liveTokens.length > 0 && (
          <div className="mt-8">
            <h2 className="text-xl font-semibold text-white mb-4">Live Now</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveTokens.map((token) => (
                <Link
                  key={token.tokenAddress}
                  href={`/token/${token.tokenAddress}`}
                  className="glass-card p-4 hover:bg-white/5 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="h-3 w-3 rounded-full bg-red-500 animate-pulse"></span>
                    <div className="flex-1">
                      <h3 className="font-semibold text-white">{token.name}</h3>
                      <p className="text-sm text-gray-400">{token.symbol}</p>
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}


