'use client'

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState
} from 'react'

export type PumpAIMode = 'degen' | 'pro' | 'analyst'
export type PumpAIAction = 'view' | 'buy' | 'sell' | 'create'

export interface PumpAIMemory {
  lastViewedToken?: string
  lastAction?: PumpAIAction
  walletAddress?: string
  preferredMode?: PumpAIMode
}

interface PumpAIContextValue {
  memory: PumpAIMemory
  setMemory: (update: Partial<PumpAIMemory>) => void
}

const STORAGE_KEY = 'pump_ai_memory_v1'

const defaultMemory: PumpAIMemory = {
  preferredMode: 'degen'
}

const PumpAIContext = createContext<PumpAIContextValue | undefined>(undefined)

export function PumpAIProvider({ children }: { children: React.ReactNode }) {
  const [memory, setMemoryState] = useState<PumpAIMemory>(defaultMemory)

  // Load from localStorage on mount
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as PumpAIMemory
        setMemoryState(prev => ({ ...prev, ...parsed }))
      }
    } catch {
      // Ignore storage errors
    }
  }, [])

  const setMemory = useCallback((update: Partial<PumpAIMemory>) => {
    setMemoryState(prev => {
      const next: PumpAIMemory = { ...prev, ...update }
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
        }
      } catch {
        // Ignore storage errors
      }
      return next
    })
  }, [])

  return (
    <PumpAIContext.Provider value={{ memory, setMemory }}>
      {children}
    </PumpAIContext.Provider>
  )
}

export function usePumpAI(): PumpAIContextValue {
  const ctx = useContext(PumpAIContext)
  if (!ctx) {
    throw new Error('usePumpAI must be used within a PumpAIProvider')
  }
  return ctx
}





