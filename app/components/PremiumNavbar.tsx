'use client'

import React, { useEffect, useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Menu, X, Crown, Shield, LogOut, Home, Compass, TrendingUp, Star, User, BarChart2, Layers, Zap, Users, Award, DollarSign, Bell, Wallet, LayoutDashboard, Activity, Megaphone, BookOpen, Package, Droplet, Lock, Gift, ChevronRight, Flame, PlusCircle, Trophy } from 'lucide-react'
import { useAccount } from 'wagmi'
import { usePumpAI } from '../providers/PumpAIContext'
import { useAuth } from '../providers/AuthContext'

// ─── Mega Menu Panel Definitions ──────────────────────────────────────────────

type MenuItemDef = {
  icon: React.ReactNode
  label: string
  desc: string
  href: string
}

type PanelDef =
  | { type: 'single'; items: MenuItemDef[]; width: number }
  | { type: 'double'; col1: { title: string; items: MenuItemDef[] }; col2: { title: string; items: MenuItemDef[] }; width: number }
  | { type: 'trader'; items: MenuItemDef[]; width: number }
  | { type: 'creator'; col1: { title: string; items: MenuItemDef[] }; col2: { title: string; items: MenuItemDef[] }; cta: string; width: number }
  | { type: 'profile'; items: MenuItemDef[]; width: number }

const NAV_PANELS: Record<string, PanelDef> = {
  Home: {
    type: 'single',
    width: 280,
    items: [
      { icon: <LayoutDashboard className="w-4 h-4" />, label: 'Dashboard', desc: 'Your activity at a glance', href: '/' },
      { icon: <Activity className="w-4 h-4" />, label: 'Recent Activity', desc: 'Latest trades & events', href: '/' },
      { icon: <Megaphone className="w-4 h-4" />, label: 'Announcements', desc: 'Platform news & updates', href: '/' },
      { icon: <BookOpen className="w-4 h-4" />, label: 'Docs', desc: 'Guides & documentation', href: '/' },
    ],
  },
  Explore: {
    type: 'double',
    width: 620,
    col1: {
      title: 'Tokens',
      items: [
        { icon: <Compass className="w-4 h-4" />, label: 'Explore Tokens', desc: 'Browse all listed tokens', href: '/explore' },
        { icon: <Flame className="w-4 h-4" />, label: 'Trending Tokens', desc: 'What the market is watching', href: '/explore' },
        { icon: <Zap className="w-4 h-4" />, label: 'New Launches', desc: 'Fresh tokens just listed', href: '/explore' },
        { icon: <BarChart2 className="w-4 h-4" />, label: 'Top Volume', desc: 'Highest traded by volume', href: '/explore' },
        { icon: <Trophy className="w-4 h-4" />, label: 'Leaderboards', desc: 'Top performers ranked', href: '/explore' },
      ],
    },
    col2: {
      title: 'Creators',
      items: [
        { icon: <Users className="w-4 h-4" />, label: 'Explore Creators', desc: 'Discover token creators', href: '/explore' },
        { icon: <Star className="w-4 h-4" />, label: 'Top Creators', desc: 'Highest rated creators', href: '/explore' },
        { icon: <Layers className="w-4 h-4" />, label: 'Communities', desc: 'Join active communities', href: '/explore' },
        { icon: <Award className="w-4 h-4" />, label: 'Verified Creators', desc: 'Trusted & verified', href: '/explore' },
      ],
    },
  },
  Trader: {
    type: 'trader',
    width: 560,
    items: [
      { icon: <TrendingUp className="w-4 h-4" />, label: 'Live Trading', desc: 'Execute trades in real time', href: '/trader' },
      { icon: <BarChart2 className="w-4 h-4" />, label: 'Charts', desc: 'Advanced price analysis', href: '/trader' },
      { icon: <Package className="w-4 h-4" />, label: 'Portfolio', desc: 'Track your holdings', href: '/trader' },
      { icon: <Layers className="w-4 h-4" />, label: 'Positions', desc: 'Open & closed positions', href: '/trader' },
      { icon: <Droplet className="w-4 h-4" />, label: 'Liquidity Pools', desc: 'Provide & earn from liquidity', href: '/trader' },
      { icon: <Gift className="w-4 h-4" />, label: 'Trading Rewards', desc: 'Earn as you trade', href: '/trader' },
    ],
  },
  Creator: {
    type: 'creator',
    width: 680,
    cta: 'Launch your token in seconds 🚀',
    col1: {
      title: 'Manage',
      items: [
        { icon: <LayoutDashboard className="w-4 h-4" />, label: 'Creator Dashboard', desc: 'Overview of your tokens', href: '/creator' },
        { icon: <PlusCircle className="w-4 h-4" />, label: 'Launch Token', desc: 'Create a new token fast', href: '/creator' },
        { icon: <Package className="w-4 h-4" />, label: 'My Tokens', desc: 'Manage launched tokens', href: '/creator' },
        { icon: <Droplet className="w-4 h-4" />, label: 'Liquidity Management', desc: 'Control pool liquidity', href: '/creator' },
        { icon: <DollarSign className="w-4 h-4" />, label: 'Earnings', desc: 'Revenue & fee earnings', href: '/creator' },
      ],
    },
    col2: {
      title: 'Grow',
      items: [
        { icon: <BarChart2 className="w-4 h-4" />, label: 'Analytics', desc: 'Deep token insights', href: '/creator' },
        { icon: <Users className="w-4 h-4" />, label: 'Community Tools', desc: 'Engage your holders', href: '/creator' },
        { icon: <Gift className="w-4 h-4" />, label: 'Airdrops', desc: 'Distribute tokens to holders', href: '/creator' },
        { icon: <Megaphone className="w-4 h-4" />, label: 'Promotions', desc: 'Boost token visibility', href: '/creator' },
        { icon: <BookOpen className="w-4 h-4" />, label: 'Creator Docs', desc: 'Guides for creators', href: '/creator' },
      ],
    },
  },
  Profile: {
    type: 'profile',
    width: 280,
    items: [
      { icon: <User className="w-4 h-4" />, label: 'My Profile', desc: 'View & edit your profile', href: '/profile' },
      { icon: <Wallet className="w-4 h-4" />, label: 'Wallet Settings', desc: 'Manage connected wallets', href: '/profile' },
      { icon: <Bell className="w-4 h-4" />, label: 'Notifications', desc: 'Activity alerts & updates', href: '/profile' },
    ],
  },
}

