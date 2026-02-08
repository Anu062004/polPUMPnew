/**
 * Role Guard Component
 * Protects routes based on user role
 */

'use client'

import React, { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../app/providers/AuthContext'
import { useAccount } from 'wagmi'
import { Role } from '../app/providers/AuthContext'

interface RoleGuardProps {
  children: React.ReactNode
  requiredRole?: Role
  redirectTo?: string
  fallback?: React.ReactNode
}

export function RoleGuard({ 
  children, 
  requiredRole, 
  redirectTo = '/',
  fallback 
}: RoleGuardProps) {
  const router = useRouter()
  const { user, isAuthenticated, isLoading, login } = useAuth()
  const { isConnected } = useAccount()

  useEffect(() => {
    if (isLoading) return

    // If wallet not connected, redirect
    if (!isConnected) {
      router.push(redirectTo)
      return
    }

    // If not authenticated, try to login
    if (!isAuthenticated) {
      login().catch(() => {
        router.push(redirectTo)
      })
      return
    }

    // If role required and user doesn't have it, redirect
    if (requiredRole && user?.role !== requiredRole) {
      // Redirect to appropriate dashboard
      if (user?.role === 'CREATOR' && requiredRole === 'TRADER') {
        router.push('/creator')
      } else if (user?.role === 'TRADER' && requiredRole === 'CREATOR') {
        router.push('/trader')
      } else {
        router.push(redirectTo)
      }
    }
  }, [isLoading, isAuthenticated, user, requiredRole, isConnected, router, login, redirectTo])

  if (isLoading) {
    return fallback || (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF4F84]"></div>
          <p className="text-[#E3E4E8] mt-4">Loading...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return fallback || (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-[#E3E4E8]">Authenticating...</p>
        </div>
      </div>
    )
  }

  if (requiredRole && user?.role !== requiredRole) {
    return fallback || null
  }

  return <>{children}</>
}










