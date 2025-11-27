'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, Wallet, Shield, Zap, CheckCircle, AlertTriangle } from 'lucide-react'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useSwitchChain, useChainId } from 'wagmi'
import { polygonAmoy } from 'wagmi/chains'
import { useEffect, useState } from 'react'

interface WalletConnectModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  reason?: string
}

const SUPPORTED_WALLETS = [
  { name: 'MetaMask', icon: '🦊', popular: true },
  { name: 'WalletConnect', icon: '🔗', popular: true },
  { name: 'Coinbase Wallet', icon: '🔵', popular: true },
  { name: 'Rainbow', icon: '🌈', popular: false },
  { name: 'Trust Wallet', icon: '🛡️', popular: false },
]

export default function WalletConnectModal({ isOpen, onClose, onSuccess, reason }: WalletConnectModalProps) {
  const { isConnected, address } = useAccount()
  const chainId = useChainId()
  const { switchChain } = useSwitchChain()
  const [showSuccess, setShowSuccess] = useState(false)
  const [wrongNetwork, setWrongNetwork] = useState(false)

  useEffect(() => {
    if (isConnected && chainId) {
      if (chainId !== polygonAmoy.id) {
        setWrongNetwork(true)
      } else {
        setWrongNetwork(false)
        setShowSuccess(true)
        setTimeout(() => {
          onSuccess?.()
          onClose()
        }, 1500)
      }
    }
  }, [isConnected, chainId, onSuccess, onClose])

  const handleSwitchNetwork = () => {
    if (switchChain) {
      switchChain({ chainId: polygonAmoy.id })
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="glass-card max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-white">Connect Wallet</h2>
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Wrong Network Warning */}
            {wrongNetwork && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-xl"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-yellow-300 mb-1">Wrong Network</div>
                    <div className="text-sm text-yellow-200/80 mb-3">
                      Please switch to Polygon Amoy testnet to continue
                    </div>
                    <button
                      onClick={handleSwitchNetwork}
                      className="btn-primary text-sm py-2 px-4"
                    >
                      Switch to Polygon Amoy
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Success State */}
            {showSuccess && !wrongNetwork && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-8"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', duration: 0.5 }}
                >
                  <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                </motion.div>
                <h3 className="text-xl font-bold text-white mb-2">Successfully Connected!</h3>
                <p className="text-white/60 text-sm">
                  {address && `${address.slice(0, 6)}...${address.slice(-4)}`}
                </p>
              </motion.div>
            )}

            {/* Connect State */}
            {!showSuccess && !wrongNetwork && (
              <>
                {/* Reason */}
                {reason && (
                  <div className="mb-6 p-4 bg-blue-500/20 border border-blue-500/50 rounded-xl">
                    <div className="flex items-start gap-3">
                      <Shield className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-blue-200">{reason}</div>
                    </div>
                  </div>
                )}

                {/* Why Connect */}
                <div className="mb-6 space-y-3">
                  <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wide">
                    Why connect your wallet?
                  </h3>
                  <div className="space-y-2">
                    {[
                      { icon: Zap, text: 'Create and trade tokens instantly' },
                      { icon: Shield, text: 'Secure and non-custodial' },
                      { icon: Wallet, text: 'Track your portfolio and earnings' },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center gap-3 text-white/70">
                        <item.icon className="w-4 h-4 text-[#12D9C8]" />
                        <span className="text-sm">{item.text}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Supported Wallets */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-white/80 uppercase tracking-wide mb-3">
                    Supported Wallets
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    {SUPPORTED_WALLETS.map((wallet) => (
                      <div
                        key={wallet.name}
                        className="flex items-center gap-2 p-3 bg-white/5 rounded-lg border border-white/10"
                      >
                        <span className="text-2xl">{wallet.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-white truncate">{wallet.name}</div>
                          {wallet.popular && (
                            <div className="text-xs text-[#12D9C8]">Popular</div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Connect Button */}
                <div className="flex justify-center">
                  <ConnectButton.Custom>
                    {({ openConnectModal }) => (
                      <button
                        onClick={openConnectModal}
                        className="btn-primary w-full justify-center"
                      >
                        <Wallet className="w-5 h-5 mr-2" />
                        Connect Wallet
                      </button>
                    )}
                  </ConnectButton.Custom>
                </div>

                {/* Network Info */}
                <div className="mt-6 p-4 bg-white/5 rounded-lg border border-white/10">
                  <div className="text-xs text-white/60 text-center">
                    <div className="font-semibold text-white/80 mb-1">Network</div>
                    <div>Polygon Amoy Testnet</div>
                    <div className="mt-2 text-[#12D9C8]">Chain ID: {polygonAmoy.id}</div>
                  </div>
                </div>
              </>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