// ─── Shared Item Row ─────────────────────────────────────────────────────────

function MenuItem({ icon, label, desc, href }: MenuItemDef) {
  return (
    <Link href={href} className="group flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-white/6 transition-colors duration-150">
      <div className="shrink-0 mt-0.5 w-8 h-8 rounded-lg bg-white/8 border border-white/8 flex items-center justify-center text-cyan-400 group-hover:bg-cyan-500/20 group-hover:text-cyan-300 transition-colors duration-150">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[13px] font-semibold text-white/90 group-hover:text-white leading-none mb-0.5">{label}</div>
        <div className="text-[11px] text-slate-500 group-hover:text-slate-400 leading-tight">{desc}</div>
      </div>
    </Link>
  )
}

// ─── Panel Content ────────────────────────────────────────────────────────────

function PanelContent({ panel }: { panel: PanelDef }) {
  if (panel.type === 'single' || panel.type === 'profile') {
    return (
      <div className="flex flex-col gap-0.5 p-3">
        {panel.items.map((item) => (
          <MenuItem key={item.label} {...item} />
        ))}
      </div>
    )
  }

  if (panel.type === 'double') {
    return (
      <div className="grid grid-cols-2 gap-1 p-3">
        <div>
          <div className="px-3 py-1.5 text-[10px] font-bold tracking-widest text-slate-500 uppercase">{panel.col1.title}</div>
          {panel.col1.items.map((item) => <MenuItem key={item.label} {...item} />)}
        </div>
        <div>
          <div className="px-3 py-1.5 text-[10px] font-bold tracking-widest text-slate-500 uppercase">{panel.col2.title}</div>
          {panel.col2.items.map((item) => <MenuItem key={item.label} {...item} />)}
        </div>
      </div>
    )
  }

  if (panel.type === 'trader') {
    return (
      <div className="flex gap-3 p-3">
        {/* Items grid */}
        <div className="flex flex-col gap-0.5 flex-1">
          {panel.items.map((item) => <MenuItem key={item.label} {...item} />)}
        </div>
        {/* Stats card */}
        <div className="w-[168px] shrink-0 rounded-xl bg-gradient-to-b from-cyan-500/10 to-indigo-500/10 border border-white/8 p-4 flex flex-col gap-3">
          <div className="text-[10px] font-bold tracking-widest text-slate-500 uppercase">Market</div>
          {[
            { label: 'POL/USDC', value: '$0.523', change: '+2.4%', up: true },
            { label: '24h Vol', value: '$1.2M', change: null, up: false },
            { label: 'Tokens', value: '3,412', change: null, up: false },
          ].map(({ label, value, change, up }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400">{label}</span>
              <span className="flex items-center gap-1">
                <span className="text-[12px] font-semibold text-white">{value}</span>
                {change && (
                  <span className={`text-[10px] font-bold ${up ? 'text-emerald-400' : 'text-red-400'}`}>{change}</span>
                )}
              </span>
            </div>
          ))}
          <Link href="/trader" className="mt-auto text-center text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 flex items-center justify-center gap-1 transition-colors">
            Open Terminal <ChevronRight className="w-3 h-3" />
          </Link>
        </div>
      </div>
    )
  }

  if (panel.type === 'creator') {
    return (
      <div className="p-3">
        <div className="grid grid-cols-2 gap-1 mb-3">
          <div>
            <div className="px-3 py-1.5 text-[10px] font-bold tracking-widest text-slate-500 uppercase">{panel.col1.title}</div>
            {panel.col1.items.map((item) => <MenuItem key={item.label} {...item} />)}
          </div>
          <div>
            <div className="px-3 py-1.5 text-[10px] font-bold tracking-widest text-slate-500 uppercase">{panel.col2.title}</div>
            {panel.col2.items.map((item) => <MenuItem key={item.label} {...item} />)}
          </div>
        </div>
        {/* CTA Card */}
        <Link href="/creator" className="group mx-1 flex items-center justify-between rounded-xl bg-gradient-to-r from-purple-600/25 via-indigo-600/20 to-cyan-600/15 border border-purple-500/30 px-4 py-3 hover:border-purple-400/50 transition-all duration-200">
          <span className="text-[13px] font-semibold text-white/90 group-hover:text-white">{panel.cta}</span>
          <ChevronRight className="w-4 h-4 text-purple-400 group-hover:translate-x-0.5 transition-transform" />
        </Link>
      </div>
    )
  }

  return null
}

