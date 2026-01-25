'use client'

import React, { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { BrowserProvider } from 'ethers'
import { userProfileManager, UserProfile, TokenCreated } from '../../lib/userProfileManager'
import {
  User,
  Edit3,
  Save,
  X,
  Plus,
  TrendingUp,
  Coins,
  Activity,
  Settings,
  Upload,
  Copy,
  ExternalLink,
  Calendar,
  DollarSign
} from 'lucide-react'

export default function ProfilePage() {
  const { address: userAddress, isConnected } = useAccount()

  // Profile state
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  // Edit form state
  const [editForm, setEditForm] = useState({
    username: '',
    bio: '',
    publicProfile: true,
    showTradingStats: true,
    notifications: true
  })

  // Avatar upload state
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false)

  // Handle client-side mounting
  useEffect(() => {
    setMounted(true)
  }, [])

  // Initialize profile manager and load profile
  useEffect(() => {
    if (mounted && isConnected && userAddress) {
      initializeProfileManager()
    }
  }, [mounted, isConnected, userAddress])

  const initializeProfileManager = async () => {
    if (!userAddress) return

    try {
      const eth = (typeof window !== 'undefined') ? (window as any).ethereum : undefined
      if (!eth) return

      const provider = new BrowserProvider(eth)
      const signer = await provider.getSigner()

      await userProfileManager.initialize(signer)
      await loadProfile()
    } catch (error) {
      console.error('Failed to initialize profile manager:', error)
      setError('Failed to connect to profile system')
    }
  }

  const loadProfile = async () => {
    if (!userAddress) return

    setIsLoading(true)
    setError(null)

    try {
      let userProfile = await userProfileManager.getProfile(userAddress)

      if (!userProfile) {
        // Create new profile
        const result = await userProfileManager.createProfile(userAddress, {
          username: `User_${userAddress.slice(0, 6)}`,
          bio: 'Welcome to POL Pump! 🚀'
        })

        if (result.success && result.profile) {
          userProfile = result.profile
        } else {
          throw new Error(result.error || 'Failed to create profile')
        }
      }

      // Ensure profile has all required fields
      const completeProfile = {
        walletAddress: userProfile.walletAddress,
        username: userProfile.username || `User_${userAddress.slice(0, 6)}`,
        bio: userProfile.bio || 'Welcome to POL Pump! 🚀',
        avatarUrl: userProfile.avatarUrl || null,
        createdAt: userProfile.createdAt || new Date().toISOString(),
        updatedAt: userProfile.updatedAt || new Date().toISOString(),
        tokensCreated: userProfile.tokensCreated || [],
        tradingStats: {
          totalTrades: 0,
          totalVolume: 0,
          tokensHeld: 0,
          favoriteTokens: [],
          lastTradeAt: null,
          ...userProfile.tradingStats
        },
        preferences: {
          theme: 'light',
          notifications: true,
          publicProfile: true,
          showTradingStats: true,
          ...userProfile.preferences
        }
      }

      setProfile(completeProfile)
      setEditForm({
        username: completeProfile.username,
        bio: completeProfile.bio,
        publicProfile: completeProfile.preferences.publicProfile,
        showTradingStats: completeProfile.preferences.showTradingStats,
        notifications: completeProfile.preferences.notifications
      })

      // Enrich from backend / local API: tokens created + trading stats unique to this wallet
      try {
        const backendBase =
          (typeof process !== 'undefined' &&
            (process as any).env &&
            (process as any).env.NEXT_PUBLIC_BACKEND_URL) ||
          'http://localhost:4000'

        // Fetch coins created by this wallet
        let coinsRes: Response | null = null

        // Try dedicated backend first (if running)
        try {
          coinsRes = await fetch(
            `${backendBase}/coins?limit=200&offset=0&sortBy=createdAt&order=DESC`,
            {
              cache: 'no-store',
              // Prevent hanging forever if backend is down
              signal: AbortSignal.timeout(4000)
            }
          ).catch(() => null)
        } catch {
          coinsRes = null
        }

        // Fallback to local Next.js API route
        if (!coinsRes || !coinsRes.ok) {
          coinsRes = await fetch('/api/coins', { cache: 'no-store' }).catch(
            () => null
          )
        }

        if (coinsRes && coinsRes.ok) {
          const coinsData = await coinsRes.json()
          const myCoins = (coinsData.coins || []).filter(
            (c: any) =>
              String(c.creator).toLowerCase() ===
              String(userAddress).toLowerCase()
          )

          const tokensCreated = myCoins.map((c: any) => ({
            tokenAddress: c.tokenAddress || '',
            tokenName: c.name,
            tokenSymbol: c.symbol,
            curveAddress: c.curveAddress || undefined,
            createdAt: new Date(c.createdAt).toISOString(),
            txHash: c.txHash || `local-${Date.now()}`,
            imageUrl:
              c.imageUrl || (c.imageHash ? `/api/image/${c.imageHash}` : undefined),
            description: c.description || undefined
          }))

          // Only update if different
          if (
            JSON.stringify(tokensCreated) !==
            JSON.stringify(completeProfile.tokensCreated)
          ) {
            const updated = { ...completeProfile, tokensCreated }
            setProfile(updated)
            await userProfileManager.updateProfile(userAddress, {
              tokensCreated
            })
          }
        } else {
          console.warn(
            'Profile enrichment: failed to fetch created tokens from backend or local API'
          )
        }

        // Fetch trading history to compute stats (optional backend/indexer)
        const histRes = await fetch(`${backendBase}/trading/history/${userAddress}?limit=500&offset=0`, { cache: 'no-store' }).catch(() => null as any)
        if (histRes && histRes.ok) {
          const hist = await histRes.json()
          const trades = hist.history || []
          const totalTrades = trades.length
          const totalVolume = trades.reduce((acc: number, t: any) => acc + (Number(t.amountOg || 0)), 0)

          console.log(`Profile enrichment: Found ${totalTrades} trades, total volume: ${totalVolume} MATIC for wallet ${userAddress}`)

          const updatedStats = {
            ...completeProfile.tradingStats,
            totalTrades,
            totalVolume,
            // tokensHeld would require per-token balance; keep existing for now
            lastTradeAt: totalTrades > 0 ? new Date(trades[0].timestamp * 1000).toISOString() : completeProfile.tradingStats.lastTradeAt
          }
          const updated = { ...completeProfile, tradingStats: updatedStats }
          setProfile(updated)
          await userProfileManager.updateProfile(userAddress, { tradingStats: updatedStats })
        } else {
          console.warn(`Failed to fetch trading history for ${userAddress}:`, histRes.status, histRes.statusText)
        }

        // Fetch tokens held count
        const tokensHeldRes = await fetch(`${backendBase}/profile/${userAddress}/tokens-held`, { cache: 'no-store' }).catch(() => null as any)
        if (tokensHeldRes && tokensHeldRes.ok) {
          const tokensData = await tokensHeldRes.json()
          const tokensHeld = tokensData.tokensHeld || 0

          console.log(`Profile enrichment: Found ${tokensHeld} tokens held by wallet ${userAddress}`)

          const updatedStats = {
            ...completeProfile.tradingStats,
            tokensHeld
          }
          const updated = { ...completeProfile, tradingStats: updatedStats }
          setProfile(updated)
          await userProfileManager.updateProfile(userAddress, { tradingStats: updatedStats })
        } else {
          console.warn(`Failed to fetch tokens held count for ${userAddress}:`, tokensHeldRes.status, tokensHeldRes.statusText)
        }
      } catch (enrichErr) {
        console.warn('Profile enrichment skipped:', (enrichErr as any)?.message || enrichErr)
      }

      // Merge in lightweight local trading stats captured by the bonding-curve
      // trading service. This works even when the dedicated backend/indexer
      // is not running.
      try {
        if (typeof window !== 'undefined') {
          const key = `trading:${userAddress.toLowerCase()}`
          const raw = window.localStorage.getItem(key)
          if (raw) {
            const local = JSON.parse(raw)
            const localTotalTrades = Number(local.totalTrades || 0)
            const localTotalVolume = Number(local.totalVolume || 0)
            const tokens = Array.isArray(local.tokens) ? local.tokens : []

            const mergedStats = {
              ...completeProfile.tradingStats,
              totalTrades:
                completeProfile.tradingStats.totalTrades || localTotalTrades
                  ? Math.max(
                    completeProfile.tradingStats.totalTrades,
                    localTotalTrades
                  )
                  : localTotalTrades,
              totalVolume:
                completeProfile.tradingStats.totalVolume || localTotalVolume
                  ? Math.max(
                    completeProfile.tradingStats.totalVolume,
                    localTotalVolume
                  )
                  : localTotalVolume,
              tokensHeld:
                completeProfile.tradingStats.tokensHeld ||
                (tokens ? tokens.length : 0),
              lastTradeAt:
                completeProfile.tradingStats.lastTradeAt ||
                (local.lastTradeAt
                  ? new Date(local.lastTradeAt * 1000).toISOString()
                  : undefined)
            }

            const updated = { ...completeProfile, tradingStats: mergedStats }
            setProfile(updated)
          }
        }
      } catch (localErr) {
        console.warn(
          'Failed to merge local trading stats (non-fatal):',
          (localErr as any)?.message || localErr
        )
      }
    } catch (error: any) {
      console.error('Error loading profile:', error)
      setError(error.message || 'Failed to load profile')
    } finally {
      setIsLoading(false)
    }
  }

  const handleEdit = () => {
    setIsEditing(true)
  }

  const handleSave = async () => {
    if (!userAddress || !profile) return

    setIsLoading(true)
    setError(null)

    try {
      // Handle avatar upload if new file selected (with graceful failure handling)
      let avatarUrl = profile.avatarUrl
      let avatarUploadError = null

      if (avatarFile) {
        setIsUploadingAvatar(true)
        try {
          const uploadResult = await userProfileManager.uploadAvatar(avatarFile, userAddress)
          if (uploadResult.success && uploadResult.url) {
            avatarUrl = uploadResult.url
            console.log('✅ Avatar uploaded successfully')
          } else {
            avatarUploadError = uploadResult.error || 'Failed to upload avatar'
            console.warn('⚠️ Avatar upload failed:', avatarUploadError)
          }
        } catch (avatarError) {
          avatarUploadError = avatarError.message || 'Avatar upload failed'
          console.warn('⚠️ Avatar upload error:', avatarError)
        }
        setIsUploadingAvatar(false)
      }

      // Update profile (always attempt this, even if avatar upload failed)
      const result = await userProfileManager.updateProfile(userAddress, {
        username: editForm.username,
        bio: editForm.bio,
        avatarUrl, // Use existing avatar if upload failed
        preferences: {
          theme: 'light',
          notifications: true,
          publicProfile: true,
          showTradingStats: true,
          ...profile.preferences,
          publicProfile: editForm.publicProfile,
          showTradingStats: editForm.showTradingStats,
          notifications: editForm.notifications
        }
      })

      if (result.success && result.profile) {
        setProfile(result.profile)
        setIsEditing(false)
        setAvatarFile(null)

        // Show warning if avatar upload failed but profile was saved
        if (avatarUploadError) {
          setError(`Profile saved successfully, but avatar upload failed: ${avatarUploadError}`)
          // Clear the error after 5 seconds
          setTimeout(() => setError(null), 5000)
        }
      } else {
        throw new Error(result.error || 'Failed to update profile')
      }
    } catch (error: any) {
      console.error('Error saving profile:', error)
      setError(error.message || 'Failed to save profile')
    } finally {
      setIsLoading(false)
      setIsUploadingAvatar(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setAvatarFile(null)
    if (profile) {
      setEditForm({
        username: profile.username || '',
        bio: profile.bio || '',
        publicProfile: profile.preferences.publicProfile,
        showTradingStats: profile.preferences.showTradingStats,
        notifications: profile.preferences.notifications
      })
    }
  }

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Validate file type and size
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file')
        return
      }
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        setError('Image size must be less than 5MB')
        return
      }
      setAvatarFile(file)
      setError(null)
    }
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      })
    } catch {
      return 'Unknown date'
    }
  }

  const shortenAddress = (address: string) => {
    if (!address) return 'N/A'
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const copyToClipboard = (text: string) => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text)
      // You could add a toast notification here
    }
  }

  // Prevent hydration mismatch by not rendering until mounted
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1a0b2e 0%, #16213e 25%, #0f3460 50%, #1a0b2e 100%)' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF4F84]"></div>
      </div>
    )
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1a0b2e 0%, #16213e 25%, #0f3460 50%, #1a0b2e 100%)' }}>
        <div className="text-center glass-card p-12">
          <User className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h2>
          <p className="text-gray-400">Please connect your wallet to view your profile</p>
        </div>
      </div>
    )
  }

  if (isLoading && !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1a0b2e 0%, #16213e 25%, #0f3460 50%, #1a0b2e 100%)' }}>
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF4F84]"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(135deg, #1a0b2e 0%, #16213e 25%, #0f3460 50%, #1a0b2e 100%)' }}>
      <div className="max-w-4xl mx-auto px-4 py-8 pt-24">
        {/* Header */}
        <div className="glass-card mb-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-br from-[#FF4F84] to-[#8C52FF] rounded-full flex items-center justify-center text-white text-2xl font-bold shadow-glow-md">
                {profile?.username?.charAt(0) || 'U'}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {profile?.username || 'User Profile'}
                </h1>
                <p className="text-gray-400 font-mono text-sm">{shortenAddress(userAddress || '')}</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {!isEditing ? (
                <button
                  onClick={handleEdit}
                  className="btn-secondary flex items-center gap-2 !px-4 !py-2"
                >
                  <Edit3 className="w-4 h-4" />
                  <span>Edit Profile</span>
                </button>
              ) : (
                <div className="flex items-center space-x-2">
                  <button
                    onClick={handleSave}
                    disabled={isLoading || isUploadingAvatar}
                    className="btn-success flex items-center gap-2 disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    <span>{isLoading || isUploadingAvatar ? 'Saving...' : 'Save'}</span>
                  </button>
                  <button
                    onClick={handleCancel}
                    className="btn-secondary flex items-center gap-2 !px-4 !py-2"
                  >
                    <X className="w-4 h-4" />
                    <span>Cancel</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="glass-card !border-red-500/50 !bg-red-500/10 p-4 mb-6">
            <div className="text-red-400">{error}</div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Information */}
          <div className="lg:col-span-2 space-y-6">
            {/* Basic Info */}
            <div className="glass-card">
              <h2 className="text-lg font-bold text-white mb-4">Profile Information</h2>

              {isEditing ? (
                <div className="space-y-4">
                  {/* Avatar Upload */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Avatar</label>
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 bg-gradient-to-br from-[#FF4F84] to-[#8C52FF] rounded-full flex items-center justify-center text-white text-xl font-bold">
                        {editForm.username.charAt(0) || 'U'}
                      </div>
                      <div>
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarChange}
                          className="block w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#FF4F84] file:text-white hover:file:opacity-80 cursor-pointer"
                        />
                        {avatarFile && (
                          <p className="text-sm text-green-400 mt-1">
                            Selected: {avatarFile.name}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Username */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Username</label>
                    <input
                      type="text"
                      value={editForm.username}
                      onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                      className="input-glass"
                      placeholder="Enter your username"
                    />
                  </div>

                  {/* Bio */}
                  <div>
                    <label className="block text-sm font-semibold text-gray-300 mb-2">Bio</label>
                    <textarea
                      value={editForm.bio}
                      onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                      rows={3}
                      className="input-glass resize-none"
                      placeholder="Tell us about yourself..."
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Username</label>
                    <p className="text-white">{profile?.username || 'Not set'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Bio</label>
                    <p className="text-white">{profile?.bio || 'No bio available'}</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-1">Member Since</label>
                    <p className="text-white">{profile ? formatDate(profile.createdAt) : 'Unknown'}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Tokens Created */}
            <div className="glass-card">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Tokens Created</h2>
                <span className="px-3 py-1 bg-[#FF4F84]/20 text-[#FF4F84] text-sm font-medium rounded-full border border-[#FF4F84]/30">
                  {profile?.tokensCreated?.length || 0}
                </span>
              </div>

              {profile?.tokensCreated?.length ? (
                <div className="space-y-3">
                  {profile.tokensCreated.map((token, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-colors">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-[#12D9C8] to-[#00D1FF] rounded-full flex items-center justify-center text-white text-sm font-bold">
                          {token.tokenSymbol.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-white">{token.tokenName}</div>
                          <div className="text-sm text-gray-400">{token.tokenSymbol}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-400 mb-1">{formatDate(token.createdAt)}</div>
                        <button
                          onClick={() => copyToClipboard(token.tokenAddress)}
                          className="text-white bg-white/10 hover:bg-white/20 px-2 py-1 rounded-lg text-sm transition-colors flex items-center gap-1"
                        >
                          <Copy className="w-3 h-3" />
                          Copy
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <Coins className="empty-state-icon" />
                  <p className="empty-state-title">No tokens created yet</p>
                  <p className="empty-state-description">Create your first token to get started!</p>
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Trading Stats */}
            {profile?.preferences?.showTradingStats && (
              <div className="glass-card">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                  <TrendingUp className="w-5 h-5 mr-2 text-[#12D9C8]" />
                  Trading Stats
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Trades</span>
                    <span className="font-medium text-white font-mono">{profile?.tradingStats?.totalTrades || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total Volume</span>
                    <span className="font-medium text-[#12D9C8] font-mono">{profile?.tradingStats?.totalVolume || 0} MATIC</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Tokens Held</span>
                    <span className="font-medium text-white font-mono">{profile?.tradingStats?.tokensHeld || 0}</span>
                  </div>
                  {profile?.tradingStats?.lastTradeAt && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">Last Trade</span>
                      <span className="font-medium text-sm text-white">{formatDate(profile.tradingStats.lastTradeAt)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Settings */}
            <div className="glass-card">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <Settings className="w-5 h-5 mr-2 text-gray-400" />
                Settings
              </h3>

              {isEditing ? (
                <div className="space-y-4">
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.publicProfile}
                      onChange={(e) => setEditForm({ ...editForm, publicProfile: e.target.checked })}
                      className="rounded border-white/20 bg-white/10 text-[#FF4F84] focus:ring-[#FF4F84] focus:ring-offset-0"
                    />
                    <span className="ml-2 text-sm text-gray-300">Public Profile</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.showTradingStats}
                      onChange={(e) => setEditForm({ ...editForm, showTradingStats: e.target.checked })}
                      className="rounded border-white/20 bg-white/10 text-[#FF4F84] focus:ring-[#FF4F84] focus:ring-offset-0"
                    />
                    <span className="ml-2 text-sm text-gray-300">Show Trading Stats</span>
                  </label>
                  <label className="flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={editForm.notifications}
                      onChange={(e) => setEditForm({ ...editForm, notifications: e.target.checked })}
                      className="rounded border-white/20 bg-white/10 text-[#FF4F84] focus:ring-[#FF4F84] focus:ring-offset-0"
                    />
                    <span className="ml-2 text-sm text-gray-300">Notifications</span>
                  </label>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Public Profile</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${profile?.preferences.publicProfile
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-white/10 text-gray-400'
                      }`}>
                      {profile?.preferences.publicProfile ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Show Stats</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${profile?.preferences.showTradingStats
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-white/10 text-gray-400'
                      }`}>
                      {profile?.preferences.showTradingStats ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Notifications</span>
                    <span className={`px-2 py-1 text-xs rounded-full ${profile?.preferences.notifications
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-white/10 text-gray-400'
                      }`}>
                      {profile?.preferences.notifications ? 'On' : 'Off'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Wallet Info */}
            <div className="glass-card">
              <h3 className="text-lg font-semibold text-white mb-4">Wallet Information</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Address</label>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm text-white">{shortenAddress(userAddress || '')}</span>
                    <button
                      onClick={() => copyToClipboard(userAddress || '')}
                      className="p-1 text-gray-400 hover:text-white hover:bg-white/10 rounded transition-colors"
                      title="Copy address"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Network</label>
                  <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 text-sm">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                    Polygon Amoy
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
