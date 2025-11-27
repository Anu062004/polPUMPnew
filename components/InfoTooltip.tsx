import * as React from 'react'
import { Info } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface InfoTooltipProps {
  content: string
  side?: 'top' | 'bottom' | 'left' | 'right'
}

export function InfoTooltip({ content, side = 'top' }: InfoTooltipProps) {
  const [isOpen, setIsOpen] = React.useState(false)

  return (
    <div className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setIsOpen(true)}
        onMouseLeave={() => setIsOpen(false)}
        onClick={(e) => {
          e.preventDefault()
          setIsOpen(!isOpen)
        }}
        className="cursor-help p-1 hover:bg-white/10 rounded-full transition-colors"
      >
        <Info className="w-4 h-4 text-white/60 hover:text-white/80 transition-colors" />
      </button>
      
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: side === 'top' ? 5 : -5 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className={`absolute z-50 px-3 py-2 text-xs text-white bg-slate-900 border border-white/20 rounded-lg shadow-xl max-w-xs whitespace-normal pointer-events-none ${
              side === 'top' ? 'bottom-full mb-2 left-1/2 -translate-x-1/2' :
              side === 'bottom' ? 'top-full mt-2 left-1/2 -translate-x-1/2' :
              side === 'left' ? 'right-full mr-2 top-1/2 -translate-y-1/2' :
              'left-full ml-2 top-1/2 -translate-y-1/2'
            }`}
          >
            {content}
            <div className={`absolute w-2 h-2 bg-slate-900 border-white/20 transform rotate-45 ${
              side === 'top' ? 'bottom-[-4px] left-1/2 -translate-x-1/2 border-b border-r' :
              side === 'bottom' ? 'top-[-4px] left-1/2 -translate-x-1/2 border-t border-l' :
              side === 'left' ? 'right-[-4px] top-1/2 -translate-y-1/2 border-r border-t' :
              'left-[-4px] top-1/2 -translate-y-1/2 border-l border-b'
            }`} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