// ─── Mega Menu Dropdown ───────────────────────────────────────────────────────

interface MegaMenuProps {
  label: string
  href: string
  panel: PanelDef
  // for mobile
  mobileOpen: boolean
  onMobileToggle: () => void
  onMobileClose: () => void
}

function NavItemWithMenu({ label, href, panel, mobileOpen, onMobileToggle, onMobileClose }: MegaMenuProps) {
  const [open, setOpen] = useState(false)
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  const startOpen = useCallback(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    openTimer.current = setTimeout(() => setOpen(true), 120)
  }, [])

  const startClose = useCallback(() => {
    if (openTimer.current) clearTimeout(openTimer.current)
    closeTimer.current = setTimeout(() => setOpen(false), 80)
  }, [])

  useEffect(() => () => {
    if (openTimer.current) clearTimeout(openTimer.current)
    if (closeTimer.current) clearTimeout(closeTimer.current)
  }, [])

  const panelVars = {
    hidden: { opacity: 0, y: 10, scale: 0.98 },
    visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.22, ease: [0.16, 1, 0.3, 1] } },
    exit: { opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.15, ease: 'easeIn' } },
  }

  const isCreator = label === 'Creator'

  return (
    <div ref={wrapperRef} className="relative" onMouseEnter={startOpen} onMouseLeave={startClose}>
      {/* Desktop trigger */}
      <Link
        href={href}
        className={`hidden lg:flex items-center gap-1.5 px-5 py-2 rounded-full border border-transparent text-slate-300 hover:bg-blue-500/12 hover:border-blue-500/35 hover:text-white hover:-translate-y-[1px] transition-all duration-200 text-sm font-medium ${isCreator ? 'hover:bg-purple-500/12 hover:border-purple-500/35' : ''}`}
      >
        {isCreator && (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400">
            <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z" />
            <path d="M5 17l.8 2.4L8 20l-2.2.6L5 23l-.8-2.4L2 20l2.2-.6L5 17z" />
            <path d="M19 2l.6 1.8L21 4l-1.4.2L19 6l-.6-1.8L17 4l1.4-.2L19 2z" />
          </svg>
        )}
        {label}
      </Link>

      {/* Desktop dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            variants={panelVars}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="absolute top-[calc(100%+12px)] z-[200] overflow-hidden rounded-[20px] border border-white/[0.08] shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
            style={{
              width: panel.width,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(10,18,35,0.88)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            }}
            // keep open when cursor over panel
            onMouseEnter={startOpen}
            onMouseLeave={startClose}
          >
            {/* Arrow */}
            <div
              className="absolute -top-[6px] left-1/2 -translate-x-1/2 w-3 h-3 rotate-45 rounded-sm border-l border-t border-white/[0.08]"
              style={{ background: 'rgba(10,18,35,0.88)', boxShadow: '0 0 8px rgba(34,211,238,0.15)' }}
            />
            <PanelContent panel={panel} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile trigger */}
      <button
        onClick={onMobileToggle}
        className="lg:hidden w-full text-left px-4 py-3 rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition-all text-sm font-medium flex items-center justify-between"
      >
        {label}
        <ChevronRight className={`w-4 h-4 transition-transform duration-200 ${mobileOpen ? 'rotate-90' : ''}`} />
      </button>

      {/* Mobile sub-panel */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="lg:hidden overflow-hidden mt-1 rounded-xl border border-white/6"
            style={{ background: 'rgba(10,18,35,0.7)', backdropFilter: 'blur(12px)' }}
          >
            <MobileMenuItems panel={panel} onClose={onMobileClose} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function MobileMenuItems({ panel, onClose }: { panel: PanelDef; onClose: () => void }) {
  const allItems: MenuItemDef[] = (() => {
    if (panel.type === 'single' || panel.type === 'profile' || panel.type === 'trader') return panel.items
    if (panel.type === 'double') return [...panel.col1.items, ...panel.col2.items]
    if (panel.type === 'creator') return [...panel.col1.items, ...panel.col2.items]
    return []
  })()

  return (
    <div className="p-2 flex flex-col gap-0.5">
      {allItems.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          onClick={onClose}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/8 transition-colors"
        >
          <span className="text-cyan-400 shrink-0">{item.icon}</span>
          <span className="text-sm text-slate-300 hover:text-white">{item.label}</span>
        </Link>
      ))}
    </div>
  )
}

