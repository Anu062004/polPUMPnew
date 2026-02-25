'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import PremiumNavbar from './components/PremiumNavbar'
import PremiumTokenCard from './components/PremiumTokenCard'
import TokenCreatorModal from './components/TokenCreatorModal'
import { useAccount } from 'wagmi'
import { CoinData, ogStorageSDK } from '../lib/0gStorageSDK'
import { useAuth } from './providers/AuthContext'

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

/* ─────────────────────────────────────────────
   Inline styles that can't live in globals.css
   (component-scoped, no conflict risk)
   ───────────────────────────────────────────── */
const GLASS_STYLE = {
  background: 'rgba(255,255,255,0.03)',
  border: '1px solid rgba(255,255,255,0.05)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
} as const

const MODAL_STYLE = {
  background: 'linear-gradient(180deg,rgba(30,27,75,.55) 0%,rgba(15,23,42,.92) 100%)',
  border: '1px solid rgba(168,85,247,.28)',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  boxShadow: '0 24px 40px -12px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.1)',
} as const

export default function HomePage() {
  const { isConnected, address } = useAccount()
  const { accessToken, user } = useAuth()
  const [isTokenModalOpen, setIsTokenModalOpen] = useState(false)
  const [trendingCoins, setTrendingCoins] = useState<ExtendedCoinData[]>([])
  const [mounted, setMounted] = useState(false)

  // Creator flow state
  const [view, setView] = useState<'landing' | 'dashboard'>('landing')
  const [isCreator, setIsCreator] = useState(false)
  const [creatorHandle, setCreatorHandle] = useState('')
  const [showCreatorModal, setShowCreatorModal] = useState(false)
  const [showSuccessModal, setShowSuccessModal] = useState(false)
  const [handleInput, setHandleInput] = useState('')
  const [categoryInput, setCategoryInput] = useState('meme')
  const [termsChecked, setTermsChecked] = useState(false)
  const [roleLockMessage, setRoleLockMessage] = useState<string | null>(null)

  const isTraderRoleLocked = user?.role === 'TRADER'
  const isCreatorRoleLocked = user?.role === 'CREATOR'
  const creatorModeActive = isCreator || isCreatorRoleLocked

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!isTraderRoleLocked) {
      setRoleLockMessage(null)
    }
  }, [isTraderRoleLocked])

  /* ── helpers ── */
  const deduplicateCoins = (coins: ExtendedCoinData[]): ExtendedCoinData[] => {
    const seen = new Set<string>()
    return coins.filter(coin => {
      const key = coin.tokenAddress?.toLowerCase() || coin.id?.toLowerCase() || `${coin.symbol}-${coin.name}` || ''
      if (key && !seen.has(key)) { seen.add(key); return true }
      return false
    })
  }

  const loadStoredCoins = async () => {
    try {
      const backendBase = (typeof process !== 'undefined' && (process as any).env?.NEXT_PUBLIC_BACKEND_URL) || 'http://localhost:4000'
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 3000)
        const res = await fetch(`${backendBase}/api/coins`, { cache: 'no-store', signal: controller.signal }).catch(() => null)
        clearTimeout(timeoutId)
        if (res?.ok) {
          const data = await res.json()
          const mapped = (data.coins || []).map((c: any) => ({
            id: c.id || c.txHash, name: c.name, symbol: c.symbol, supply: c.supply,
            description: c.description, imageUrl: c.imageHash ? `/api/image/${c.imageHash}` : '',
            imageHash: c.imageHash, imageRootHash: c.imageHash, createdAt: new Date(c.createdAt).toISOString(),
            creator: c.creator, txHash: c.txHash, tokenAddress: c.tokenAddress, curveAddress: c.curveAddress,
            volume_24h: c.volume_24h || '0', trades_count: c.trades_count || 0, unique_traders: c.unique_traders || 0,
          })) as ExtendedCoinData[]
          const sorted = deduplicateCoins(mapped).sort((a, b) => new Date(b.createdAt as any).getTime() - new Date(a.createdAt as any).getTime())
          setTrendingCoins(sorted.slice(0, 6))
          return
        }
      } catch { /* fall through to local storage */ }
      const storedCoins = await ogStorageSDK.getAllCoins()
      if (storedCoins.length > 0) {
        const sorted = deduplicateCoins(storedCoins as ExtendedCoinData[]).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        setTrendingCoins(sorted.slice(0, 6))
      }
    } catch (error) { console.error('❌ Error loading coins:', error) }
  }

  useEffect(() => { if (mounted) loadStoredCoins() }, [mounted])

  const handleCoinCreated = async (tokenData: any) => {
    try {
      if (!tokenData.tokenAddress || !tokenData.curveAddress) { alert('Error: Token addresses missing.'); return }
      if (user?.role !== 'CREATOR' || !accessToken) { alert('Only CREATOR role wallets can create tokens.'); return }
      const backendBase = (typeof process !== 'undefined' && (process as any).env?.NEXT_PUBLIC_BACKEND_URL) || 'http://localhost:4000'
      const body = JSON.stringify({ name: tokenData.name, symbol: tokenData.symbol, supply: tokenData.supply, description: tokenData.description, imageHash: tokenData.imageHash, tokenAddress: tokenData.tokenAddress, curveAddress: tokenData.curveAddress, txHash: tokenData.txHash, creator: address || 'Unknown', telegramUrl: tokenData.telegramUrl, xUrl: tokenData.xUrl, discordUrl: tokenData.discordUrl, websiteUrl: tokenData.websiteUrl })
      let saveSuccess = false
      const writeHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
      if (accessToken) writeHeaders.Authorization = `Bearer ${accessToken}`
      const res = await fetch(`${backendBase}/api/coins`, { method: 'POST', headers: writeHeaders, body }).catch(() => null)
      if (res?.ok) { const r = await res.json(); saveSuccess = r.success }
      if (!saveSuccess) {
        const localRes = await fetch('/api/coins', { method: 'POST', headers: writeHeaders, body })
        if (localRes.ok) { const r = await localRes.json(); saveSuccess = r.success }
      }
      if (!saveSuccess) { alert('Failed to save token to database.'); return }
      const coin: ExtendedCoinData = {
        id: tokenData.txHash || `coin-${Date.now()}`, name: tokenData.name, symbol: tokenData.symbol,
        supply: tokenData.supply, description: tokenData.description,
        imageUrl: tokenData.imageHash ? `/api/image/${tokenData.imageHash}` : '',
        imageHash: tokenData.imageHash, imageRootHash: tokenData.imageHash,
        createdAt: new Date().toISOString(), creator: address || 'Unknown',
        txHash: tokenData.txHash, tokenAddress: tokenData.tokenAddress, curveAddress: tokenData.curveAddress,
      } as any
      await ogStorageSDK.saveCoinToLocal(coin)
      setTrendingCoins(prev => deduplicateCoins([coin, ...prev]).slice(0, 6))
      setTimeout(loadStoredCoins, 1000)
    } catch (e) { console.error('Failed to handle coin creation:', e) }
  }

  const handleCreatorSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!handleInput || !termsChecked) return
    setCreatorHandle(handleInput)
    setIsCreator(true)
    setShowCreatorModal(false)
    setTimeout(() => setShowSuccessModal(true), 300)
  }

  const handleMainCta = () => {
    if (!mounted || !isConnected) { alert('Please connect your wallet first!'); return }

    if (isTraderRoleLocked) {
      setShowCreatorModal(false)
      setIsTokenModalOpen(false)
      setRoleLockMessage('This wallet role is locked as TRADER. You cannot create tokens with this wallet.')
      return
    }

    if (isCreatorRoleLocked) {
      setRoleLockMessage(null)
      setShowCreatorModal(false)
      setIsTokenModalOpen(true)
      return
    }

    if (isCreator) { setView('dashboard'); return }
    setShowCreatorModal(true)
  }

  /* ── Rocket SVG — uses global pp-flicker / pp-flicker-slow classes ── */
  const RocketSVG = () => (
    <svg
      width="280" height="420" viewBox="0 0 200 300"
      fill="none" xmlns="http://www.w3.org/2000/svg"
      className="w-44 h-auto md:w-60 lg:w-[280px]"
    >
      <defs>
        <linearGradient id="bodyGrad" x1="100" y1="20" x2="100" y2="200" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="80%" stopColor="#cbd5e1" />
          <stop offset="100%" stopColor="#94a3b8" />
        </linearGradient>
        <linearGradient id="finGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
        <linearGradient id="glassGrad" x1="100" y1="80" x2="100" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#0f172a" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>
        <linearGradient id="flameOuter" x1="100" y1="220" x2="100" y2="295" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ef4444" />
          <stop offset="45%" stopColor="#f97316" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
        <linearGradient id="flameInner" x1="100" y1="222" x2="100" y2="275" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#fcd34d" />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
        <filter id="glowFX" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      {/* Outer flame — uses global pp-flicker keyframe via className */}
      <g className="pp-flicker" style={{ transformOrigin: '100px 225px' }}>
        <path d="M68 220 Q100 302 132 220 Q100 242 68 220 Z" fill="url(#flameOuter)" filter="url(#glowFX)" />
      </g>
      {/* Inner flame — uses global pp-flicker-slow keyframe */}
      <g className="pp-flicker-slow" style={{ transformOrigin: '100px 225px' }}>
        <path d="M84 220 Q100 278 116 220 Q100 232 84 220 Z" fill="url(#flameInner)" />
      </g>

      {/* Exhaust nozzle */}
      <path d="M76 200 L124 200 L114 220 L86 220 Z" fill="#334155" />
      <path d="M86 220 L114 220 L108 230 L92 230 Z" fill="#1e293b" />

      {/* Fins */}
      <path d="M62 138 L18 180 L28 212 L64 190 Z" fill="url(#finGrad)" />
      <path d="M138 138 L182 180 L172 212 L136 190 Z" fill="url(#finGrad)" />

      {/* Body */}
      <path d="M100 18 C100 18 58 80 58 150 L58 200 C58 212 142 212 142 200 L142 150 C142 80 100 18 100 18 Z" fill="url(#bodyGrad)" />
      {/* Body shine */}
      <path d="M100 18 C100 18 60 80 60 150 L60 200 C60 206 100 212 100 206 L100 18 Z" fill="#ffffff" opacity="0.18" />

      {/* Porthole ring */}
      <circle cx="100" cy="102" r="24" fill="#64748b" />
      <circle cx="100" cy="102" r="20" fill="url(#glassGrad)" />
      {/* Porthole shine */}
      <path d="M86 92 Q100 78 114 92 Q100 102 86 92 Z" fill="#38bdf8" opacity="0.4" />
      <circle cx="93" cy="94" r="3" fill="#ffffff" opacity="0.75" />
    </svg>
  )

  /* ═══════════════ DASHBOARD VIEW ═══════════════ */
  if (view === 'dashboard') {
    return (
      <div className="min-h-screen text-white" style={{ background: '#0B1220' }}>
        <PremiumNavbar />

        {/* Bg blobs */}
        <div className="fixed inset-0 z-0 pointer-events-none">
          <div className="absolute inset-0 opacity-30" style={{ backgroundSize: '40px 40px', backgroundImage: 'linear-gradient(to right,rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,.02) 1px,transparent 1px)' }} />
          <div className="absolute top-0 right-0 w-[600px] h-[600px] rounded-full blur-[120px]" style={{ background: 'rgba(99,102,241,.08)' }} />
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] rounded-full blur-[100px]" style={{ background: 'rgba(34,211,238,.06)' }} />
        </div>

        <div className="relative z-10 pt-[104px] pb-12 px-4 md:px-6 max-w-7xl mx-auto flex flex-col md:flex-row gap-6 min-h-screen">

          {/* Sidebar */}
          <aside className="w-full md:w-64 shrink-0 rounded-3xl p-4 flex flex-col gap-2" style={GLASS_STYLE}>
            <div className="px-3 mb-3 mt-2 hidden md:block">
              <h3 className="text-xs font-medium text-slate-500 uppercase tracking-widest">Creator Menu</h3>
            </div>
            <nav className="flex md:flex-col gap-1 overflow-x-auto md:overflow-visible">
              {[
                { label: 'Overview', active: true },
                { label: 'My Tokens', badge: trendingCoins.length.toString() },
                { label: 'Launch Token' },
                { label: 'Liquidity' },
                { label: 'Analytics' },
                { label: 'Earnings' },
              ].map(item => (
                <button
                  key={item.label}
                  onClick={() => item.label === 'Launch Token' ? setIsTokenModalOpen(true) : undefined}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium shrink-0 transition-colors w-full text-left ${item.active ? 'bg-purple-500/10 text-purple-300 border border-purple-500/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                >
                  <span>{item.label}</span>
                  {item.badge && item.badge !== '0' && (
                    <span className="ml-auto bg-white/10 text-xs px-1.5 py-0.5 rounded text-slate-300">{item.badge}</span>
                  )}
                </button>
              ))}
            </nav>
            <div className="mt-auto pt-6 hidden md:block">
              <button className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors text-sm font-medium w-full">
                Settings
              </button>
            </div>
          </aside>

          {/* Main content */}
          <div className="flex-grow flex flex-col gap-6">

            {/* Header card */}
            <div className="rounded-3xl p-6 md:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 relative overflow-hidden" style={GLASS_STYLE}>
              <div className="absolute top-0 right-0 w-64 h-64 rounded-full blur-[80px] pointer-events-none -translate-y-1/2 translate-x-1/2" style={{ background: 'rgba(168,85,247,.1)' }} />
              <div className="relative z-10 flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl p-[1px]" style={{ background: 'linear-gradient(135deg,#a855f7,#6366f1)' }}>
                  <div className="w-full h-full bg-slate-900 rounded-2xl flex items-center justify-center">
                    <span className="text-lg font-bold text-white">{creatorHandle.charAt(0).toUpperCase() || 'C'}</span>
                  </div>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">Welcome, {creatorHandle || 'Creator'}</h2>
                  <p className="text-sm text-purple-300 font-mono mt-1">polpump.com/creator/{creatorHandle || 'handle'}</p>
                </div>
              </div>
              <button
                onClick={() => setIsTokenModalOpen(true)}
                className="relative z-10 w-full sm:w-auto text-white text-sm font-semibold px-6 py-3 rounded-full flex items-center justify-center gap-2 transition-all hover:-translate-y-[1px]"
                style={{ background: 'linear-gradient(135deg,#a855f7,#6366f1)', boxShadow: '0 0 20px rgba(168,85,247,.3)' }}
              >
                🚀 Launch New Token
              </button>
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {[
                { label: 'Total Volume', value: '$42,850', change: '+12.5%', dot: '#3b82f6' },
                { label: 'Total Holders', value: '1,204', dot: '#a855f7' },
                { label: 'Fees Earned', value: '$845', change: '+5.2%', dot: '#10b981' },
                { label: 'Market Cap', value: '$124.5k', dot: '#22d3ee' },
              ].map(stat => (
                <div key={stat.label} className="rounded-3xl p-5 hover:bg-white/[0.04] transition-colors relative overflow-hidden" style={GLASS_STYLE}>
                  <div className="flex justify-between items-start mb-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${stat.dot}18` }}>
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: stat.dot }} />
                    </div>
                    {stat.change && (
                      <span className="text-xs font-medium text-emerald-400 bg-emerald-400/10 px-2 py-1 rounded-md">{stat.change}</span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400 font-medium mb-1">{stat.label}</p>
                  <h3 className="text-2xl font-bold text-white tracking-tight">{stat.value}</h3>
                  <div className="absolute bottom-0 inset-x-0 h-[2px]" style={{ background: `linear-gradient(to right,${stat.dot}60,transparent)` }} />
                </div>
              ))}
            </div>

            {/* Token activity */}
            <div className="rounded-3xl p-6 md:p-8 flex-grow" style={GLASS_STYLE}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">Recent Tokens</h3>
                <button className="text-xs text-purple-400 hover:text-purple-300 font-medium transition-colors">View All</button>
              </div>
              {trendingCoins.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {trendingCoins.map((coin, i) => (
                    <PremiumTokenCard key={coin.id || i} token={coin} index={i} />
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-48 border border-dashed border-white/10 rounded-2xl">
                  <span className="text-4xl mb-3">👻</span>
                  <p className="text-sm text-slate-400 font-medium">No tokens yet.</p>
                  <p className="text-xs text-slate-500 mt-1">Launch your first token to see it here.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        <button
          onClick={() => setView('landing')}
          className="fixed bottom-6 left-6 z-50 px-4 py-2 rounded-full text-sm text-slate-400 hover:text-white transition-all"
          style={GLASS_STYLE}
        >
          ← Back to Home
        </button>

        <TokenCreatorModal
          isOpen={isTokenModalOpen}
          onClose={() => setIsTokenModalOpen(false)}
          onTokenCreated={handleCoinCreated}
        />
      </div>
    )
  }

  /* ═══════════════ LANDING VIEW ═══════════════ */
  return (
    <div
      className="min-h-screen text-white flex flex-col relative overflow-x-hidden"
      style={{
        background: '#0B1220',
        backgroundImage: 'radial-gradient(circle at 15% 50%,rgba(99,102,241,.09) 0%,transparent 50%),radial-gradient(circle at 85% 30%,rgba(34,211,238,.08) 0%,transparent 50%)',
      }}
    >
      {/* Fixed bg */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div
          className="absolute inset-0 opacity-25"
          style={{
            backgroundSize: '40px 40px',
            backgroundImage: 'linear-gradient(to right,rgba(255,255,255,.02) 1px,transparent 1px),linear-gradient(to bottom,rgba(255,255,255,.02) 1px,transparent 1px)',
            WebkitMaskImage: 'linear-gradient(to bottom,transparent,black 10%,black 90%,transparent)',
          }}
        />
        {/* Twinkling stars — use global pp-twinkle class */}
        <div className="pp-twinkle" style={{ position: 'absolute', width: 2, height: 2, borderRadius: '50%', background: 'white', top: '20%', left: '10%', animationDelay: '0s' }} />
        <div className="pp-twinkle" style={{ position: 'absolute', width: 4, height: 4, borderRadius: '50%', background: 'white', top: '15%', left: '80%', animationDelay: '1s' }} />
        <div className="pp-twinkle" style={{ position: 'absolute', width: 2, height: 2, borderRadius: '50%', background: 'white', top: '60%', left: '5%', animationDelay: '.5s' }} />
        <div className="pp-twinkle" style={{ position: 'absolute', width: 6, height: 6, borderRadius: '50%', background: '#22d3ee', filter: 'blur(1px)', top: '70%', left: '85%', animationDelay: '1.5s' }} />
        <div className="pp-twinkle" style={{ position: 'absolute', width: 2, height: 2, borderRadius: '50%', background: 'white', top: '40%', left: '45%', animationDelay: '.2s' }} />
        <div className="pp-twinkle" style={{ position: 'absolute', width: 3, height: 3, borderRadius: '50%', background: '#a78bfa', top: '85%', left: '25%', animationDelay: '2s' }} />

        {/* Glow orbs */}
        <div className="absolute top-0 right-0 w-[800px] h-[800px] rounded-full -translate-y-1/2 translate-x-1/3" style={{ background: 'rgba(99,102,241,.10)', filter: 'blur(120px)' }} />
        <div className="absolute bottom-0 left-0 w-[600px] h-[600px] rounded-full translate-y-1/3 -translate-x-1/3" style={{ background: 'rgba(59,130,246,.10)', filter: 'blur(100px)' }} />
      </div>

      <PremiumNavbar />

      {/* ── HERO ── */}
      <main className="relative z-10 flex-grow flex items-center pt-24 md:pt-32 pb-16">
        <div className="max-w-7xl mx-auto px-6 w-full flex flex-col lg:flex-row items-center gap-12 lg:gap-8 text-center lg:text-left">

          {/* Left: text */}
          <div className="w-full lg:w-[55%] flex flex-col items-center lg:items-start order-2 lg:order-1">

            {/* Live badge */}
            <div className="pp-slide-up inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-8" style={GLASS_STYLE}>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
              <span className="text-xs font-medium tracking-wide text-blue-400 uppercase">
                {creatorModeActive ? '✦ Creator Mode Active' : 'v2.0 Protocol Live'}
              </span>
            </div>

            <h1 className="pp-slide-up pp-delay-100 text-5xl md:text-6xl lg:text-[72px] font-bold tracking-tighter text-white leading-[1.05]">
              Launch Tokens.<br />
              <span
                className="text-transparent bg-clip-text"
                style={{ backgroundImage: 'linear-gradient(to right,#3b82f6,#22d3ee)' }}
              >
                Ignite Markets.
              </span>
            </h1>

            <p className="pp-slide-up pp-delay-200 mt-6 text-base md:text-lg text-slate-400 max-w-[620px] leading-relaxed">
              PolPump is the next-gen token launch engine powered by bonding curves, real-time trading, and gamified incentives. Create, trade, and grow communities — all in seconds.
            </p>

            <div className="pp-slide-up pp-delay-300 mt-10 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
              <button
                onClick={handleMainCta}
                className="w-full sm:w-auto text-white text-sm font-semibold px-8 py-4 rounded-full flex items-center justify-center gap-2 transition-all hover:-translate-y-[2px] active:scale-95"
                style={{
                  background: isTraderRoleLocked
                    ? 'linear-gradient(to right,#dc2626,#b91c1c)'
                    : creatorModeActive
                      ? 'linear-gradient(to right,#a855f7,#4f46e5)'
                      : 'linear-gradient(to right,#3b82f6,#2563eb)',
                  boxShadow: isTraderRoleLocked
                    ? '0 0 22px rgba(220,38,38,.35)'
                    : creatorModeActive
                      ? '0 0 22px rgba(168,85,247,.45)'
                      : '0 0 22px rgba(59,130,246,.45)',
                }}
              >
                {isTraderRoleLocked
                  ? 'Role Locked: Trader'
                  : creatorModeActive
                    ? '🚀 Launch New Token'
                    : 'Create Your First Token'}
              </button>
              <Link
                href="/explore"
                className="w-full sm:w-auto text-white text-sm font-medium px-8 py-4 rounded-full transition-all hover:-translate-y-[2px] flex items-center justify-center gap-2"
                style={GLASS_STYLE}
              >
                Explore Tokens 🔭
              </Link>
            </div>

            {roleLockMessage && (
              <p className="pp-slide-up pp-delay-300 mt-3 text-sm text-red-300">
                {roleLockMessage}
              </p>
            )}

            {/* Trust badges */}
            <div className="pp-slide-up pp-delay-400 mt-16 pt-8 w-full border-t border-white/[0.06] grid grid-cols-2 md:grid-cols-4 gap-5">
              {[
                { icon: '⚡', label: 'Lightning Fast', color: '#06b6d4' },
                { icon: '🛡️', label: 'Audited Security', color: '#6366f1' },
                { icon: '🔗', label: '100% On-Chain', color: '#3b82f6' },
                { icon: '🔑', label: 'Permissionless', color: '#a855f7' },
              ].map(b => (
                <div key={b.label} className="flex items-center justify-center lg:justify-start gap-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm shrink-0" style={{ background: `${b.color}18`, color: b.color }}>
                    {b.icon}
                  </div>
                  <span className="text-xs font-medium text-slate-300">{b.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: animated rocket */}
          <div className="w-full lg:w-[45%] flex justify-center items-center order-1 lg:order-2 relative h-[320px] md:h-[420px] lg:h-[580px] pp-slide-up pp-delay-200">
            {/* Glow behind rocket */}
            <div
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 md:w-72 md:h-72 rounded-full pointer-events-none"
              style={{ background: 'rgba(59,130,246,.22)', filter: 'blur(72px)' }}
            />

            {/* Rocket — pp-float is the global float animation */}
            <div className="pp-float relative cursor-pointer select-none">
              <RocketSVG />
              {/* Shadow under rocket */}
              <div
                className="absolute -bottom-10 left-1/2 -translate-x-1/2 w-28 h-5 rounded-[100%]"
                style={{ background: 'rgba(0,0,0,.45)', filter: 'blur(10px)' }}
              />
            </div>

            {/* Floating info chips */}
            <div className="absolute top-[22%] right-[8%] lg:right-[18%] px-2.5 py-1.5 rounded-xl flex items-center gap-2 hidden sm:flex" style={GLASS_STYLE}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1 9 L4 5 L7 7 L11 2" stroke="#22d3ee" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
              <span className="text-xs font-bold text-white">+240%</span>
            </div>
            <div className="absolute bottom-[22%] left-[6%] lg:left-[14%] px-2.5 py-1.5 rounded-xl flex items-center gap-2 hidden sm:flex" style={GLASS_STYLE}>
              <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
              <span className="text-xs font-medium text-slate-300">LP Locked</span>
            </div>
          </div>

        </div>
      </main>

      {/* ── TRENDING TOKENS ── */}
      {trendingCoins.length > 0 && (
        <section className="relative z-10 py-20 px-6">
          <div className="max-w-7xl mx-auto">
            <div className="mb-12 text-center lg:text-left">
              <h2 className="text-4xl font-bold text-white mb-3">📈 Trending Tokens</h2>
              <p className="text-slate-400 text-lg">Discover the hottest tokens on PolPump</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {trendingCoins.map((coin, i) => (
                <PremiumTokenCard key={coin.id || i} token={coin} index={i} />
              ))}
            </div>
            <div className="text-center mt-12">
              <Link
                href="/explore"
                className="text-white text-sm font-medium px-8 py-4 rounded-full transition-all inline-flex items-center gap-2 hover:-translate-y-[2px]"
                style={GLASS_STYLE}
              >
                View All Tokens →
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* ── FEATURES ── */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-8">
          {[
            { icon: '⚡', title: 'Instant Launch', desc: 'Deploy your token with one click. Bonding curve provides instant liquidity.', color: '#3b82f6' },
            { icon: '✨', title: 'Creator Rewards', desc: 'Earn XP, climb leaderboards, and unlock perks as you grow.', color: '#10b981' },
            { icon: '📈', title: 'Built for Trading', desc: 'Trade via bonding curves instantly. Migrate to DEX when ready.', color: '#3b82f6' },
          ].map(f => (
            <div
              key={f.title}
              className="p-6 rounded-2xl hover:bg-white/[0.04] transition-all hover:-translate-y-1"
              style={GLASS_STYLE}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-4" style={{ background: `${f.color}18` }}>
                {f.icon}
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{f.title}</h3>
              <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── BECOME A CREATOR MODAL ── */}
      {showCreatorModal && !isTraderRoleLocked && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
          onClick={e => { if (e.target === e.currentTarget) setShowCreatorModal(false) }}
        >
          <div className="pp-modal-enter w-full max-w-[520px] rounded-[24px] p-6 md:p-8 relative overflow-hidden" style={MODAL_STYLE}>
            <button
              onClick={() => setShowCreatorModal(false)}
              className="absolute top-5 right-5 w-8 h-8 flex items-center justify-center rounded-full text-slate-400 hover:text-white transition-colors"
              style={{ background: 'rgba(255,255,255,.06)' }}
            >✕</button>

            <div className="text-center mb-8">
              <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center text-3xl mb-4" style={{ background: 'rgba(168,85,247,.12)', boxShadow: '0 0 20px rgba(168,85,247,.2)' }}>⭐</div>
              <h2 className="text-2xl font-bold text-white mb-2">Become a Creator</h2>
              <p className="text-sm text-slate-400">Launch tokens, build communities, and monetize attention in seconds.</p>
            </div>

            <div className="rounded-xl p-4 mb-6" style={{ background: 'rgba(0,0,0,.2)', border: '1px solid rgba(255,255,255,.05)' }}>
              <div className="grid grid-cols-2 gap-y-3 gap-x-2">
                {['Launch instantly', 'Earn trading fees', 'Real-time analytics', 'Global visibility'].map(b => (
                  <div key={b} className="flex items-center gap-2">
                    <span className="text-purple-400 text-sm">✓</span>
                    <span className="text-xs text-slate-300 font-medium">{b}</span>
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={handleCreatorSubmit} className="space-y-5">
              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">Creator Handle</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-sm">@</span>
                  <input
                    type="text"
                    value={handleInput}
                    onChange={e => setHandleInput(e.target.value)}
                    required
                    placeholder="yourname"
                    pattern="[a-zA-Z0-9_]{3,20}"
                    className="w-full h-11 rounded-xl pl-8 pr-4 text-sm font-medium text-white outline-none transition-all focus:ring-1 focus:ring-purple-500/40"
                    style={{ background: 'rgba(15,23,42,.65)', border: '1px solid rgba(255,255,255,.08)' }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-400 mb-1.5 ml-1">Primary Category</label>
                <select
                  value={categoryInput}
                  onChange={e => setCategoryInput(e.target.value)}
                  className="w-full h-11 rounded-xl px-4 text-sm font-medium text-white outline-none"
                  style={{ background: 'rgba(15,23,42,.65)', border: '1px solid rgba(255,255,255,.08)', appearance: 'none' }}
                >
                  {['meme', 'community', 'gaming', 'defi', 'ai', 'other'].map(c => (
                    <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex items-start gap-3">
                <input
                  type="checkbox"
                  id="terms"
                  checked={termsChecked}
                  onChange={e => setTermsChecked(e.target.checked)}
                  required
                  className="mt-1 rounded"
                />
                <label htmlFor="terms" className="text-xs text-slate-400 leading-relaxed cursor-pointer">
                  I understand token launches are public, irreversible, and subject to platform terms.
                </label>
              </div>

              <button
                type="submit"
                disabled={!handleInput || !termsChecked}
                className="w-full h-12 mt-4 rounded-xl text-white text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:-translate-y-[1px] disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: 'linear-gradient(to right,#a855f7,#6366f1)', boxShadow: '0 0 20px rgba(168,85,247,.4)' }}
              >
                Activate Creator Mode 🚀
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── SUCCESS MODAL ── */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/90 backdrop-blur-md p-4">
          <div className="pp-modal-enter w-full max-w-sm rounded-[24px] p-8 text-center relative overflow-hidden" style={GLASS_STYLE}>
            <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(to bottom,rgba(168,85,247,.12),transparent)' }} />
            <div
              className="pp-float w-20 h-20 mx-auto rounded-full flex items-center justify-center text-4xl mb-6 relative"
              style={{ background: 'linear-gradient(135deg,#a855f7,#6366f1)', boxShadow: '0 0 40px rgba(168,85,247,.5)' }}
            >
              🚀
            </div>
            <h3 className="text-2xl font-bold text-white tracking-tight mb-2">Lift Off! 🚀</h3>
            <p className="text-sm text-slate-300 mb-8">You are now registered as a Creator. Your dashboard is ready.</p>
            <button
              onClick={() => { setShowSuccessModal(false); setTimeout(() => setView('dashboard'), 300) }}
              className="w-full h-11 rounded-xl bg-white text-slate-900 text-sm font-semibold hover:bg-slate-100 transition-colors"
            >
              Go to Dashboard
            </button>
          </div>
        </div>
      )}

      <TokenCreatorModal
        isOpen={isTokenModalOpen}
        onClose={() => setIsTokenModalOpen(false)}
        onTokenCreated={handleCoinCreated}
      />
    </div>
  )
}
