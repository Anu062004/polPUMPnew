'use client'

import React, { useState, useEffect } from 'react'
import { useAccount, usePublicClient } from 'wagmi'
import { ethers } from 'ethers'
import { tokenFactoryService } from '../../lib/tokenFactoryService'
import { bondingCurveTradingService } from '../../lib/bondingCurveTradingService'
import { ogStorageSDK } from '@/lib/0gStorageSDK'
import EnhancedTradingCard from '../components/EnhancedTradingCard'

interface TokenInfo {
  id: string
  name: string
  symbol: string
  supply: string
  description: string
  imageUrl: string
  metadataUrl: string
  createdAt: string
  creator: string
  curveAddress?: string
}

export default function BondingCurvePage() {
  const { address: userAddress, isConnected } = useAccount()
  const publicClient = usePublicClient()

  // State
  const [tokens, setTokens] = useState<TokenInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'created' | 'supply'>('created')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  
  // Initialize services
  useEffect(() => {
    if (publicClient && isConnected) {
      initializeServices()
    }
  }, [publicClient, isConnected])
  
  const initializeServices = async () => {
    try {
      // Convert publicClient to provider for compatibility
      const provider = {
        getSigner: () => null,
        getBalance: (address: string) => publicClient!.getBalance({ address: address as any }),
        // Add other provider methods as needed
      } as any
      
      // Initialize token factory service (factory address will be set when deployed)
      await tokenFactoryService.initialize(provider, '')
      
      // Initialize bonding curve trading service
      await bondingCurveTradingService.initialize(provider)
      
      // Load tokens
      await loadTokens()
    } catch (error) {
      console.error('Failed to initialize services:', error)
      setError('Failed to initialize services')
    }
  }
  
  const loadTokens = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      // Load tokens from local storage
      const localTokens = await ogStorageSDK.getAllCoins()
      
      // For each token, try to get curve information
      const tokensWithCurves = await Promise.all(
        localTokens.map(async (token: any) => {
          try {
            // Try to get curve address from factory
            const curveAddress = await tokenFactoryService.getCurveForToken(token.id)
            
            return {
              ...token,
              curveAddress: curveAddress || undefined
            }
          } catch (error) {
            console.warn(`Could not get curve for token ${token.id}:`, error)
            return {
              ...token,
              curveAddress: undefined
            }
          }
        })
      )
      
      setTokens(tokensWithCurves)
    } catch (error) {
      console.error('Failed to load tokens:', error)
      setError('Failed to load tokens')
    } finally {
      setIsLoading(false)
    }
  }
  
  // Filter and sort tokens
  const filteredAndSortedTokens = tokens
    .filter(token => 
      token.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
      token.description.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      let comparison = 0
      
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name)
          break
        case 'created':
          comparison = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          break
        case 'supply':
          comparison = parseFloat(a.supply) - parseFloat(b.supply)
          break
      }
      
      return sortOrder === 'asc' ? comparison : -comparison
    })
  
  // Handle token selection
  const handleTokenSelect = (token: TokenInfo) => {
    setSelectedToken(token)
  }
  
  // Handle refresh
  const handleRefresh = async () => {
    await loadTokens()
  }
  
  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }
  
  // Format supply
  const formatSupply = (supply: string) => {
    const numSupply = parseFloat(supply)
    if (numSupply >= 1000000) {
      return `${(numSupply / 1000000).toFixed(1)}M`
    } else if (numSupply >= 1000) {
      return `${(numSupply / 1000).toFixed(1)}K`
    } else {
      return numSupply.toString()
    }
  }
  
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading bonding curve tokens...</p>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Tokens</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
        {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Bonding Curve Trading</h1>
              <p className="text-sm text-gray-600">Trade tokens on automated bonding curves</p>
            </div>
            <div className="flex items-center space-x-4">
            <button
                onClick={handleRefresh}
                className="bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600 transition-colors flex items-center space-x-2"
            >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Refresh</span>
            </button>
            </div>
              </div>
            </div>
          </div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Token List */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm border">
              {/* Search and Filters */}
              <div className="p-4 border-b">
                <div className="mb-4">
                  <input
                    type="text"
                    placeholder="Search tokens..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div className="flex space-x-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as any)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="created">Created Date</option>
                    <option value="name">Name</option>
                    <option value="supply">Supply</option>
                  </select>
                  
                <button
                    onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                    className="px-3 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                >
                    {sortOrder === 'asc' ? '↑' : '↓'}
                </button>
              </div>
            </div>

              {/* Token List */}
              <div className="max-h-96 overflow-y-auto">
                {filteredAndSortedTokens.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">
                    {searchTerm ? 'No tokens match your search' : 'No tokens found'}
                  </div>
                ) : (
                  filteredAndSortedTokens.map((token) => (
                    <div
                      key={token.id}
                      onClick={() => handleTokenSelect(token)}
                      className={`p-4 border-b cursor-pointer transition-colors hover:bg-gray-50 ${
                        selectedToken?.id === token.id ? 'bg-blue-50 border-blue-200' : ''
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                          {token.symbol.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-2">
                            <h3 className="text-sm font-medium text-gray-900 truncate">
                              {token.name}
                            </h3>
                            <span className="text-xs text-gray-500">({token.symbol})</span>
                          </div>
                          <p className="text-xs text-gray-500 truncate">{token.description}</p>
                          <div className="flex items-center space-x-4 mt-1">
                            <span className="text-xs text-gray-500">
                              Supply: {formatSupply(token.supply)}
                            </span>
                            <span className="text-xs text-gray-500">
                              {formatDate(token.createdAt)}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-col items-end">
                          {token.curveAddress ? (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              No Curve
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
          
          {/* Trading Interface */}
          <div className="lg:col-span-2">
            {selectedToken ? (
              <EnhancedTradingCard
                tokenAddress={selectedToken.id}
                tokenName={selectedToken.name}
                tokenSymbol={selectedToken.symbol}
                description={selectedToken.description}
                imageUrl={selectedToken.imageUrl}
                metadataUrl={selectedToken.metadataUrl}
                creator={selectedToken.creator}
                createdAt={selectedToken.createdAt}
              />
            ) : (
              <div className="bg-white rounded-lg shadow-sm border p-8 text-center">
                <div className="text-gray-400 text-6xl mb-4">📊</div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select a Token</h3>
                <p className="text-gray-600">
                  Choose a token from the list to view its bonding curve and start trading
                </p>
              </div>
            )}
          </div>
        </div>
        
        {/* Stats */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="text-sm text-gray-600 font-medium">Total Tokens</div>
            <div className="text-2xl font-bold text-gray-900">{tokens.length}</div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="text-sm text-gray-600 font-medium">Active Curves</div>
            <div className="text-2xl font-bold text-green-600">
              {tokens.filter(t => t.curveAddress).length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="text-sm text-gray-600 font-medium">No Curves</div>
            <div className="text-2xl font-bold text-gray-600">
              {tokens.filter(t => !t.curveAddress).length}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm border p-4">
            <div className="text-sm text-gray-600 font-medium">Connected</div>
            <div className="text-2xl font-bold text-blue-600">
              {isConnected ? 'Yes' : 'No'}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
