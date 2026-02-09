'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown, Shield, Lock, Zap, DollarSign, HelpCircle } from 'lucide-react'

interface FAQItem {
  question: string
  answer: string
  icon: any
}

const faqs: FAQItem[] = [
  {
    question: 'How does the bonding curve work?',
    answer: 'The bonding curve uses a constant-product formula (x * y = k) to automatically adjust token prices. As more people buy, the price increases. As people sell, the price decreases. This ensures instant liquidity without needing a traditional liquidity pool.',
    icon: Zap
  },
  {
    question: 'What are the fees?',
    answer: 'Token creation is FREE. Trading has a 0.5% fee split between the platform (0.3%) and token creator (0.2%). There are no hidden fees or charges.',
    icon: DollarSign
  },
  {
    question: 'Is my wallet safe?',
    answer: 'Yes! We use industry-standard wallet connections (RainbowKit/WalletConnect). We never have access to your private keys. All transactions require your explicit approval.',
    icon: Shield
  },
  {
    question: 'Where are tokens stored?',
    answer: 'Token metadata and images are stored on decentralized storage networks, making them censorship-resistant and permanently accessible. Smart contracts are deployed on Polygon mainnet.',
    icon: Lock
  },
  {
    question: 'Can I trade immediately after creating?',
    answer: 'Yes! Your token has instant liquidity through the bonding curve. Trading starts immediately after creation with no waiting period.',
    icon: Zap
  },
  {
    question: 'What happens at graduation?',
    answer: 'When a token reaches its graduation cap (typically 10 MATIC raised), liquidity is automatically migrated to a decentralized exchange for enhanced trading features.',
    icon: HelpCircle
  },
  {
    question: 'Are smart contracts audited?',
    answer: 'Our smart contracts follow industry best practices and are open source. You can verify them on PolygonScan. We recommend doing your own research before trading.',
    icon: Shield
  },
  {
    question: 'How do I get testnet MATIC?',
    answer: 'POL Pump runs on Polygon mainnet. You can acquire MATIC from exchanges like Binance, Coinbase, or use the Polygon bridge to transfer from Ethereum.',
    icon: DollarSign
  }
]

export default function FAQSection() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-2">Frequently Asked Questions</h2>
        <p className="text-white/60">Everything you need to know about creating and trading tokens</p>
      </div>

      <div className="space-y-3">
        {faqs.map((faq, index) => {
          const Icon = faq.icon
          const isOpen = openIndex === index

          return (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="glass-card overflow-hidden"
            >
              <button
                onClick={() => setOpenIndex(isOpen ? null : index)}
                className="w-full p-4 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div className="p-2 bg-white/10 rounded-lg">
                    <Icon className="w-5 h-5 text-[#12D9C8]" />
                  </div>
                  <span className="font-semibold text-white">{faq.question}</span>
                </div>
                <motion.div
                  animate={{ rotate: isOpen ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown className="w-5 h-5 text-white/60" />
                </motion.div>
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 pt-0">
                      <div className="pl-14 text-white/70 text-sm leading-relaxed">
                        {faq.answer}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>

      {/* Safety Tips */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="glass-card p-6 mt-8"
      >
        <div className="flex items-start gap-3">
          <Shield className="w-6 h-6 text-green-400 flex-shrink-0 mt-1" />
          <div>
            <h3 className="text-lg font-bold text-white mb-2">Safety Tips</h3>
            <ul className="space-y-2 text-sm text-white/70">
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">•</span>
                <span>Always verify contract addresses on PolygonScan before trading</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">•</span>
                <span>Never share your private keys or seed phrase with anyone</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">•</span>
                <span>Start with small amounts when trading new tokens</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">•</span>
                <span>Do your own research (DYOR) before investing</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-400 mt-1">•</span>
                <span>Be aware that cryptocurrency trading involves risk</span>
              </li>
            </ul>
          </div>
        </div>
      </motion.div>

      {/* Contact Support */}
      <div className="text-center mt-8">
        <p className="text-white/60 text-sm mb-3">Still have questions?</p>
        <button className="btn-secondary">
          Contact Support
        </button>
      </div>
    </div>
  )
}
