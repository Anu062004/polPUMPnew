'use client'
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ExternalLink, Copy, Activity, Globe, Wallet, Calendar, Hash } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { CoinData as BaseCoinData } from '../../lib/0gStorage'
import CoinImage from './CoinImage'

interface CoinDetailModalProps {
  isOpen: boolean
  onClose: () => void
  coin: (BaseCoinData & {
    imageHash?: string
    tokenAddress?: string
    txHash?: string
    telegramUrl?: string
    xUrl?: string
    discordUrl?: string
    websiteUrl?: string
  }) | null
}

export default function CoinDetailModal({ isOpen, onClose, coin }: CoinDetailModalProps) {
  const [copied, setCopied] = useState<string | null>(null)
  const [tx, setTx] = useState<string | null>(null)

  useEffect(() => {
    setTx(coin?.txHash || null)
  }, [coin?.txHash])

  // If tx is missing but we have tokenAddress + creator, fetch from backend on-chain index
  useEffect(() => {
    const loadTx = async () => {
      if (!coin || tx) return
      if (!coin.tokenAddress || !coin.creator) return
      try {
        const backendBase = (typeof process !== 'undefined' && (process as any).env && (process as any).env.NEXT_PUBLIC_BACKEND_URL) || 'http://localhost:4000'
        const url = `${backendBase}/tokens/onchain?creator=${coin.creator}`
        const resp = await fetch(url)
        if (!resp.ok) return
        const data = await resp.json()
        const match = (data.tokens || []).find((t: any) =>
          (t.tokenAddress || '').toLowerCase() === (coin.tokenAddress || '').toLowerCase()
        )
        if (match?.txHash) setTx(match.txHash)
      } catch {}
    }
    loadTx()
  }, [coin, tx])

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(type)
      setTimeout(() => setCopied(null), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const formatAddress = (address: string | undefined | null) => {
    if (!address) return 'N/A'
    const a = address.toString()
    if (a.length <= 14) return a
    return `${a.slice(0, 8)}...${a.slice(-6)}`
  }

  const formatTimeAgo = (timestamp: number | string | undefined | null) => {
    const t = typeof timestamp === 'string' ? Number(timestamp) : (timestamp || 0)
    if (!t || Number.isNaN(t)) return 'Unknown'
    const now = Date.now()
    const diff = now - t
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  }

  if (!coin) return null

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-[#1a0b2e]/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <Card className="bg-slate-800/90 backdrop-blur-xl border-slate-700/50 shadow-2xl nb-press">
              <CardHeader className="relative">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <CoinImage coin={coin} size="lg" />
                    <div>
                      <CardTitle className="text-3xl bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                        <span style={{ fontFamily: 'serif' }}>{coin.name}</span>
                      </CardTitle>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge className="bg-gradient-to-r from-purple-500 to-blue-500 text-white text-lg px-4 py-2 rounded-xl">
                          {coin.symbol}
                        </Badge>
                        <Badge className="text-sm bg-slate-600/60 text-slate-300">
                          {formatTimeAgo(coin.createdAt)}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button variant="secondary" onClick={onClose} className="text-slate-400 hover:text-white">
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Description */}
                <div className="bg-slate-700/40 rounded-xl p-4">
                  <h3 className="text-lg font-semibold text-white mb-2">Description</h3>
                  <p className="text-slate-300">{coin.description}</p>
                </div>

                {/* Token Details */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">Token Information</h3>
                    
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 bg-slate-700/40 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Hash className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-300">Supply</span>
                        </div>
                        <span className="text-white font-mono">{parseInt(coin.supply).toLocaleString()}</span>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-slate-700/40 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Wallet className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-300">Creator</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-mono">{formatAddress(coin.creator)}</span>
                          <Button
                            variant="secondary"
                            onClick={() => copyToClipboard(coin.creator, 'creator')}
                            className="text-slate-400 hover:text-white"
                          >
                            {copied === 'creator' ? '✓' : <Copy className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between p-3 bg-slate-700/40 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Calendar className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-300">Created</span>
                        </div>
                        <span className="text-white">{new Date(Number(coin.createdAt) || Date.now()).toLocaleDateString()}</span>
                      </div>

                      {coin.imageHash && (
                        <div className="flex items-center justify-between p-3 bg-slate-700/40 rounded-lg">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-300">Image Hash</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-mono text-xs">{coin.imageHash}</span>
                            <Button
                              variant="secondary"
                              onClick={() => copyToClipboard(coin.imageHash!, 'image')}
                              className="text-slate-400 hover:text-white"
                            >
                              {copied === 'image' ? '✓' : <Copy className="w-4 h-4" />}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">Blockchain Links</h3>
                    
                    <div className="space-y-3">
                      {coin.tokenAddress && (
                        <div className="flex items-center justify-between p-3 bg-slate-700/40 rounded-lg">
                          <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-300">Token Contract</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-white font-mono">{formatAddress(coin.tokenAddress)}</span>
                            <Button
                              variant="secondary"
                              onClick={() => copyToClipboard(coin.tokenAddress || '', 'token')}
                              className="text-slate-400 hover:text-white"
                            >
                              {copied === 'token' ? '✓' : <Copy className="w-4 h-4" />}
                            </Button>
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between p-3 bg-slate-700/40 rounded-lg">
                        <div className="flex items-center gap-2">
                          <Activity className="w-4 h-4 text-slate-400" />
                          <span className="text-slate-300">Transaction</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-mono">{tx ? formatAddress(tx) : 'N/A'}</span>
                          <Button
                            variant="secondary"
                            onClick={() => tx && copyToClipboard(tx, 'tx')}
                            className="text-slate-400 hover:text-white"
                          >
                            {copied === 'tx' ? '✓' : <Copy className="w-4 h-4" />}
                          </Button>
                        </div>
                      </div>
                    </div>

                    {/* Blockchain Explorer Links */}
                    <div className="space-y-2">
                      <Button
                        onClick={() => window.open(tx ? `https://amoy.polygonscan.com/tx/${tx}` : (coin.tokenAddress ? `https://amoy.polygonscan.com/address/${coin.tokenAddress}` : '#'), '_blank')}
                        className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
                      >
                        <ExternalLink className="w-4 h-4 mr-2" />
                        View on PolygonScan
                      </Button>
                      
                      {coin.tokenAddress && (
                        <Button
                          onClick={() => window.open(`https://amoy.polygonscan.com/address/${coin.tokenAddress}`, '_blank')}
                          variant="secondary"
                          className="w-full"
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          View Token Contract
                        </Button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Social Media Links */}
                {(coin.telegramUrl || coin.xUrl || coin.discordUrl || coin.websiteUrl) && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white">Social Media & Links</h3>
                    
                    <div className="grid grid-cols-2 gap-3">
                      {coin.telegramUrl && (
                        <Button
                          onClick={() => window.open(coin.telegramUrl, '_blank')}
                          className="w-full bg-blue-500 hover:bg-blue-600 text-white"
                        >
                          <span className="text-lg mr-2">📱</span>
                          Telegram
                        </Button>
                      )}
                      
                      {coin.xUrl && (
                        <Button
                          onClick={() => window.open(coin.xUrl, '_blank')}
                          className="w-full bg-black hover:bg-gray-800 text-white"
                        >
                          <span className="text-lg mr-2">🐦</span>
                          X (Twitter)
                        </Button>
                      )}
                      
                      {coin.discordUrl && (
                        <Button
                          onClick={() => window.open(coin.discordUrl, '_blank')}
                          className="w-full bg-indigo-500 hover:bg-indigo-600 text-white"
                        >
                          <span className="text-lg mr-2">🎮</span>
                          Discord
                        </Button>
                      )}
                      
                      {coin.websiteUrl && (
                        <Button
                          onClick={() => window.open(coin.websiteUrl, '_blank')}
                          className="w-full bg-green-500 hover:bg-green-600 text-white"
                        >
                          <span className="text-lg mr-2">🌐</span>
                          Website
                        </Button>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={onClose}
                    variant="secondary"
                    className="flex-1 border-slate-600/50 text-slate-300 hover:bg-slate-700/50"
                  >
                    Close
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
