/**
 * Authentication Context Provider
 * Manages wallet-based authentication, role assignment, and JWT tokens
 */

'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useAccount, useSignMessage } from 'wagmi'
import { generateSignMessage } from '../../lib/authUtils'

export type Role = 'TRADER' | 'CREATOR'

interface AuthUser {
  wallet: string
  role: Role
}

interface AuthContextType {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  accessToken: string | null
  login: (preferredRole?: Role) => Promise<void>
  logout: () => Promise<void>
  refreshAuth: () => Promise<void>
  checkRole: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Storage keys
const ACCESS_TOKEN_KEY = 'polpump_access_token'
const REFRESH_TOKEN_KEY = 'polpump_refresh_token'
const USER_KEY = 'polpump_user'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { address, isConnected, connector } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const loginInFlightRef = useRef<Promise<void> | null>(null)
  
  const [user, setUser] = useState<AuthUser | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load stored auth state on mount
  useEffect(() => {
    const storedAccessToken = localStorage.getItem(ACCESS_TOKEN_KEY)
    const storedUser = localStorage.getItem(USER_KEY)
    
    if (storedAccessToken && storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser)
        setAccessToken(storedAccessToken)
        setUser(parsedUser)
      } catch (error) {
        console.error('Failed to parse stored user:', error)
        localStorage.removeItem(ACCESS_TOKEN_KEY)
        localStorage.removeItem(REFRESH_TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
      }
    }
    
    setIsLoading(false)
  }, [])

  // Auto-login when wallet connects
  useEffect(() => {
    if (isConnected && address && !user) {
      // Optionally auto-login, or wait for user to click login button
      // For now, we'll wait for explicit login
    }
  }, [isConnected, address, user])

  const login = useCallback(async (preferredRole?: Role) => {
    if (loginInFlightRef.current) {
      return loginInFlightRef.current
    }

    if (!address || !isConnected) {
      throw new Error('Wallet not connected')
    }

    loginInFlightRef.current = (async () => {
      try {
        setIsLoading(true)

        if (!connector || typeof connector.getChainId !== 'function') {
          throw new Error('Wallet connector is not ready. Please reconnect your wallet and try again.')
        }

        // Generate message to sign
        const nonce = Date.now().toString()
        const timestamp = Date.now()
        const message = generateSignMessage(address, 'authenticate', nonce, timestamp)

        // Request signature
        let signature: string
        try {
          signature = await signMessageAsync({ message })
        } catch (error: any) {
          const shouldUseFallback = String(error?.message || '').includes('getChainId is not a function')
          const injectedProvider = (
            globalThis as typeof globalThis & {
              ethereum?: { request?: (args: { method: string; params?: unknown[] }) => Promise<unknown> }
            }
          ).ethereum

          if (!shouldUseFallback || !injectedProvider?.request) {
            throw error
          }

          const fallbackSignature = await injectedProvider.request({
            method: 'personal_sign',
            params: [message, address],
          })

          if (typeof fallbackSignature !== 'string') {
            throw new Error('Wallet did not return a valid signature')
          }

          signature = fallbackSignature
        }

        // Send to backend
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            wallet: address,
            signature,
            message,
            nonce,
            desiredRole: preferredRole || null,
          }),
        })

        const data = await response.json()

        if (!data.success) {
          const authError: any = new Error(data.error || 'Login failed')
          if (data.errorCode) authError.code = data.errorCode
          if (data.roleSelectionRequired) authError.roleSelectionRequired = true
          throw authError
        }

        // Store tokens and user info
        localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken)
        localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken)
        localStorage.setItem(USER_KEY, JSON.stringify({ wallet: data.wallet, role: data.role }))

        setAccessToken(data.accessToken)
        setUser({ wallet: data.wallet, role: data.role })
      } catch (error: any) {
        console.error('Login error:', error)
        throw error
      } finally {
        setIsLoading(false)
      }
    })()

    try {
      await loginInFlightRef.current
    } finally {
      loginInFlightRef.current = null
    }
  }, [address, isConnected, connector, signMessageAsync])

  const logout = useCallback(async () => {
    try {
      // Call logout endpoint
      if (accessToken) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }).catch(() => {
          // Ignore errors - logout should succeed even if API call fails
        })
      }
    } catch (error) {
      console.error('Logout error:', error)
    } finally {
      // Clear local storage
      localStorage.removeItem(ACCESS_TOKEN_KEY)
      localStorage.removeItem(REFRESH_TOKEN_KEY)
      localStorage.removeItem(USER_KEY)
      
      setAccessToken(null)
      setUser(null)
    }
  }, [accessToken])

  const refreshAuth = useCallback(async () => {
    const storedRefreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
    
    if (!storedRefreshToken) {
      throw new Error('No refresh token available')
    }

    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refreshToken: storedRefreshToken,
        }),
      })

      const data = await response.json()

      if (!data.success) {
        throw new Error(data.error || 'Token refresh failed')
      }

      // Update access token
      localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken)
      setAccessToken(data.accessToken)

      // If role changed, update user
      if (data.roleChanged && user) {
        const updatedUser = { ...user, role: data.role }
        localStorage.setItem(USER_KEY, JSON.stringify(updatedUser))
        setUser(updatedUser)
      }
    } catch (error: any) {
      console.error('Refresh error:', error)
      // If refresh fails, logout
      await logout()
      throw error
    }
  }, [user, logout])

  const checkRole = useCallback(async () => {
    if (!accessToken) return

    try {
      const response = await fetch('/api/auth/verify?revalidate=true', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      })

      const data = await response.json()

      if (data.success && data.user) {
        const updatedUser = { wallet: data.user.wallet, role: data.user.role }
        localStorage.setItem(USER_KEY, JSON.stringify(updatedUser))
        setUser(updatedUser)

        // If new token provided, update it
        if (data.accessToken) {
          localStorage.setItem(ACCESS_TOKEN_KEY, data.accessToken)
          setAccessToken(data.accessToken)
        }
      }
    } catch (error) {
      console.error('Role check error:', error)
    }
  }, [accessToken])

  // Periodic role check (every 5 minutes)
  useEffect(() => {
    if (!user || !accessToken) return

    const interval = setInterval(() => {
      checkRole()
    }, 5 * 60 * 1000) // 5 minutes

    return () => clearInterval(interval)
  }, [user, accessToken, checkRole])

  // Auto-refresh token before expiration
  useEffect(() => {
    if (!accessToken) return

    // Refresh token every 10 minutes (access token expires in 15 minutes)
    const interval = setInterval(() => {
      refreshAuth().catch(() => {
        // Ignore errors - will retry on next request
      })
    }, 10 * 60 * 1000) // 10 minutes

    return () => clearInterval(interval)
  }, [accessToken, refreshAuth])

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user && !!accessToken,
    isLoading,
    accessToken,
    login,
    logout,
    refreshAuth,
    checkRole,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
