'use client'

import { motion } from 'framer-motion'
import { CheckCircle, Sparkles, TrendingUp } from 'lucide-react'
import Link from 'next/link'

interface PostConnectionSuccessProps {
  address: string
  onCreateToken: () => void
  onExplore: () => void
}

export default function PostConnectionSuccess({ address, onCreateToken, onExplore }: PostConnectionSuccessProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card p-8 text-center max-w-md mx-auto"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', delay: 0.2 }}
      >
        <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
      </motion.div>

      <h2 className="text-2xl font-bold text-white mb-2">You're Connected!</h2>
      <p className="text-white/60 text-sm mb-6">
        {address.slice(0, 6)}...{address.slice(-4)}
      </p>

      <div className="space-y-3">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onCreateToken}
          className="btn-primary w-full justify-center"
        >
          <Sparkles className="w-5 h-5 mr-2" />
          Create Your First Token
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={onExplore}
          className="btn-secondary w-full justify-center"
        >
          <TrendingUp className="w-5 h-5 mr-2" />
          Explore Tokens
        </motion.button>
      </div>

      <div className="mt-6 p-4 bg-blue-500/20 border border-blue-500/30 rounded-lg">
        <p className="text-xs text-blue-300">
          <strong>Next Steps:</strong> Create your own memecoin or start trading existing tokens on the bonding curve!
        </p>
      </div>
    </motion.div>
  )
}
