'use client'

import React from 'react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Search, Gamepad2, User, Zap, MessageCircle, Video } from 'lucide-react'
import { useAccount } from 'wagmi'

const navItems = [
  { href: '/', icon: Home, label: 'Home' },
  { href: '/explore', icon: Search, label: 'Explore' },
  { href: '/gaming', icon: Gamepad2, label: 'Gaming' },
  { href: '/ai-suggestions', icon: Zap, label: 'Advanced' },
  { href: '/ai-chat', icon: MessageCircle, label: 'Ask PumpAI' },
  { href: '/livestreams', icon: Video, label: 'Livestreams' },
  { href: '/profile', icon: User, label: 'Profile' },
]

export default function PremiumSidebar() {
  const pathname = usePathname()
  const { isConnected, address } = useAccount()

  return (
    <motion.aside
      initial={{ x: -100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="fixed left-0 top-0 h-full w-64 glass border-r border-white/10 p-6 z-40 hidden lg:block"
    >
      <div className="flex flex-col h-full">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 mb-8 group">
          <div className="relative">
            <img
              src="/pump-logo.jpg"
              alt="POL Pump"
              width={40}
              height={40}
              className="rounded-lg neon-glow-teal animate-pulse-slow w-10 h-10 object-cover"
              onError={(e) => {
                e.currentTarget.style.display = 'none'
              }}
            />
          </div>
          <span className="font-bold text-xl text-white group-hover:text-gradient-primary transition-all duration-300">
            POL Pump
          </span>
        </Link>

        {/* Navigation */}
        <nav className="flex-1 space-y-2">
          {navItems.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ${
                  isActive
                    ? 'bg-gradient-to-r from-[#FF4F84]/20 to-[#8C52FF]/20 border border-[#FF4F84]/30 text-white'
                    : 'text-[#E3E4E8] hover:bg-white/5 hover:text-white'
                }`}
              >
                <item.icon
                  className={`w-5 h-5 ${
                    isActive ? 'text-[#12D9C8]' : 'text-[#E3E4E8] group-hover:text-[#12D9C8]'
                  }`}
                />
                <span className="font-medium">{item.label}</span>
              </Link>
            )
          })}
        </nav>

        {/* Wallet Status */}
        {isConnected && address && (
          <div className="mt-auto glass-card p-4 border border-[#12D9C8]/30">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-[#12D9C8] animate-pulse"></div>
              <span className="text-sm font-semibold text-[#12D9C8]">Wallet Connected</span>
            </div>
            <div className="text-xs text-[#E3E4E8] font-mono">
              {address.slice(0, 6)}...{address.slice(-4)}
            </div>
          </div>
        )}
      </div>
    </motion.aside>
  )
}




















