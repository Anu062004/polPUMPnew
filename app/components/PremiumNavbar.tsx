'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Menu, X, Crown, Shield, LogOut } from 'lucide-react'
import { useAccount } from 'wagmi'
import { usePumpAI } from '../providers/PumpAIContext'
import { useAuth } from '../providers/AuthContext'

export default function PremiumNavbar() {
  const router = useRouter()
  const { address } = useAccount()
  const { setMemory } = usePumpAI()
  const { user, isAuthenticated, isLoading: authLoading, login, logout } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [isRoleSubmitting, setIsRoleSubmitting] = useState<'TRADER' | 'CREATOR' | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (address) {
      setMemory({ walletAddress: address.toLowerCase() })
    }
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
    try {
      await logout()
    } catch (error: any) {
      console.error('Logout failed:', error)
    }
  }

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

          {/* Centered Pills - Desktop */}
          <div className="hidden lg:flex items-center gap-1.5">
            <Link href="/" className="px-5 py-2 rounded-full border border-transparent text-slate-300 hover:bg-blue-500/12 hover:border-blue-500/35 hover:text-white hover:-translate-y-[1px] transition-all duration-200 text-sm font-medium">
              Home
            </Link>
            <Link href="/explore" className="px-5 py-2 rounded-full border border-transparent text-slate-300 hover:bg-blue-500/12 hover:border-blue-500/35 hover:text-white hover:-translate-y-[1px] transition-all duration-200 text-sm font-medium">
              Explore
            </Link>
            <Link href="/trader" className="px-5 py-2 rounded-full border border-transparent text-slate-300 hover:bg-blue-500/12 hover:border-blue-500/35 hover:text-white hover:-translate-y-[1px] transition-all duration-200 text-sm font-medium shrink-0">
              Trader
            </Link>
            <Link href="/creator" className="px-5 py-2 rounded-full border border-transparent text-slate-300 hover:bg-purple-500/12 hover:border-purple-500/35 hover:text-white hover:-translate-y-[1px] transition-all duration-200 text-sm font-medium flex items-center gap-1.5">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-slate-400">
                <path d="M12 2l1.5 4.5L18 8l-4.5 1.5L12 14l-1.5-4.5L6 8l4.5-1.5L12 2z" />
                <path d="M5 17l.8 2.4L8 20l-2.2.6L5 23l-.8-2.4L2 20l2.2-.6L5 17z" />
                <path d="M19 2l.6 1.8L21 4l-1.4.2L19 6l-.6-1.8L17 4l1.4-.2L19 2z" />
              </svg>
              Creator
            </Link>
            <Link href="/profile" className="px-5 py-2 rounded-full border border-transparent text-slate-300 hover:bg-blue-500/12 hover:border-blue-500/35 hover:text-white hover:-translate-y-[1px] transition-all duration-200 text-sm font-medium">
              Profile
            </Link>
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
                {({
                  account,
                  chain,
                  openAccountModal,
                  openChainModal,
                  openConnectModal,
                  authenticationStatus,
                  mounted: rbMounted,
                }) => {
                  const ready = rbMounted && authenticationStatus !== 'loading'
                  const connected =
                    ready &&
                    account &&
                    chain &&
                    (!authenticationStatus || authenticationStatus === 'authenticated')

                  if (!ready) return null

                  if (!connected) {
                    return (
                      <button
                        onClick={openConnectModal}
                        className="px-5 py-2 rounded-full bg-gradient-to-r from-[#3B82F6] to-[#2563EB] text-white text-sm font-medium shadow-[0_0_15px_rgba(59,130,246,0.5)] hover:shadow-[0_0_25px_rgba(59,130,246,0.7)] hover:scale-[1.03] transition-all duration-200 flex items-center gap-1.5"
                      >
                        Connect
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <rect x="2" y="5" width="20" height="14" rx="2" />
                          <path d="M16 12h.01" />
                          <path d="M2 10h20" />
                        </svg>
                      </button>
                    )
                  }

                  if (chain.unsupported) {
                    return (
                      <button
                        onClick={openChainModal}
                        className="px-5 py-2 rounded-full bg-red-500/20 border border-red-500/40 text-red-300 text-sm font-medium hover:-translate-y-[1px] transition-all duration-200"
                      >
                        Wrong Network
                      </button>
                    )
                  }

                  if (!isAuthenticated) {
                    return (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRoleRegistration('TRADER')}
                          disabled={authLoading || !!isRoleSubmitting}
                          className="px-3 py-2 rounded-full bg-cyan-500/15 border border-cyan-500/35 text-cyan-200 text-xs font-semibold hover:bg-cyan-500/25 transition-all disabled:opacity-50"
                          title="Register/login as Trader"
                        >
                          {isRoleSubmitting === 'TRADER' ? 'Signing...' : 'Trader'}
                        </button>
                        <button
                          onClick={() => handleRoleRegistration('CREATOR')}
                          disabled={authLoading || !!isRoleSubmitting}
                          className="px-3 py-2 rounded-full bg-purple-500/15 border border-purple-500/35 text-purple-200 text-xs font-semibold hover:bg-purple-500/25 transition-all disabled:opacity-50"
                          title="Register/login as Creator"
                        >
                          {isRoleSubmitting === 'CREATOR' ? 'Signing...' : 'Creator'}
                        </button>
                        <button
                          onClick={openAccountModal}
                          className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/15 border border-blue-500/35 text-blue-200 hover:bg-blue-500/25 hover:-translate-y-[1px] transition-all duration-200 text-sm font-mono tracking-tight"
                          title="Connected wallet"
                        >
                          {account.displayName}
                        </button>
                      </div>
                    )
                  }

                  return (
                    <div className="flex items-center gap-2">
                      <div className="hidden lg:flex items-center gap-1.5 px-3 py-2 rounded-full bg-white/5 border border-white/10 text-white text-xs font-semibold">
                        {user?.role === 'CREATOR' ? (
                          <Crown className="w-3.5 h-3.5 text-yellow-400" />
                        ) : (
                          <Shield className="w-3.5 h-3.5 text-cyan-400" />
                        )}
                        {user?.role || 'USER'}
                      </div>
                      <button
                        onClick={openAccountModal}
                        className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/15 border border-blue-500/35 text-blue-200 hover:bg-blue-500/25 hover:-translate-y-[1px] transition-all duration-200 text-sm font-mono tracking-tight"
                        title="Click to manage wallet"
                      >
                        {account.displayName}
                      </button>
                      <button
                        onClick={handleLogout}
                        className="p-2 rounded-full bg-white/5 border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
                        title="Logout"
                      >
                        <LogOut className="w-4 h-4" />
                      </button>
                    </div>
                  )
                }}
              </ConnectButton.Custom>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 rounded-full bg-white/5 text-white hover:bg-white/10 transition-colors"
            aria-label="Toggle menu"
          >
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
              {[
                { href: '/', label: 'Home' },
                { href: '/explore', label: 'Explore' },
                { href: '/trader', label: 'Trader' },
                { href: '/creator', label: 'Creator' },
                { href: '/profile', label: 'Profile' },
              ].map(({ href, label }) => (
                <Link
                  key={href}
                  href={href}
                  className="px-4 py-3 rounded-xl bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white transition-all text-sm font-medium text-center"
                  onClick={() => setIsMenuOpen(false)}
                >
                  {label}
                </Link>
              ))}
              <div className="pt-2">
                {mounted && (
                  <ConnectButton.Custom>
                    {({ account, chain, openAccountModal, openChainModal, openConnectModal, authenticationStatus, mounted: rbMounted }) => {
                      const ready = rbMounted && authenticationStatus !== 'loading'
                      const connected = ready && account && chain && (!authenticationStatus || authenticationStatus === 'authenticated')
                      if (!ready) return null
                      if (!connected) return (
                        <button onClick={openConnectModal} className="w-full px-5 py-3 rounded-xl bg-gradient-to-r from-[#3B82F6] to-[#2563EB] text-white text-sm font-medium">
                          Connect Wallet
                        </button>
                      )
                      if (chain.unsupported) return (
                        <button onClick={openChainModal} className="w-full px-5 py-3 rounded-xl bg-red-500/20 border border-red-500/40 text-red-300 text-sm font-medium">
                          Wrong Network
                        </button>
                      )
                      if (!isAuthenticated) {
                        return (
                          <div className="flex flex-col gap-2">
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                onClick={() => handleRoleRegistration('TRADER')}
                                disabled={authLoading || !!isRoleSubmitting}
                                className="px-4 py-3 rounded-xl bg-cyan-500/15 border border-cyan-500/35 text-cyan-200 text-xs font-semibold disabled:opacity-50"
                              >
                                {isRoleSubmitting === 'TRADER' ? 'Signing...' : 'Trader'}
                              </button>
                              <button
                                onClick={() => handleRoleRegistration('CREATOR')}
                                disabled={authLoading || !!isRoleSubmitting}
                                className="px-4 py-3 rounded-xl bg-purple-500/15 border border-purple-500/35 text-purple-200 text-xs font-semibold disabled:opacity-50"
                              >
                                {isRoleSubmitting === 'CREATOR' ? 'Signing...' : 'Creator'}
                              </button>
                            </div>
                            <button onClick={openAccountModal} className="w-full px-5 py-3 rounded-xl bg-blue-500/15 border border-blue-500/35 text-blue-200 text-sm font-mono">
                              {account.displayName}
                            </button>
                          </div>
                        )
                      }

                      return (
                        <div className="flex flex-col gap-2">
                          <div className="w-full px-5 py-2 rounded-xl bg-white/5 border border-white/10 text-white text-xs font-semibold flex items-center justify-center gap-1.5">
                            {user?.role === 'CREATOR' ? (
                              <Crown className="w-3.5 h-3.5 text-yellow-400" />
                            ) : (
                              <Shield className="w-3.5 h-3.5 text-cyan-400" />
                            )}
                            {user?.role || 'USER'}
                          </div>
                          <button onClick={openAccountModal} className="w-full px-5 py-3 rounded-xl bg-blue-500/15 border border-blue-500/35 text-blue-200 text-sm font-mono">
                            {account.displayName}
                          </button>
                          <button onClick={handleLogout} className="w-full px-5 py-3 rounded-xl bg-white/5 border border-white/10 text-slate-200 text-sm font-medium flex items-center justify-center gap-2">
                            <LogOut className="w-4 h-4" />
                            Logout
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