// ─── Main Navbar ──────────────────────────────────────────────────────────────

export default function PremiumNavbar() {
  const router = useRouter()
  const { address } = useAccount()
  const { setMemory } = usePumpAI()
  const { user, isAuthenticated, isLoading: authLoading, login, logout } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isRoleSubmitting, setIsRoleSubmitting] = useState<'TRADER' | 'CREATOR' | null>(null)
  const [openMobilePanel, setOpenMobilePanel] = useState<string | null>(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (address) setMemory({ walletAddress: address.toLowerCase() })
  }, [address, setMemory])

  const handleRoleRegistration = async (role: 'TRADER' | 'CREATOR') => {
    try {
      setIsRoleSubmitting(role)
      await login(role)
      router.push(role === 'CREATOR' ? '/creator' : '/trader')
    } catch (error: any) {
      alert(`Registration failed: ${error?.message || 'Please try again'}`)
    } finally {
      setIsRoleSubmitting(null)
    }
  }

  const handleLogout = async () => {
    try { await logout() } catch (error: any) { console.error('Logout failed:', error) }
  }

  const navItems = [
    { label: 'Home', href: '/' },
    { label: 'Explore', href: '/explore' },
    { label: 'Trader', href: '/trader' },
    { label: 'Creator', href: '/creator' },
    { label: 'Profile', href: '/profile' },
  ]

  return (
    <div className="fixed top-0 inset-x-0 z-[60] px-4 pt-5 pb-2 pointer-events-none">
      <nav className="pointer-events-auto max-w-7xl mx-auto rounded-[20px] bg-slate-900/70 backdrop-blur-xl border border-white/5 shadow-[0_8px_32px_rgba(0,0,0,0.2)] transition-all duration-300">
        <div className="px-4 md:px-5 h-[68px] flex items-center justify-between gap-4">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-400 to-indigo-500 flex items-center justify-center text-slate-950 shadow-[0_0_15px_rgba(34,211,238,0.3)] group-hover:shadow-[0_0_20px_rgba(34,211,238,0.5)] transition-all">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2L8 8H4l4 4-2 8 6-4 6 4-2-8 4-4h-4L12 2z" />
              </svg>
            </div>
            <span className="font-bold tracking-tight text-lg text-white group-hover:text-cyan-50 transition-colors ml-1">POLPUMP</span>
          </Link>

          {/* Desktop Nav — mega menu items */}
          <div className="hidden lg:flex items-center gap-1.5">
            {navItems.map(({ label, href }) => (
              <NavItemWithMenu
                key={label}
                label={label}
                href={href}
                panel={NAV_PANELS[label]}
                mobileOpen={openMobilePanel === label}
                onMobileToggle={() => setOpenMobilePanel(openMobilePanel === label ? null : label)}
                onMobileClose={() => setOpenMobilePanel(null)}
              />
            ))}
          </div>

          {/* Right Action Buttons */}
          <div className="hidden md:flex items-center gap-3 shrink-0">
            {/* Polygon Network Badge */}
            <div className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-purple-500/15 border border-purple-500/40 text-purple-200 text-sm font-medium">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" />
                <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" />
              </svg>
              Polygon
            </div>

            {/* RainbowKit Wallet Connect */}
            {mounted && (
              <ConnectButton.Custom>
                {({ account, chain, openAccountModal, openChainModal, openConnectModal, authenticationStatus, mounted: rbMounted }) => {
                  const ready = rbMounted && authenticationStatus !== 'loading'
                  const connected = ready && account && chain && (!authenticationStatus || authenticationStatus === 'authenticated')
                  if (!ready) return null
                  if (!connected) return (
                    <button onClick={openConnectModal} className="px-5 py-2 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#2563EB] text-white text-sm font-medium shadow-[0_0_15px_rgba(59,130,246,0.5)] hover:shadow-[0_0_25px_rgba(59,130,246,0.7)] hover:scale-[1.03] transition-all duration-200 flex items-center gap-1.5">
                      Connect
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="2" y="5" width="20" height="14" rx="2" />
                        <path d="M16 12h.01" /><path d="M2 10h20" />
                      </svg>
                    </button>
                  )
                  if (chain.unsupported) return (
                    <button onClick={openChainModal} className="px-5 py-2 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 text-sm font-medium hover:-translate-y-[1px] transition-all duration-200">
                      Wrong Network
                    </button>
                  )
                  if (!isAuthenticated) return (
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleRoleRegistration('TRADER')} disabled={authLoading || !!isRoleSubmitting} className="px-3 py-2 rounded-full bg-cyan-500/15 border border-cyan-500/35 text-cyan-200 text-xs font-semibold hover:bg-cyan-500/25 transition-all disabled:opacity-50" title="Register/login as Trader">
                        {isRoleSubmitting === 'TRADER' ? 'Signing...' : 'Trader'}
                      </button>
                      <button onClick={() => handleRoleRegistration('CREATOR')} disabled={authLoading || !!isRoleSubmitting} className="px-3 py-2 rounded-full bg-purple-500/15 border border-purple-500/35 text-purple-200 text-xs font-semibold hover:bg-purple-500/25 transition-all disabled:opacity-50" title="Register/login as Creator">
                        {isRoleSubmitting === 'CREATOR' ? 'Signing...' : 'Creator'}
                      </button>
                      <button onClick={openAccountModal} className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/15 border border-blue-500/35 text-blue-200 hover:bg-blue-500/25 hover:-translate-y-[1px] transition-all duration-200 text-sm font-mono tracking-tight" title="Connected wallet">
                        {account.displayName}
                      </button>
                    </div>
                  )
                  return (
                    <div className="flex items-center gap-2">
                      <div className="hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/5 border border-white/10 text-white text-xs font-semibold">
                        {user?.role === 'CREATOR' ? <Crown className="w-3.5 h-3.5 text-yellow-400" /> : <Shield className="w-3.5 h-3.5 text-cyan-400" />}
                        {user?.role || 'USER'}
                      </div>
                      <button onClick={openAccountModal} className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/15 border border-blue-500/35 text-blue-200 hover:bg-blue-500/25 hover:-translate-y-[1px] transition-all duration-200 text-sm font-mono tracking-tight" title="Click to manage wallet">
                        {account.displayName}
                      </button>
                      <button onClick={handleLogout} className="p-2 rounded-full bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-colors" title="Logout">
                        <LogOut className="w-4 h-4" />
                      </button>
                    </div>
                  )
                }}
              </ConnectButton.Custom>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden p-2 rounded-full bg-white/5 text-white hover:bg-white/10 transition-colors" aria-label="Toggle menu">
            {isMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden border-t border-white/5 px-4 py-4 flex flex-col gap-2"
            >
              {navItems.map(({ label, href }) => (
                <NavItemWithMenu
                  key={label}
                  label={label}
                  href={href}
                  panel={NAV_PANELS[label]}
                  mobileOpen={openMobilePanel === label}
                  onMobileToggle={() => setOpenMobilePanel(openMobilePanel === label ? null : label)}
                  onMobileClose={() => { setOpenMobilePanel(null); setIsMenuOpen(false) }}
                />
              ))}
              <div className="pt-2">
                {mounted && (
                  <ConnectButton.Custom>
                    {({ account, chain, openAccountModal, openChainModal, openConnectModal, authenticationStatus, mounted: rbMounted }) => {
                      const ready = rbMounted && authenticationStatus !== 'loading'
                      const connected = ready && account && chain && (!authenticationStatus || authenticationStatus === 'authenticated')
                      if (!ready) return null
                      if (!connected) return <button onClick={openConnectModal} className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#2563EB] text-white text-sm font-medium">Connect Wallet</button>
                      if (chain.unsupported) return <button onClick={openChainModal} className="w-full px-5 py-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-sm font-medium">Wrong Network</button>
                      if (!isAuthenticated) return (
                        <div className="flex flex-col gap-2">
                          <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => handleRoleRegistration('TRADER')} disabled={authLoading || !!isRoleSubmitting} className="px-4 py-3 rounded-xl bg-cyan-500/15 border border-cyan-500/35 text-cyan-200 text-xs font-semibold disabled:opacity-50">
                              {isRoleSubmitting === 'TRADER' ? 'Signing...' : 'Trader'}
                            </button>
                            <button onClick={() => handleRoleRegistration('CREATOR')} disabled={authLoading || !!isRoleSubmitting} className="px-4 py-3 rounded-xl bg-purple-500/15 border border-purple-500/35 text-purple-200 text-xs font-semibold disabled:opacity-50">
                              {isRoleSubmitting === 'CREATOR' ? 'Signing...' : 'Creator'}
                            </button>
                          </div>
                          <button onClick={openAccountModal} className="w-full px-5 py-3 rounded-xl bg-blue-500/15 border border-blue-500/35 text-blue-200 text-sm font-mono">{account.displayName}</button>
                        </div>
                      )
                      return (
                        <div className="flex flex-col gap-2">
                          <div className="w-full px-5 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-semibold flex items-center justify-center gap-1.5">
                            {user?.role === 'CREATOR' ? <Crown className="w-3.5 h-3.5 text-yellow-400" /> : <Shield className="w-3.5 h-3.5 text-cyan-400" />}
                            {user?.role || 'USER'}
                          </div>
                          <button onClick={openAccountModal} className="w-full px-5 py-3 rounded-xl bg-blue-500/15 border border-blue-500/35 text-blue-200 text-sm font-mono">{account.displayName}</button>
                          <button onClick={handleLogout} className="w-full px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-200 text-sm font-medium flex items-center justify-center gap-2">
                            <LogOut className="w-4 h-4" /> Logout
                          </button>
                        </div>
                      )
                    }}
                  </ConnectButton.Custom>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </div>
  )
}
