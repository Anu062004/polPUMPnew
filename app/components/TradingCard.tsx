'use client'

import React, { useState, useEffect } from 'react'
import { ethers } from 'ethers'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { TrendingUp, TrendingDown, BarChart3, AlertCircle, CheckCircle } from 'lucide-react'
import { CoinData } from '../../lib/0gStorage'
import { blockchainTradingService, MarketData } from '../../lib/blockchainTradingService'
import { newBondingCurveTradingService } from '../../lib/newBondingCurveTradingService'
import CoinImage from './CoinImage'
import { useAccount } from 'wagmi'
import { BrowserProvider } from 'ethers'
import PriceChart from './PriceChart'

interface TradingCardProps {
  coin: CoinData & {
    tokenAddress?: string
    telegramUrl?: string
    xUrl?: string
    discordUrl?: string
    websiteUrl?: string
  }
  onTrade?: (coin: CoinData, action: 'buy' | 'sell', amount: string) => void
  onClick?: () => void
}

export default function TradingCard({ coin, onTrade, onClick }: TradingCardProps) {
  const { address, isConnected } = useAccount()
  const [displayCoin, setDisplayCoin] = useState(coin)
  const [tradeAmount, setTradeAmount] = useState('')
  const [isTrading, setIsTrading] = useState(false)
  const [tradeAction, setTradeAction] = useState<'buy' | 'sell' | null>(null)
  const [marketData, setMarketData] = useState<MarketData | null>(null)
  // This flag used to mean "DEX (Uniswap) liquidity only". We now treat either
  // a bonding curve OR a DEX pool as enabling trading.
  const [hasDexLiquidity, setHasDexLiquidity] = useState(false)
  const [userBalance, setUserBalance] = useState('0')
  const [ethBalance, setEthBalance] = useState('0')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showAddLiquidity, setShowAddLiquidity] = useState(false)
  const [liqTokenAmount, setLiqTokenAmount] = useState('')
  const [liqEthAmount, setLiqEthAmount] = useState('')
  const [isAddingLiquidity, setIsAddingLiquidity] = useState(false)
  
  // Bonding curve trading state
  const [curveAddress, setCurveAddress] = useState<string | null>(null)
  const [curveInfo, setCurveInfo] = useState<any>(null)
  const [buyQuote, setBuyQuote] = useState<any>(null)
  const [sellQuote, setSellQuote] = useState<any>(null)
  const [slippageTolerance] = useState(0.05) // 5%
  
  // Price history for chart
  const [priceHistory, setPriceHistory] = useState<Array<{ timestamp: number; priceUsd: number }>>([])
  const [showChart, setShowChart] = useState(false)

  // Derived flag: trading is enabled if either a bonding curve exists or a DEX pool exists
  const tradingEnabled = !!curveAddress || hasDexLiquidity

  // Neo-brutalism utility classes
  const cardBase =
    'bg-sky-100 text-slate-900 rounded-xl p-6 border-4 border-black cursor-pointer shadow-[6px_6px_0_#000] hover:shadow-[8px_8px_0_#000] transition-transform duration-200 hover:-translate-x-1 hover:-translate-y-1'
  const neoInput =
    'flex-1 bg-white text-slate-900 border-4 border-black rounded-lg shadow-[4px_4px_0_#000] focus:outline-none focus:ring-0 focus:border-black placeholder:text-slate-500 active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_#000]'
  const neoButton =
    'border-4 border-black rounded-lg shadow-[6px_6px_0_#000] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-[3px_3px_0_#000] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[3px_3px_0_#000] transition-all'
  const neoButtonSecondary =
    'bg-white hover:bg-slate-100 text-slate-900 '+neoButton

  // Load market data and check liquidity
  useEffect(() => {
    // Restore cached data for snappy UI
    if (coin.tokenAddress) {
      try {
        const mdRaw = localStorage.getItem(`md:${coin.tokenAddress}`)
        if (mdRaw) setMarketData(JSON.parse(mdRaw))
        if (address) {
          const balRaw = localStorage.getItem(`bal:${coin.tokenAddress}:${address}`)
          if (balRaw) {
            const bal = JSON.parse(balRaw)
            setUserBalance(bal.token || '0')
            setEthBalance(bal.eth || '0')
          }
        }
      } catch {}
    }
    // Initialize services
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      if (isConnected) {
        const provider = new BrowserProvider((window as any).ethereum)
        blockchainTradingService.initialize(provider as any)
        newBondingCurveTradingService.initialize(provider)
      }
    }

    if (coin.tokenAddress) {
      // Resolve curve address
      resolveCurveAddress()
      loadMarketData()
      checkLiquidity()
      if (isConnected) {
        loadUserBalances()
      }
      // Load price history from localStorage
      loadPriceHistory()
    }
  }, [coin.tokenAddress, isConnected, address])
  
  // Price history tracking
  useEffect(() => {
    if (!coin.tokenAddress || !marketData) return
    
    const interval = setInterval(() => {
      if (marketData.currentPrice > 0) {
        addPricePoint(marketData.currentPrice)
      }
    }, 15000) // Every 15 seconds
    
    return () => clearInterval(interval)
  }, [coin.tokenAddress, marketData])
  
  const resolveCurveAddress = async () => {
    if (!coin.tokenAddress) return
    
    // Check if we already have curve address in coin data
    if ((coin as any).curveAddress) {
      setCurveAddress((coin as any).curveAddress)
      loadCurveInfo((coin as any).curveAddress)
      return
    }
    
    // Try to resolve from API
    try {
      const res = await fetch(`/api/token/curve?tokenAddress=${coin.tokenAddress}`)
      const data = await res.json()
      if (data.success && data.curveAddress) {
        setCurveAddress(data.curveAddress)
        loadCurveInfo(data.curveAddress)
      }
    } catch (e) {
      console.warn('Failed to resolve curve address:', e)
    }
  }
  
  const loadCurveInfo = async (curveAddr: string) => {
    try {
      const info = await newBondingCurveTradingService.getCurveInfo(curveAddr)
      setCurveInfo(info)
    } catch (e) {
      console.warn('Failed to load curve info:', e)
    }
  }
  
  const loadPriceHistory = () => {
    if (!coin.tokenAddress) return
    try {
      const stored = localStorage.getItem(`ph:${coin.tokenAddress}`)
      if (stored) {
        const history = JSON.parse(stored)
        // Keep only last 100 points
        const recent = history.slice(-100)
        setPriceHistory(recent)
      }
    } catch (e) {
      // Ignore
    }
  }
  
  const addPricePoint = (price: number) => {
    if (!coin.tokenAddress || !price || isNaN(price)) return
    
    const point = {
      timestamp: Date.now(),
      priceUsd: price
    }
    
    setPriceHistory(prev => {
      const updated = [...prev, point].slice(-100) // Keep last 100
      try {
        localStorage.setItem(`ph:${coin.tokenAddress}`, JSON.stringify(updated))
      } catch (e) {
        // Ignore storage errors
      }
      return updated
    })
  }

  // Load on-chain metadata for display, prefer on-chain over stored
  useEffect(() => {
    const loadChainInfo = async () => {
      try {
        if (!coin.tokenAddress) return
        // Try cache first
        try {
          const cached = localStorage.getItem(`ti:${coin.tokenAddress}`)
          if (cached) setDisplayCoin(prev => ({ ...prev, ...JSON.parse(cached) }) as any)
        } catch {}
        const info = await blockchainTradingService.getTokenInfo(coin.tokenAddress)
        setDisplayCoin(prev => ({
          ...prev,
          name: info.name || prev.name,
          symbol: info.symbol || prev.symbol,
          description: info.description || prev.description,
          creator: (info.creator || prev.creator || '').toString(),
          createdAt: info.createdAt ? new Date(info.createdAt * 1000).toISOString() : (prev as any).createdAt,
          imageHash: (info.imageRootHash as any) || (prev as any).imageHash,
          imageRootHash: (info.imageRootHash as any) || (prev as any).imageRootHash,
          metadataRootHash: (info.metadataRootHash as any) || (prev as any).metadataRootHash
        }) as any)
        try {
          localStorage.setItem(`ti:${coin.tokenAddress}` , JSON.stringify({
            name: info.name,
            symbol: info.symbol,
            description: info.description,
            creator: (info.creator || '').toString(),
            createdAt: info.createdAt ? new Date(info.createdAt * 1000).toISOString() : undefined,
            imageHash: info.imageRootHash,
            imageRootHash: info.imageRootHash,
            metadataRootHash: info.metadataRootHash
          }))
        } catch {}
      } catch (e) {
        console.warn('Failed to load on-chain token info:', e)
      }
    }
    loadChainInfo()
  }, [coin.tokenAddress])

  const loadMarketData = async () => {
    try {
      if (coin.tokenAddress) {
        const data = await blockchainTradingService.getMarketData(coin.tokenAddress)
        setMarketData(data)
        try { localStorage.setItem(`md:${coin.tokenAddress}`, JSON.stringify(data)) } catch {}
      }
    } catch (error) {
      console.error('Failed to load market data:', error)
    }
  }

  const handleAddLiquidity = async () => {
    if (!coin.tokenAddress) {
      setError('Token address not available')
      return
    }
    if (!liqTokenAmount || !liqEthAmount) {
      setError('Enter token and ETH amounts')
      return
    }

    setIsAddingLiquidity(true)
    setError(null)
    setSuccess(null)
    try {
      const txHash = await blockchainTradingService.addLiquidity(
        coin.tokenAddress,
        liqEthAmount,
        liqTokenAmount
      )
      setSuccess(`Liquidity added! TX: ${txHash.slice(0, 10)}...`)
      setShowAddLiquidity(false)
      setLiqTokenAmount('')
      setLiqEthAmount('')
      await checkLiquidity()
      await loadMarketData()
    } catch (e: any) {
      console.error('Add liquidity failed:', e)
      setError(e?.message || 'Failed to add liquidity')
    } finally {
      setIsAddingLiquidity(false)
    }
  }

  const checkLiquidity = async () => {
    try {
      if (coin.tokenAddress) {
        const hasPool = await blockchainTradingService.hasLiquidityPool(coin.tokenAddress)
        setHasDexLiquidity(hasPool)
      }
    } catch (error) {
      console.error('Failed to check liquidity:', error)
    }
  }

  const loadUserBalances = async () => {
    try {
      if (coin.tokenAddress && address) {
        // Try bonding curve service first (for tokens with curves)
        if (curveAddress) {
          try {
            const curveInfo = await newBondingCurveTradingService.getCurveInfo(curveAddress)
            if (curveInfo && curveInfo.tokenAddress) {
              const [tokenBalance, nativeBalance] = await Promise.all([
                newBondingCurveTradingService.getTokenBalance(curveInfo.tokenAddress, address),
                newBondingCurveTradingService.getNativeBalance(address)
              ])
              setUserBalance(tokenBalance)
              setEthBalance(nativeBalance)
              try { localStorage.setItem(`bal:${coin.tokenAddress}:${address}`, JSON.stringify({ token: tokenBalance, eth: nativeBalance })) } catch {}
              return
            }
          } catch (e) {
            console.warn('Failed to load balances from curve service:', e)
          }
        }
        
        // Fallback to blockchain trading service
        const tokenBalance = await blockchainTradingService.getTokenBalance(coin.tokenAddress, address)
        const ethBalance = await blockchainTradingService.getETHBalance(address)
        setUserBalance(tokenBalance)
        setEthBalance(ethBalance)
        try { localStorage.setItem(`bal:${coin.tokenAddress}:${address}`, JSON.stringify({ token: tokenBalance, eth: ethBalance })) } catch {}
      }
    } catch (error) {
      console.error('Failed to load balances:', error)
    }
  }

  // Update quotes when trade amount changes
  useEffect(() => {
    if (!tradeAmount || parseFloat(tradeAmount) <= 0 || !curveAddress) {
      setBuyQuote(null)
      setSellQuote(null)
      return
    }
    
    const updateQuotes = async () => {
      try {
        if (tradeAction === 'buy') {
          const quote = await newBondingCurveTradingService.getBuyQuote(curveAddress, tradeAmount)
          setBuyQuote(quote)
        } else if (tradeAction === 'sell') {
          const quote = await newBondingCurveTradingService.getSellQuote(curveAddress, tradeAmount)
          setSellQuote(quote)
        }
      } catch (e) {
        console.warn('Failed to get quote:', e)
      }
    }
    
    updateQuotes()
  }, [tradeAmount, tradeAction, curveAddress])

  const handleTrade = async (action: 'buy' | 'sell') => {
    if (!tradeAmount || parseFloat(tradeAmount) <= 0) {
      setError('Enter a valid amount')
      return
    }
    
    if (!isConnected) {
      setError('Please connect your wallet')
      return
    }
    
    if (!coin.tokenAddress) {
      setError('Token address not available')
      return
    }
    
    if (!curveAddress) {
      setError('Trading unavailable: curve not deployed. This token may not have been created with the factory.')
      return
    }
    
    setIsTrading(true)
    setTradeAction(action)
    setError(null)
    setSuccess(null)
    
    try {
      let result
      
      if (action === 'buy') {
        // Buy tokens with MATIC
        if (!buyQuote) {
          // Get quote first
          const quote = await newBondingCurveTradingService.getBuyQuote(curveAddress, tradeAmount)
          if (!quote) {
            throw new Error('Failed to get buy quote')
          }
          setBuyQuote(quote)
          
          // Calculate min tokens out with slippage protection
          const minTokensOut = (parseFloat(quote.outputAmount) * (1 - slippageTolerance)).toString()
          result = await newBondingCurveTradingService.buyTokens(curveAddress, tradeAmount, minTokensOut)
        } else {
          const minTokensOut = (parseFloat(buyQuote.outputAmount) * (1 - slippageTolerance)).toString()
          result = await newBondingCurveTradingService.buyTokens(curveAddress, tradeAmount, minTokensOut)
        }
      } else {
        // Sell tokens for MATIC
        if (!sellQuote) {
          // Get quote first
          const quote = await newBondingCurveTradingService.getSellQuote(curveAddress, tradeAmount)
          if (!quote) {
            throw new Error('Failed to get sell quote')
          }
          setSellQuote(quote)
          
          // Calculate min MATIC out with slippage protection
          const minOgOut = (parseFloat(quote.outputAmount) * (1 - slippageTolerance)).toString()
          result = await newBondingCurveTradingService.sellTokens(curveAddress, tradeAmount, minOgOut)
        } else {
          const minOgOut = (parseFloat(sellQuote.outputAmount) * (1 - slippageTolerance)).toString()
          result = await newBondingCurveTradingService.sellTokens(curveAddress, tradeAmount, minOgOut)
        }
      }
      
      if (result.success && result.txHash) {
        const shortHash = `${result.txHash.slice(0, 6)}...${result.txHash.slice(-4)}`
        setSuccess(`Trade executed successfully! TX: ${shortHash}`)
        
        if (onTrade) {
          onTrade(coin, action, tradeAmount)
        }
        
        // Refresh balances and market data
        await loadUserBalances()
        await loadMarketData()
        if (curveAddress) {
          await loadCurveInfo(curveAddress)
        }
        
        // Add price point to history
        if (marketData && marketData.currentPrice > 0) {
          addPricePoint(marketData.currentPrice)
        }
        
        // Reset form after a delay
        setTimeout(() => {
          setTradeAmount('')
          setTradeAction(null)
          setSuccess(null)
        }, 3000)
      } else {
        throw new Error(result.error || 'Trade execution failed')
      }
    } catch (error: any) {
      console.error('Trade failed:', error)
      setError(error.message || 'Trade execution failed')
    } finally {
      setIsTrading(false)
    }
  }

  const formatPrice = (price: number) => {
    if (price === 0) return 'No Price'
    if (price < 0.0001) return `$${price.toFixed(8)}`
    if (price < 0.01) return `$${price.toFixed(6)}`
    if (price < 1) return `$${price.toFixed(4)}`
    return `$${price.toFixed(2)}`
  }

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance)
    if (num === 0) return '0'
    if (num < 0.0001) return num.toFixed(8)
    if (num < 0.01) return num.toFixed(6)
    if (num < 1) return num.toFixed(4)
    return num.toFixed(2)
  }

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      transition={{ duration: 0.3 }}
      onClick={onClick}
      className={cardBase}
    >
      {/* Header with Image and Basic Info */}
      <div className="flex items-start gap-4 mb-4">
        <CoinImage coin={displayCoin as any} size="md" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-2xl font-extrabold tracking-tight">{displayCoin.name}</h3>
            <span className="text-sm text-slate-700">({displayCoin.symbol})</span>
          </div>
          <p className="text-sm text-slate-800 mb-3 leading-relaxed">{displayCoin.description}</p>
          
          {/* Real Market Data */}
          {marketData && (
            <div className="grid grid-cols-2 gap-4 text-xs text-slate-700 mb-3">
              <div className="flex items-center justify-between">
                <span>Price:</span>
                <span className="text-slate-900 font-semibold">{formatPrice(marketData.currentPrice)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Market Cap:</span>
                <span className="text-slate-900 font-semibold">${marketData.marketCap.toLocaleString()}</span>
              </div>
            </div>
          )}
          
          {/* Price Chart Toggle */}
          {marketData && marketData.currentPrice > 0 && (
            <div className="mb-3">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setShowChart(!showChart)
                }}
                className="flex items-center gap-2 text-xs text-slate-700 hover:text-slate-900 font-semibold"
              >
                <BarChart3 className="w-4 h-4" />
                {showChart ? 'Hide' : 'Show'} Price Chart
              </button>
              {showChart && priceHistory.length > 0 && (
                <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                  <PriceChart data={priceHistory} compact={true} />
                </div>
              )}
            </div>
          )}
          
          {/* Liquidity Status */}
          <div className="flex items-center gap-2 mb-3">
            {tradingEnabled ? (
              <div className="flex items-center gap-1 text-green-600 text-xs">
                <CheckCircle className="w-3 h-3" />
                <span>
                  {curveAddress ? 'Bonding Curve Trading Enabled' : 'DEX Trading Enabled'}
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-yellow-600 text-xs">
                <AlertCircle className="w-3 h-3" />
                <span>No Liquidity Yet</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* User Balances */}
      {isConnected && (
        <div className="grid grid-cols-2 gap-4 text-xs text-slate-700 mb-4 p-3 bg-white border-2 border-black rounded-lg shadow-[3px_3px_0_#000]">
          <div className="flex items-center justify-between">
            <span>Your {displayCoin.symbol}:</span>
            <span className="text-slate-900 font-semibold">{formatBalance(userBalance)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>Your ETH:</span>
            <span className="text-slate-900 font-semibold">{formatBalance(ethBalance)}</span>
          </div>
        </div>
      )}

      {/* Trading Interface */}
      {tradingEnabled ? (
        <div className="space-y-3">
          {/* Trade Amount Input */}
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="Amount to trade"
              value={tradeAmount}
              onChange={(e) => setTradeAmount(e.target.value)}
              className={neoInput}
              min="0"
              step="0.000001"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setTradeAmount(tradeAction === 'buy' ? ethBalance : userBalance)}
            >
              Max
            </Button>
          </div>

          {/* Buy/Sell Buttons */}
          <div className="flex gap-2">
            <Button
              onClick={(e) => {
                e.stopPropagation()
                handleTrade('buy')
              }}
              disabled={isTrading || !tradeAmount || parseFloat(tradeAmount) <= 0 || !isConnected}
              className={"flex-1 "+neoButton+" bg-green-400 hover:bg-green-300 text-slate-900 font-bold disabled:opacity-50"}
            >
              {isTrading && tradeAction === 'buy' ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
              ) : (
                <TrendingUp className="w-4 h-4 mr-2" />
              )}
              {isTrading && tradeAction === 'buy' ? 'Buying...' : 'Buy'}
            </Button>
            
            <Button
              onClick={(e) => {
                e.stopPropagation()
                handleTrade('sell')
              }}
              disabled={isTrading || !tradeAmount || parseFloat(tradeAmount) <= 0 || !isConnected}
              className={"flex-1 "+neoButton+" bg-red-400 hover:bg-red-300 text-slate-900 font-bold disabled:opacity-50"}
            >
              {isTrading && tradeAction === 'sell' ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
              ) : (
                <TrendingDown className="w-4 h-4 mr-2" />
              )}
              {isTrading && tradeAction === 'sell' ? 'Selling...' : 'Sell'}
            </Button>
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="p-3 bg-red-200 border-2 border-black rounded-lg text-red-900 text-xs shadow-[3px_3px_0_#000]">
              {error}
            </div>
          )}
          
          {success && (
            <div className="p-3 bg-green-200 border-2 border-black rounded-lg text-green-900 text-xs shadow-[3px_3px_0_#000]">
              {success}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-4">
          <p className="text-slate-700 text-sm mb-3">
            This token needs a liquidity pool to enable trading
          </p>
          {!showAddLiquidity ? (
            <Button
              variant="neutral"
              onClick={(e) => {
                e.stopPropagation()
                setShowAddLiquidity(true)
              }}
            >
              Add Liquidity
            </Button>
          ) : (
            <div className="space-y-2">
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder="Token amount"
                  value={liqTokenAmount}
                  onChange={(e) => setLiqTokenAmount(e.target.value)}
                  className={neoInput}
                />
                <Input
                  type="number"
                  placeholder="ETH amount"
                  value={liqEthAmount}
                  onChange={(e) => setLiqEthAmount(e.target.value)}
                  className={neoInput}
                />
              </div>
              <div className="flex gap-2 justify-center">
                <Button
                  variant="neutral"
                  disabled={isAddingLiquidity}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleAddLiquidity()
                  }}
                >
                  {isAddingLiquidity ? 'Adding...' : 'Confirm'}
                </Button>
                <Button
                  variant="secondary"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowAddLiquidity(false)
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex gap-2 pt-4">
        <Button
          variant="secondary"
          size="sm"
          className="flex-1 text-xs"
          onClick={(e) => {
            e.stopPropagation()
            // TODO: Open chart view
          }}
        >
          <BarChart3 className="w-3 h-3 mr-1" />
          Chart
        </Button>
        
        <Button
          variant="secondary"
          size="sm"
          className="flex-1 text-xs"
          onClick={(e) => {
            e.stopPropagation()
            // TODO: Add to watchlist
          }}
        >
          ⭐ Watch
        </Button>
      </div>

      {/* Token Details (Real Data Only) */}
      <div className="mt-4 pt-4 border-t-4 border-black text-xs text-slate-700">
        <div className="grid grid-cols-2 gap-2">
          <div>Contract: {coin.tokenAddress ? `${coin.tokenAddress.slice(0, 8)}...${coin.tokenAddress.slice(-6)}` : 'N/A'}</div>
          <div>Creator: {(displayCoin.creator || '').slice(0, 6)}...{(displayCoin.creator || '').slice(-4)}</div>
        </div>
        
        {/* Social Media Links (Real URLs) */}
        {(coin.telegramUrl || coin.xUrl || coin.discordUrl || coin.websiteUrl) && (
          <div className="flex items-center gap-2 mt-2 text-xs text-slate-700">
            <span>Social:</span>
            {coin.telegramUrl && (
              <a 
                href={coin.telegramUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline decoration-black decoration-2 underline-offset-2 hover:text-blue-700"
                onClick={(e) => e.stopPropagation()}
              >
                📱 Telegram
              </a>
            )}
            {coin.xUrl && (
              <a 
                href={coin.xUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline decoration-black decoration-2 underline-offset-2 hover:text-slate-900"
                onClick={(e) => e.stopPropagation()}
              >
                🐦 X/Twitter
              </a>
            )}
            {coin.discordUrl && (
              <a 
                href={coin.discordUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline decoration-black decoration-2 underline-offset-2 hover:text-indigo-800"
                onClick={(e) => e.stopPropagation()}
              >
                🎮 Discord
              </a>
            )}
            {coin.websiteUrl && (
              <a 
                href={coin.websiteUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline decoration-black decoration-2 underline-offset-2 hover:text-green-800"
                onClick={(e) => e.stopPropagation()}
              >
                🌐 Website
              </a>
            )}
          </div>
        )}
      </div>
    </motion.div>
  )
}
