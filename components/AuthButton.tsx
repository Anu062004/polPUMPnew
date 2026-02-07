/**
 * Authentication Button Component
 * Shows login/logout button based on auth state
 */

'use client'

import React, { useState } from 'react'
import { useAccount } from 'wagmi'
import { useAuth } from '../app/providers/AuthContext'
import { LogIn, LogOut, User, Crown, Shield } from 'lucide-react'

export default function AuthButton() {
  const { address, isConnected } = useAccount()
  const { user, isAuthenticated, isLoading, login, logout } = useAuth()
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  const handleLogin = async () => {
    if (!isConnected) {
      alert('Please connect your wallet first')
      return
    }

    try {
      setIsLoggingIn(true)
      await login()
    } catch (error: any) {
      alert(`Login failed: ${error.message}`)
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error: any) {
      console.error('Logout error:', error)
    }
  }

  if (!isConnected) {
    return null // Wallet not connected - RainbowKit handles this
  }

  if (isLoading || isLoggingIn) {
    return (
      <button
        disabled
        className="px-4 py-2 bg-gray-600 text-white rounded-lg cursor-not-allowed flex items-center gap-2"
      >
        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
        <span>Loading...</span>
      </button>
    )
  }

  if (!isAuthenticated) {
    return (
      <button
        onClick={handleLogin}
        className="px-4 py-2 bg-[#FF4F84] hover:bg-[#FF4F84]/80 text-white rounded-lg transition-colors flex items-center gap-2"
      >
        <LogIn className="w-4 h-4" />
        <span>Login</span>
      </button>
    )
  }

  return (
    <div className="flex items-center gap-3">
      {/* User Info */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-lg">
        {user?.role === 'CREATOR' ? (
          <Crown className="w-4 h-4 text-yellow-500" />
        ) : (
          <Shield className="w-4 h-4 text-[#12D9C8]" />
        )}
        <span className="text-sm text-white">
          {user?.wallet.slice(0, 6)}...{user?.wallet.slice(-4)}
        </span>
        <span className="text-xs text-gray-400">
          {user?.role}
        </span>
      </div>

      {/* Logout Button */}
      <button
        onClick={handleLogout}
        className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center gap-2"
      >
        <LogOut className="w-4 h-4" />
        <span>Logout</span>
      </button>
    </div>
  )
}









