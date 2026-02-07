'use client'

import React, { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { BrowserProvider, Contract } from 'ethers'
import { useAccount } from 'wagmi'
import { Info, TrendingUp, TrendingDown, Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { newBondingCurveTradingService } from '../../lib/newBondingCurveTradingService'
import { usePumpAI } from '../providers/PumpAIContext'

interface EnhancedTradingCardProps {
  tokenAddress: string
  tokenName: string
  tokenSymbol: string
  description?: string
  imageUrl?: string
  metadataUrl?: string
  creator: string
  createdAt: string
  supply: string
  curveAddress?: string
}

export default function EnhancedTradingCard({
  tokenAddress,
  tokenName,
  tokenSymbol,
  description,
  imageUrl,
  metadataUrl,
  creator,
  createdAt,
  supply,
  curveAddress
}: EnhancedTradingCardProps) {
  const { address: userAddress, isConnected } = useAccount()
  const [provider, setProvider] = useState<BrowserProvider | null>(null)
  const [curveAddressState, setCurveAddressState] = useState<string | null>(curveAddress || null)
  const [curveInfo, setCurveInfo] = useState<any>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy')
  const [tradeAmount, setTradeAmount] = useState('')
  const [buyQuote, setBuyQuote] = useState<any>(null)
  const [sellQuote, setSellQuote] = useState<any>(null)
  const [slippageTolerance, setSlippageTolerance] = useState(0.05)
  const [isTrading, setIsTrading] = useState(false)
  const [userTokenBalance, setUserTokenBalance] = useState('0')
  const [userNativeBalance, setUserNativeBalance] = useState('0')
  const [showInfoModal, setShowInfoModal] = useState(false)
  const [tradeSuccess, setTradeSuccess] = useState<string | null>(null)
  const { setMemory } = usePumpAI()

  // Initialize services and resolve curve address
  useEffect(() => {
    (async () => {
      try {
        if (tokenAddress && tokenAddress !== '' && tokenAddress !== 'undefined') {
          let resolvedCurveAddress = curveAddress
          
          if (!resolvedCurveAddress || resolvedCurveAddress === '' || resolvedCurveAddress === 'undefined') {
            console.log('🔍 Resolving curve address for token:', tokenAddress)
            // Try multiple times with delays - Polygon indexing can be slow
            let found = false
            for (let attempt = 0; attempt < 5; attempt++) {
              if (attempt > 0) {
                await new Promise(r => setTimeout(r, 2000 * attempt)) // 2s, 4s, 6s, 8s
              }
              
              try {
                const res = await fetch(`/api/token/curve?tokenAddress=${tokenAddress}`)
                const data = await res.json()
                
                if (data.success && data.curveAddress) {
                  console.log('✅ Found curve address:', data.curveAddress)
                  resolvedCurveAddress = data.curveAddress
                  found = true
                  break
                }
              } catch (e) {
                console.warn(`Resolve attempt ${attempt + 1} failed:`, e)
              }
            }
            
            if (!found) {
              console.warn('⚠️ Could not resolve curve address after multiple attempts')
              setError('Curve address not found. This token may not have been created with the factory.')
              setCurveAddressState(null)
              setIsLoading(false)
              return
            }
          }
          
          setCurveAddressState(resolvedCurveAddress)
          
          if (isConnected) {
            const eth = (typeof window !== 'undefined') ? (window as any).ethereum : undefined
            if (eth) {
              const ethersProvider = new BrowserProvider(eth)
              setProvider(ethersProvider)
              await newBondingCurveTradingService.initialize(ethersProvider)
              await loadCurveInfo(resolvedCurveAddress!)
              await updateBalances()
            }
          } else {
            try {
              const isMainnet = process.env.NEXT_PUBLIC_NETWORK === 'polygon'
              const rpcUrl = process.env.NEXT_PUBLIC_EVM_RPC || 
                             (isMainnet 
                               ? 'https://polygon-mainnet.infura.io/v3/2a16fc884a10441eae11c29cd9b9aa5f'
                               : 'https://polygon-amoy.infura.io/v3/b4f237515b084d4bad4e5de070b0452f')
              const readProvider = new ethers.JsonRpcProvider(rpcUrl)
              const curveInfo = await newBondingCurveTradingService.getCurveInfo(resolvedCurveAddress!, readProvider)
              if (curveInfo) {
                setCurveInfo(curveInfo)
              }
            } catch (e) {
              console.warn('Could not load curve info without wallet:', e)
            }
          }
        }
      } catch (error) {
        console.error('Failed to initialize services:', error)
        setError('Failed to initialize trading service. Please refresh the page.')
      } finally {
        setIsLoading(false)
      }
    })()
  }, [isConnected, tokenAddress, curveAddress])
  
  const loadCurveInfo = async (curveAddr: string) => {
    if (!provider && !isConnected) return
    
    setIsLoading(true)
    setError(null)
    
    try {
      const info = await newBondingCurveTradingService.getCurveInfo(curveAddr)
      if (info) {
        setCurveInfo(info)
      } else {
        setError('Could not load curve information')
        setCurveInfo(null)
      }
    } catch (error: any) {
      console.warn('Could not load curve info:', error)
      setError(error.message || 'Failed to load curve info')
      setCurveInfo(null)
    } finally {
      setIsLoading(false)
    }
  }
  
  useEffect(() => {
    if (userAddress && curveAddressState && provider) {
      updateBalances()
    }
  }, [userAddress, curveAddressState, provider])
  
  const updateBalances = async () => {
    if (!userAddress || !curveAddressState || !provider) return
    
    try {
      const curveInfo = await newBondingCurveTradingService.getCurveInfo(curveAddressState)
      if (!curveInfo) return
      
      const [tokenBalance, nativeBalance] = await Promise.all([
        newBondingCurveTradingService.getTokenBalance(curveInfo.tokenAddress, userAddress),
        newBondingCurveTradingService.getNativeBalance(userAddress)
      ])
      
      setUserTokenBalance(tokenBalance)
      setUserNativeBalance(nativeBalance)
    } catch (error) {
      console.error('Error updating balances:', error)
    }
  }

  const handleTradeAmountChange = async (amount: string) => {
    setTradeAmount(amount)
    setBuyQuote(null)
    setSellQuote(null)
    
    if (!amount || parseFloat(amount) <= 0 || !curveAddressState) {
      return
    }
      
    try {
      if (tradeType === 'buy') {
        const quote = await newBondingCurveTradingService.getBuyQuote(curveAddressState, amount)
        setBuyQuote(quote)
      } else {
        const quote = await newBondingCurveTradingService.getSellQuote(curveAddressState, amount)
        setSellQuote(quote)
      }
    } catch (error) {
      console.error('Error getting quote:', error)
    }
  }

  const handleTrade = async () => {
    if (!isConnected) {
      setError('Please connect your wallet to trade')
      return
    }
    
    if (!tradeAmount || parseFloat(tradeAmount) <= 0) {
      setError('Please enter a valid trade amount')
      return
    }
    
    if (!curveAddressState) {
      setError('Trading unavailable: curve address not found')
      return
    }
    
    if (!provider) {
      setError('Wallet provider not initialized. Please refresh the page.')
      return
    }
    
    setIsTrading(true)
    setError(null)
    setTradeSuccess(null)
    
    try {
      if (!(newBondingCurveTradingService as any).signer) {
        await newBondingCurveTradingService.initialize(provider)
      }
      
      let result
      
      if (tradeType === 'buy') {
        if (!buyQuote) {
          const quote = await newBondingCurveTradingService.getBuyQuote(curveAddressState, tradeAmount)
          if (!quote) {
            throw new Error('Failed to get buy quote')
          }
          setBuyQuote(quote)
          const minTokensOut = (parseFloat(quote.outputAmount) * (1 - slippageTolerance)).toString()
          result = await newBondingCurveTradingService.buyTokens(curveAddressState, tradeAmount, minTokensOut)
        } else {
          const minTokensOut = (parseFloat(buyQuote.outputAmount) * (1 - slippageTolerance)).toString()
          result = await newBondingCurveTradingService.buyTokens(curveAddressState, tradeAmount, minTokensOut)
        }
      } else {
        if (!sellQuote) {
          const quote = await newBondingCurveTradingService.getSellQuote(curveAddressState, tradeAmount)
          if (!quote) {
            throw new Error('Failed to get sell quote')
          }
          setSellQuote(quote)
          const minOgOut = (parseFloat(quote.outputAmount) * (1 - slippageTolerance)).toString()
          result = await newBondingCurveTradingService.sellTokens(curveAddressState, tradeAmount, minOgOut)
        } else {
          const minOgOut = (parseFloat(sellQuote.outputAmount) * (1 - slippageTolerance)).toString()
          result = await newBondingCurveTradingService.sellTokens(curveAddressState, tradeAmount, minOgOut)
        }
      }
      
      if (result.success) {
        setTradeAmount('')
        setBuyQuote(null)
        setSellQuote(null)
        await updateBalances()
        await loadCurveInfo(curveAddressState)
        const shortHash = result.txHash ? `${result.txHash.slice(0, 6)}...${result.txHash.slice(-4)}` : 'N/A'
        setTradeSuccess(`Trade successful! TX: ${shortHash}`)
        setTimeout(() => setTradeSuccess(null), 5000)

        // Update Pump AI memory with last trade action
        setMemory({
          lastAction: tradeType
        })
      } else {
        setError(result.error || 'Trade failed')
      }
    } catch (error: any) {
      console.error('Trade execution failed:', error)
      setError(error.message || 'Unknown error occurred')
    } finally {
      setIsTrading(false)
    }
  }

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance)
    if (isNaN(num)) return '0.00'
    return num.toFixed(6)
  }

  const shortenAddress = (address: string) => {
    if (!address) return 'N/A'
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
    } catch {
      return 'Unknown date'
    }
  }

  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-48 bg-gray-200 rounded-lg"></div>
      </div>
    )
  }

  return (
    <>
      {/* Modern Sleek Card Design */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 border border-purple-500/20 shadow-2xl backdrop-blur-xl">
        {/* Animated Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-cyan-500/10 animate-pulse"></div>
        
        <div className="relative z-10 p-8 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                {tokenSymbol.charAt(0)}
              </div>
              <div>
                <h2 className="text-3xl font-bold text-white mb-1">{tokenName}</h2>
                <p className="text-purple-300 text-sm">{tokenSymbol}</p>
              </div>
            </div>
            {curveInfo && (
              <div className="text-right">
                <div className="text-xs text-purple-400 mb-1">Price</div>
                <div className="text-2xl font-bold text-white">
                  {parseFloat(curveInfo.currentPrice).toFixed(6)} <span className="text-sm text-purple-300">MATIC</span>
                </div>
              </div>
            )}
          </div>

          {/* Price Stats Card */}
          {curveInfo && (
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-xs text-purple-400 mb-1">MATIC Reserve</div>
                  <div className="text-lg font-bold text-white">{parseFloat(curveInfo.ogReserve).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-purple-400 mb-1">Token Reserve</div>
                  <div className="text-lg font-bold text-white">{parseFloat(curveInfo.tokenReserve).toFixed(2)}</div>
                </div>
                <div>
                  <div className="text-xs text-purple-400 mb-1">Fee</div>
                  <div className="text-lg font-bold text-white">{curveInfo.feeBps / 100}%</div>
                </div>
              </div>
            </div>
          )}

          {/* Curve Status Warning */}
          {curveInfo && !curveInfo.seeded && (
            <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-4 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
              <div>
                <div className="text-yellow-300 font-semibold">Bonding Curve Initializing</div>
                <div className="text-yellow-400/80 text-sm">The bonding curve is being set up. Trading will be available shortly.</div>
              </div>
            </div>
          )}

          {/* No Curve Address Message */}
          {!curveAddressState && !isLoading && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 flex items-center gap-3">
              <XCircle className="w-5 h-5 text-red-400" />
              <div>
                <div className="text-red-300 font-semibold">Bonding Curve Not Found</div>
                <div className="text-red-400/80 text-sm">This token was not created with the bonding curve factory. Trading is unavailable.</div>
              </div>
            </div>
          )}

          {/* Trading Interface */}
          {isConnected && curveAddressState && curveInfo?.seeded ? (
            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 space-y-4">
              {/* Trade Type Toggle */}
              <div className="flex gap-2 bg-white/5 rounded-xl p-1">
                <button
                  onClick={() => {
                    setTradeType('buy')
                    setBuyQuote(null)
                    setSellQuote(null)
                  }}
                  className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                    tradeType === 'buy'
                      ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white shadow-lg'
                      : 'text-purple-300 hover:text-white'
                  }`}
                >
                  <TrendingUp className="w-4 h-4 inline mr-2" />
                  Buy
                </button>
                <button
                  onClick={() => {
                    setTradeType('sell')
                    setBuyQuote(null)
                    setSellQuote(null)
                  }}
                  className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                    tradeType === 'sell'
                      ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-lg'
                      : 'text-purple-300 hover:text-white'
                  }`}
                >
                  <TrendingDown className="w-4 h-4 inline mr-2" />
                  Sell
                </button>
              </div>

              {/* Amount Input */}
              <div>
                <label className="block text-sm text-purple-300 mb-2">
                  {tradeType === 'buy' ? 'MATIC Amount' : 'Token Amount'}
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={tradeAmount}
                    onChange={(e) => handleTradeAmountChange(e.target.value)}
                    placeholder="0.0"
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-purple-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    step="0.1"
                    min="0"
                    disabled={isTrading}
                  />
                  {tradeAmount && (buyQuote || sellQuote) && (
                    <div className="mt-2 text-sm text-purple-300">
                      You'll receive: <span className="text-white font-semibold">
                        {tradeType === 'buy' 
                          ? `${formatBalance(buyQuote?.outputAmount || '0')} ${tokenSymbol}`
                          : `${formatBalance(sellQuote?.outputAmount || '0')} MATIC`
                        }
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Slippage */}
              <div>
                <label className="block text-sm text-purple-300 mb-2">
                  Slippage: {(slippageTolerance * 100).toFixed(1)}%
                </label>
                <input
                  type="range"
                  min="0.01"
                  max="0.20"
                  step="0.01"
                  value={slippageTolerance}
                  onChange={(e) => setSlippageTolerance(parseFloat(e.target.value))}
                  className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  disabled={isTrading}
                />
              </div>

              {/* Trade Button */}
              <button
                onClick={handleTrade}
                disabled={isTrading || !tradeAmount || parseFloat(tradeAmount) <= 0}
                className={`w-full py-4 rounded-xl font-bold text-white transition-all ${
                  isTrading || !tradeAmount || parseFloat(tradeAmount) <= 0
                    ? 'bg-gray-600 cursor-not-allowed'
                    : tradeType === 'buy'
                    ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-lg hover:shadow-xl transform hover:scale-[1.02]'
                    : 'bg-gradient-to-r from-red-500 to-rose-500 hover:from-red-600 hover:to-rose-600 shadow-lg hover:shadow-xl transform hover:scale-[1.02]'
                }`}
              >
                {isTrading ? (
                  <span className="flex items-center justify-center">
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Processing...
                  </span>
                ) : (
                  `${tradeType === 'buy' ? 'Buy' : 'Sell'} ${tokenSymbol}`
                )}
              </button>

              {/* Balances */}
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/10">
                <div>
                  <div className="text-xs text-purple-400 mb-1">Your {tokenSymbol}</div>
                  <div className="text-lg font-bold text-white">{formatBalance(userTokenBalance)}</div>
                </div>
                <div>
                  <div className="text-xs text-purple-400 mb-1">Your MATIC</div>
                  <div className="text-lg font-bold text-white">{formatBalance(userNativeBalance)}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-purple-300">
              {!isConnected ? (
                <div>
                  <AlertCircle className="w-12 h-12 mx-auto mb-4 text-purple-400" />
                  <p>Connect your wallet to start trading</p>
                </div>
              ) : (
                <div>
                  <XCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
                  <p className="mb-2">Trading unavailable</p>
                  <p className="text-sm text-purple-400">{error || 'Curve address not found'}</p>
                </div>
              )}
            </div>
          )}

          {/* Success/Error Messages */}
          {tradeSuccess && (
            <div className="bg-green-500/20 border border-green-500/50 rounded-xl p-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-green-400" />
              <span className="text-green-300">{tradeSuccess}</span>
            </div>
          )}
          {error && (
            <div className="bg-red-500/20 border border-red-500/50 rounded-xl p-4 flex items-center gap-3">
              <XCircle className="w-5 h-5 text-red-400" />
              <span className="text-red-300">{error}</span>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
