'use client'

import React, { useEffect } from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { Home, Sparkles, Gamepad2, User, Search, Video, Bot } from 'lucide-react'
import { useAccount } from 'wagmi'
import { usePumpAI } from '../providers/PumpAIContext'
import AuthButton from '../../components/AuthButton'
// Using img tag instead of Next Image for better compatibility

export default function PremiumNavbar() {
  const { address } = useAccount()
  const { setMemory } = usePumpAI()

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
                className="rounded-lg neon-glow animate-pulse-slow w-10 h-10 object-cover"
                onError={(e) => {
                  // Fallback if image doesn't exist
                  e.currentTarget.style.display = 'none'
                }}
              />
            </div>
            <span className="font-bold text-xl text-white group-hover:text-gradient-primary transition-all duration-300">
              POL Pump
            </span>
          </Link>

          {/* Navigation Links */}
          <div className="hidden md:flex items-center gap-8">
            <Link
              href="/"
              className="flex items-center gap-2 text-[#E3E4E8] hover:text-white transition-colors duration-300"
            >
              <Home className="w-4 h-4" />
              <span className="font-medium">Home</span>
            </Link>
            <Link
              href="/explore"
              className="flex items-center gap-2 text-[#E3E4E8] hover:text-white transition-colors duration-300"
            >
              <Search className="w-4 h-4" />
              <span className="font-medium">Explore</span>
            </Link>
            <Link
              href="/livestreams"
              className="flex items-center gap-2 text-[#E3E4E8] hover:text-white transition-colors duration-300"
            >
              <Video className="w-4 h-4" />
              <span className="font-medium">Live</span>
            </Link>
            <Link
              href="/ai-chat"
              className="flex items-center gap-2 text-[#E3E4E8] hover:text-white transition-colors duration-300"
            >
              <Bot className="w-4 h-4" />
              <span className="font-medium">Pump AI</span>
            </Link>
            <Link
              href="/gaming"
              className="flex items-center gap-2 text-[#E3E4E8] hover:text-white transition-colors duration-300"
            >
              <Gamepad2 className="w-4 h-4" />
              <span className="font-medium">Gaming</span>
            </Link>
            <Link
              href="/profile"
              className="flex items-center gap-2 text-[#E3E4E8] hover:text-white transition-colors duration-300"
            >
              <User className="w-4 h-4" />
              <span className="font-medium">Profile</span>
            </Link>
            {/* Role-based dashboard links */}
            <Link
              href="/trader"
              className="flex items-center gap-2 text-[#E3E4E8] hover:text-white transition-colors duration-300"
            >
              <span className="font-medium">Trader</span>
            </Link>
            <Link
              href="/creator"
              className="flex items-center gap-2 text-[#E3E4E8] hover:text-white transition-colors duration-300"
            >
              <span className="font-medium">Creator</span>
            </Link>
          </div>

          {/* Wallet Connect */}
          <div className="flex items-center gap-4">
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
      </div>
    </motion.nav>
  )
}

