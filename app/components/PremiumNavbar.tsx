'use client'

import React, { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Link from 'next/link'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Home, Sparkles, Gamepad2, User, Search, Video, Bot, Menu, X, ChevronDown } from 'lucide-react'
import { useAccount } from 'wagmi'
import { usePumpAI } from '../providers/PumpAIContext'
import AuthButton from '../../components/AuthButton'
// Using img tag instead of Next Image for better compatibility

export default function PremiumNavbar() {
  const { address } = useAccount()
  const { setMemory } = usePumpAI()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  // Keep Pump AI memory in sync with connected wallet
  useEffect(() => {
    if (address) {
      setMemory({ walletAddress: address.toLowerCase() })
    }
  }, [address, setMemory])

  return (
    <motion.nav
      initial={{ y: -100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/10"
    >
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <img
                src="/pump-logo.jpg"
                alt="POL Pump"
                width={40}
                height={40}
                className="rounded-lg w-10 h-10 object-cover"
                onError={(e) => {
                  // Fallback if image doesn't exist
                  e.currentTarget.style.display = 'none'
                }}
              />
            </div>
            <span className="font-bold text-xl text-white group-hover:text-blue-400 transition-all duration-200">
              POL Pump
            </span>
          </Link>

          {/* Hamburger Menu Button */}
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="md:hidden p-2 text-slate-400 hover:text-white transition-colors"
            aria-label="Toggle menu"
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>

          {/* Navigation Links - Desktop */}
          <div className="hidden md:flex items-center gap-6">
            <Link href="/" className="text-slate-300 hover:text-white transition-colors duration-200 text-sm font-medium">
              Home
            </Link>
            <Link href="/explore" className="text-slate-300 hover:text-white transition-colors duration-200 text-sm font-medium">
              Explore
            </Link>
            <Link href="/livestreams" className="text-slate-300 hover:text-white transition-colors duration-200 text-sm font-medium">
              Live
            </Link>
            <Link href="/ai-chat" className="text-slate-300 hover:text-white transition-colors duration-200 text-sm font-medium">
              AI Chat
            </Link>
            <Link href="/gaming" className="text-slate-300 hover:text-white transition-colors duration-200 text-sm font-medium">
              Gaming
            </Link>
            <Link href="/trader" className="text-slate-300 hover:text-white transition-colors duration-200 text-sm font-medium">
              Trader
            </Link>
            <Link href="/creator" className="text-slate-300 hover:text-white transition-colors duration-200 text-sm font-medium">
              Creator
            </Link>
            <Link href="/profile" className="text-slate-300 hover:text-white transition-colors duration-200 text-sm font-medium">
              Profile
            </Link>
          </div>

          {/* Wallet Connect */}
          <div className="hidden md:flex items-center gap-3">
            <ConnectButton.Custom>
              {({
                account,
                chain,
                openAccountModal,
                openChainModal,
                openConnectModal,
                authenticationStatus,
                mounted,
              }) => {
                const ready = mounted && authenticationStatus !== 'loading'
                const connected =
                  ready &&
                  account &&
                  chain &&
                  (!authenticationStatus ||
                    authenticationStatus === 'authenticated')

                return (
                  <div
                    {...(!ready && {
                      'aria-hidden': true,
                      style: {
                        opacity: 0,
                        pointerEvents: 'none',
                        userSelect: 'none',
                      },
                    })}
                  >
                    {(() => {
                      if (!connected) {
                        return (
                          <button
                            onClick={openConnectModal}
                            className="btn-primary"
                          >
                            Connect Wallet
                          </button>
                        )
                      }

                      if (chain.unsupported) {
                        return (
                          <button
                            onClick={openChainModal}
                            className="btn-secondary"
                          >
                            Wrong network
                          </button>
                        )
                      }

                      return (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={openChainModal}
                            className="btn-secondary text-sm"
                          >
                            {chain.hasIcon && (
                              <div
                                style={{
                                  background: chain.iconBackground,
                                  width: 16,
                                  height: 16,
                                  borderRadius: 999,
                                  overflow: 'hidden',
                                  marginRight: 4,
                                }}
                              >
                                {chain.iconUrl && (
                                  <img
                                    alt={chain.name ?? 'Chain icon'}
                                    src={chain.iconUrl}
                                    style={{ width: 16, height: 16 }}
                                  />
                                )}
                              </div>
                            )}
                            {chain.name}
                          </button>

                          <button
                            onClick={openAccountModal}
                            className="btn-primary text-sm"
                          >
                            {account.displayName}
                          </button>

                          {/* Auth Button (Login/Logout) */}
                          <AuthButton />
                        </div>
                      )
                    })()}
                  </div>
                )
              }}
            </ConnectButton.Custom>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden border-t border-white/10 mt-4 pt-4"
            >
              {/* Mobile Navigation Links - Vertical Stack */}
              <div className="flex flex-col gap-2 px-2">
                <Link
                  href="/"
                  className="px-4 py-3 rounded-lg bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-white transition-all text-sm font-medium text-center"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Home
                </Link>
                <Link
                  href="/explore"
                  className="px-4 py-3 rounded-lg bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-white transition-all text-sm font-medium text-center"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Explore
                </Link>
                <Link
                  href="/livestreams"
                  className="px-4 py-3 rounded-lg bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-white transition-all text-sm font-medium text-center"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Live
                </Link>
                <Link
                  href="/ai-chat"
                  className="px-4 py-3 rounded-lg bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-white transition-all text-sm font-medium text-center"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Pump AI
                </Link>
                <Link
                  href="/gaming"
                  className="px-4 py-3 rounded-lg bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-white transition-all text-sm font-medium text-center"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Gaming
                </Link>
                <Link
                  href="/profile"
                  className="px-4 py-3 rounded-lg bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-white transition-all text-sm font-medium text-center"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Profile
                </Link>
                <Link
                  href="/trader"
                  className="px-4 py-3 rounded-lg bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-white transition-all text-sm font-medium text-center"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Trader
                </Link>
                <Link
                  href="/creator"
                  className="px-4 py-3 rounded-lg bg-slate-800/50 text-slate-300 hover:bg-slate-700 hover:text-white transition-all text-sm font-medium text-center"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Creator
                </Link>
              </div>

              {/* Mobile Wallet Connect */}
              <div className="mt-4 px-2">
                <ConnectButton.Custom>
                  {({
                    account,
                    chain,
                    openAccountModal,
                    openChainModal,
                    openConnectModal,
                    authenticationStatus,
                    mounted,
                  }) => {
                    const ready = mounted && authenticationStatus !== 'loading'
                    const connected =
                      ready &&
                      account &&
                      chain &&
                      (!authenticationStatus ||
                        authenticationStatus === 'authenticated')

                    return (
                      <div
                        {...(!ready && {
                          'aria-hidden': true,
                          style: {
                            opacity: 0,
                            pointerEvents: 'none',
                            userSelect: 'none',
                          },
                        })}
                      >
                        {(() => {
                          if (!connected) {
                            return (
                              <button
                                onClick={openConnectModal}
                                className="btn-primary w-full"
                              >
                                Connect Wallet
                              </button>
                            )
                          }

                          if (chain.unsupported) {
                            return (
                              <button
                                onClick={openChainModal}
                                className="btn-secondary w-full"
                              >
                                Wrong network
                              </button>
                            )
                          }

                          return (
                            <div className="flex flex-col gap-2">
                              <button
                                onClick={openChainModal}
                                className="btn-secondary text-sm w-full"
                              >
                                {chain.name}
                              </button>
                              <button
                                onClick={openAccountModal}
                                className="btn-primary text-sm w-full"
                              >
                                {account.displayName}
                              </button>
                              <AuthButton />
                            </div>
                          )
                        })()}
                      </div>
                    )
                  }}
                </ConnectButton.Custom>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.nav>
  )
}

