'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Copy, ExternalLink, Check, Code, DollarSign, Info } from 'lucide-react'
import { InfoTooltip } from '@/components/InfoTooltip'
import VerifiedBadge from '@/components/VerifiedBadge'

interface ContractInfoProps {
  tokenAddress: string
  curveAddress?: string
  creatorAddress: string
  createdAt: string
  txHash?: string
}

export default function ContractInfo({
  tokenAddress,
  curveAddress,
  creatorAddress,
  createdAt,
  txHash
}: ContractInfoProps) {
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(field)
      setTimeout(() => setCopiedField(null), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="space-y-6">
      {/* Contract Addresses */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Code className="w-5 h-5 text-[#12D9C8]" />
            Contract Information
          </h3>
          <VerifiedBadge type="verified" size="sm" />
        </div>

        <div className="space-y-4">
          {/* Token Address */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-white/60">Token Contract</span>
              <InfoTooltip content="The smart contract address for this token" />
            </div>
            <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg border border-white/10">
              <code className="flex-1 text-sm text-white font-mono truncate">
                {tokenAddress}
              </code>
              <button
                onClick={() => copyToClipboard(tokenAddress, 'token')}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Copy address"
              >
                {copiedField === 'token' ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-white/60" />
                )}
              </button>
              <a
                href={`https://amoy.polygonscan.com/address/${tokenAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="View on PolygonScan"
              >
                <ExternalLink className="w-4 h-4 text-white/60" />
              </a>
            </div>
          </div>

          {/* Curve Address */}
          {curveAddress && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-sm text-white/60">Bonding Curve Contract</span>
                <InfoTooltip content="The smart contract managing the bonding curve for this token" />
              </div>
              <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg border border-white/10">
                <code className="flex-1 text-sm text-white font-mono truncate">
                  {curveAddress}
                </code>
                <button
                  onClick={() => copyToClipboard(curveAddress, 'curve')}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  title="Copy address"
                >
                  {copiedField === 'curve' ? (
                    <Check className="w-4 h-4 text-green-400" />
                  ) : (
                    <Copy className="w-4 h-4 text-white/60" />
                  )}
                </button>
                <a
                  href={`https://amoy.polygonscan.com/address/${curveAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  title="View on PolygonScan"
                >
                  <ExternalLink className="w-4 h-4 text-white/60" />
                </a>
              </div>
            </div>
          )}

          {/* Creator Address */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm text-white/60">Creator</span>
              <InfoTooltip content="The wallet address that created this token" />
            </div>
            <div className="flex items-center gap-2 p-3 bg-white/5 rounded-lg border border-white/10">
              <code className="flex-1 text-sm text-white font-mono truncate">
                {creatorAddress}
              </code>
              <button
                onClick={() => copyToClipboard(creatorAddress, 'creator')}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="Copy address"
              >
                {copiedField === 'creator' ? (
                  <Check className="w-4 h-4 text-green-400" />
                ) : (
                  <Copy className="w-4 h-4 text-white/60" />
                )}
              </button>
              <a
                href={`https://amoy.polygonscan.com/address/${creatorAddress}`}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                title="View on PolygonScan"
              >
                <ExternalLink className="w-4 h-4 text-white/60" />
              </a>
            </div>
          </div>

          {/* Creation Info */}
          <div className="grid grid-cols-2 gap-4 pt-2">
            <div>
              <span className="text-xs text-white/60">Created</span>
              <div className="text-sm text-white mt-1">{formatDate(createdAt)}</div>
            </div>
            {txHash && (
              <div>
                <span className="text-xs text-white/60">Transaction</span>
                <a
                  href={`https://amoy.polygonscan.com/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-[#12D9C8] hover:text-[#12D9C8]/80 mt-1 flex items-center gap-1"
                >
                  {shortenAddress(txHash)}
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Fee Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="w-5 h-5 text-[#12D9C8]" />
          <h3 className="text-lg font-bold text-white">Fee Structure</h3>
          <InfoTooltip content="Transparent breakdown of all fees" />
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
            <div>
              <div className="text-sm font-medium text-white">Trading Fee</div>
              <div className="text-xs text-white/60">Per transaction</div>
            </div>
            <div className="text-lg font-bold text-white">0.5%</div>
          </div>

          <div className="pl-4 space-y-2 border-l-2 border-white/10">
            <div className="flex items-center justify-between">
              <div className="text-sm text-white/70">Platform Fee</div>
              <div className="text-sm font-semibold text-white">0.3%</div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-sm text-white/70">Creator Fee</div>
              <div className="text-sm font-semibold text-white">0.2%</div>
            </div>
          </div>

          <div className="flex items-center justify-between p-3 bg-green-500/20 border border-green-500/30 rounded-lg">
            <div>
              <div className="text-sm font-medium text-green-300">Creation Fee</div>
              <div className="text-xs text-green-200/80">One-time</div>
            </div>
            <div className="text-lg font-bold text-green-300">FREE</div>
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-500/20 border border-blue-500/30 rounded-lg">
          <div className="text-xs text-blue-300">
            <strong>Note:</strong> All fees are automatically deducted from transactions. No hidden charges.
          </div>
        </div>
      </motion.div>

      {/* Security Info */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass-card p-6"
      >
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-[#12D9C8] flex-shrink-0 mt-0.5" />
          <div className="text-sm text-white/80">
            <strong className="text-white">Security Notice</strong>
            <p className="mt-1 text-white/60">
              Always verify contract addresses on PolygonScan before trading. Smart contracts are immutable and cannot be changed after deployment.
            </p>
            <a
              href="https://amoy.polygonscan.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#12D9C8] hover:text-[#12D9C8]/80 mt-2 inline-flex items-center gap-1"
            >
              View on PolygonScan
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
