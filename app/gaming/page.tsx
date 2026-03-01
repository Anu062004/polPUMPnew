"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { ethers } from 'ethers'
import { useRouter } from 'next/navigation'
import TokenCreatorModal from '../components/TokenCreatorModal'
import BlobBackground from '../components/BlobBackground'
import { useAuth } from '../providers/AuthContext'
import { generateSignMessage } from '../../lib/authUtils'

const COIN_CREATED_EVENT = 'polpump:coin-created'
const COIN_CREATED_STORAGE_KEY = 'polpump:last-coin-created'

function getCoinKey(coin: any): string {
  return ((coin?.tokenAddress || coin?.id || '') as string).toLowerCase()
}

export default function GamingPage() {
  const { address } = useAccount()
  const { accessToken } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'pumpplay' | 'meme-royale' | 'mines' | 'arcade'>('pumpplay')
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'
  const apiKey = process.env.NEXT_PUBLIC_API_KEY || ''
  const [mounted, setMounted] = useState(false)

  // Platform Coins & User Holdings
  const [allCoins, setAllCoins] = useState<any[]>([])
  const [userCoins, setUserCoins] = useState<any[]>([])
  const [loadingCoins, setLoadingCoins] = useState(false)
  const [balanceChange, setBalanceChange] = useState<{ amount: number, token: string } | null>(null)

  // Global Coin Selection & Create Coin Modal
  const [selectedCoin, setSelectedCoin] = useState<string>('')
  const [isCreateCoinModalOpen, setIsCreateCoinModalOpen] = useState(false)

  // PumpPlay State
  const [rounds, setRounds] = useState<any[]>([])
  const [selectedRound, setSelectedRound] = useState<any>(null)
  const [betCoin, setBetCoin] = useState<string>('')
  const [betToken, setBetToken] = useState<string>('')
  const [betAmount, setBetAmount] = useState<string>('0.5')
  const [isBetting, setIsBetting] = useState(false)

  // Meme Royale State
  const [battles, setBattles] = useState<any[]>([])
  const [leftCoin, setLeftCoin] = useState<any>(null)
  const [rightCoin, setRightCoin] = useState<any>(null)
  const [stakeSide, setStakeSide] = useState<'left' | 'right' | ''>('')
  const [stakeToken, setStakeToken] = useState<string>('')
  const [stakeAmount, setStakeAmount] = useState<string>('0.5')
  const [battleResult, setBattleResult] = useState<any>(null)
  const [isBattling, setIsBattling] = useState(false)

  // Mines State
  const [minesGame, setMinesGame] = useState<any>(null)
  const [minesCount, setMinesCount] = useState<number>(3)
  const [minesBet, setMinesBet] = useState<string>('0.5')
  const [minesToken, setMinesToken] = useState<string>('')
  const [revealedTiles, setRevealedTiles] = useState<number[]>([])
  const [minePositions, setMinePositions] = useState<number[]>([])
  const [currentMultiplier, setCurrentMultiplier] = useState<number>(1.0)
  const [gameStatus, setGameStatus] = useState<'idle' | 'active' | 'won' | 'lost' | 'cashed'>('idle')
  const [minesHistory, setMinesHistory] = useState<any[]>([])

  // Coinflip State
  const [coinflipResult, setCoinflipResult] = useState<any>(null)
  const [flipWager, setFlipWager] = useState<string>('0.1')
  const [flipGuess, setFlipGuess] = useState<'heads' | 'tails'>('heads')
  const [flipToken, setFlipToken] = useState<string>('')
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [recent, setRecent] = useState<any[]>([])
  const [isFlipping, setIsFlipping] = useState(false)

  // Polygon Amoy DA Provenance State
  const [lastProvenanceHash, setLastProvenanceHash] = useState<string | null>(null)

  // Arena Hero Stats (derived from leaderboard + recent plays)
  const [activePlayers, setActivePlayers] = useState<number>(0)
  const [totalRewardsUSD, setTotalRewardsUSD] = useState<string>('0')

  // Wallet Balance Tracking
  const [nativeBalance, setNativeBalance] = useState<string>('0.0')
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)
  const coinsRequestInFlightRef = useRef(false)
  const scheduledRefreshRef = useRef<number[]>([])

  // Derived data: tokens created by the connected user
  const createdCoins = useMemo(() => {
    if (!address) return []
    return allCoins.filter(
      (c) =>
        typeof c.creator === 'string' &&
        c.creator.toLowerCase() === address.toLowerCase()
    )
  }, [address, allCoins])

  const userCoinKeys = useMemo(
    () => new Set(userCoins.map((coin) => getCoinKey(coin)).filter(Boolean)),
    [userCoins]
  )

  const platformOnlyCoins = useMemo(
    () => allCoins.filter((coin) => !userCoinKeys.has(getCoinKey(coin))),
    [allCoins, userCoinKeys]
  )

  const optimisticUpsertCoin = useCallback((tokenData: any) => {
    const optimisticCoin = {
      id: tokenData.txHash || tokenData.tokenAddress || `pending-${Date.now()}`,
      name: tokenData.name || 'Unknown Token',
      symbol: tokenData.symbol || 'UNKNOWN',
      tokenAddress: tokenData.tokenAddress || null,
      curveAddress: tokenData.curveAddress || null,
      imageHash: tokenData.imageHash || null,
      description: tokenData.description || '',
      createdAt: tokenData.createdAt || new Date().toISOString(),
      creator: tokenData.creator || address || 'Unknown',
      txHash: tokenData.txHash || null,
      supply: tokenData.supply || '0',
      isPending: !tokenData.tokenAddress,
    }

    setAllCoins((prev) => {
      const key = getCoinKey(optimisticCoin)
      const merged = [optimisticCoin, ...prev.filter((coin) => getCoinKey(coin) !== key)]
      return merged.sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      )
    })
  }, [address])

  // Load native MATIC balance
  const loadNativeBalance = useCallback(async () => {
    if (!address) return
    try {
      setIsLoadingBalance(true)
      const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_EVM_RPC || 'https://polygon-amoy.infura.io/v3/b4f237515b084d4bad4e5de070b0452f')
      const balance = await provider.getBalance(address)
      setNativeBalance(ethers.formatEther(balance))
      setIsLoadingBalance(false)
    } catch (e) {
      console.error('Failed to load balance:', e)
      setIsLoadingBalance(false)
    }
  }, [address])

  const signGamingAction = useCallback(
    async (action: string) => {
      if (!address) {
        throw new Error('Connect wallet first')
      }

      if (typeof window === 'undefined' || !(window as any).ethereum) {
        throw new Error('Wallet provider not found')
      }

      const provider = new ethers.BrowserProvider((window as any).ethereum)
      const signer = await provider.getSigner()
      const nonce = `${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`
      const message = generateSignMessage(address, action, nonce, Date.now())
      const signature = await signer.signMessage(message)

      return { signature, message, nonce }
    },
    [address]
  )

  const getErrorMessageFromResponse = useCallback(async (res: Response | null, fallback: string) => {
    if (!res) return fallback
    try {
      const payload = await res.json()
      if (payload?.error && typeof payload.error === 'string') {
        return payload.error
      }
      return fallback
    } catch {
      try {
        const text = await res.text()
        return text || fallback
      } catch {
        return fallback
      }
    }
  }, [])

  // Set mounted state on client
  useEffect(() => {
    setMounted(true)
  }, [])

  // Auto-refresh native balance
  useEffect(() => {
    if (!address) return
    void loadNativeBalance()
    const interval = setInterval(loadNativeBalance, 10000) // Refresh every 10s
    return () => clearInterval(interval)
  }, [address, loadNativeBalance])

  // Load platform coins and user holdings with real-time balance updates
  // Uses backend first, with Next.js API fallback.
  const loadCoinsData = useCallback(async (force = false) => {
    if (!address) return
    if (coinsRequestInFlightRef.current && !force) return

    coinsRequestInFlightRef.current = true
    setLoadingCoins(true)

    try {
      let response: Response | null = null
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)
        const timestamp = Date.now()

        response = await fetch(`${backend}/gaming/coins/${address}?t=${timestamp}`, {
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache'
          },
          signal: controller.signal
        })

        clearTimeout(timeoutId)
      } catch (fetchError: any) {
        if (
          fetchError.name === 'AbortError' ||
          fetchError.message?.includes('Failed to fetch') ||
          fetchError.message?.includes('ERR_CONNECTION_REFUSED')
        ) {
          response = null
        } else {
          throw fetchError
        }
      }

      if (!response || !response.ok) {
        try {
          const timestamp = Date.now()
          response = await fetch(`/api/gaming/coins/${address}?t=${timestamp}`, {
            cache: 'no-store',
            headers: {
              'Cache-Control': 'no-cache, no-store, must-revalidate',
              'Pragma': 'no-cache'
            }
          })
        } catch {
          console.warn('Both backend and API route failed, using empty data')
          setAllCoins([])
          setUserCoins([])
          return
        }
      }

      if (response && response.ok) {
        const data = await response.json()
        console.log(`Coins loaded: ${data.totalCoins || 0} total, ${data.coinsWithBalance || 0} with balance`)
        setAllCoins(data.coins || [])
        setUserCoins(data.userHoldings || [])
        void loadNativeBalance()
      } else {
        const errorText = response ? await response.text() : 'No response'
        console.error(`Failed to load coins: ${response?.status} ${response?.statusText}`, errorText)
        setAllCoins([])
        setUserCoins([])
      }
    } catch (e: any) {
      console.error('Error loading coins:', e)
      setAllCoins([])
      setUserCoins([])
    } finally {
      setLoadingCoins(false)
      coinsRequestInFlightRef.current = false
    }
  }, [address, backend, loadNativeBalance])

  const scheduleCoinRefreshes = useCallback((delays: number[] = [250, 1500]) => {
    if (typeof window === 'undefined') return
    scheduledRefreshRef.current.forEach((id) => window.clearTimeout(id))
    scheduledRefreshRef.current = delays.map((delay) =>
      window.setTimeout(() => {
        void loadCoinsData(true)
      }, delay)
    )
  }, [loadCoinsData])

  useEffect(() => {
    if (!address) return
    void loadCoinsData(true)
    const interval = setInterval(() => {
      void loadCoinsData()
    }, 10000)
    return () => clearInterval(interval)
  }, [address, loadCoinsData])

  useEffect(() => {
    return () => {
      if (typeof window === 'undefined') return
      scheduledRefreshRef.current.forEach((id) => window.clearTimeout(id))
      scheduledRefreshRef.current = []
    }
  }, [])

  // Listen for coin-creation events to reflect new coins instantly in gaming.
  useEffect(() => {
    if (!address || typeof window === 'undefined') return

    const applyCreatedCoin = (payload: any) => {
      if (!payload || typeof payload !== 'object') return
      optimisticUpsertCoin({
        ...payload,
        creator: payload.creator || address,
      })
      scheduleCoinRefreshes([300, 1400])
    }

    const onCoinCreated = (event: Event) => {
      const customEvent = event as CustomEvent<any>
      applyCreatedCoin(customEvent.detail)
    }

    const onStorage = (event: StorageEvent) => {
      if (event.key !== COIN_CREATED_STORAGE_KEY || !event.newValue) return
      try {
        const parsed = JSON.parse(event.newValue)
        applyCreatedCoin(parsed)
      } catch {
        // Ignore malformed storage payloads.
      }
    }

    window.addEventListener(COIN_CREATED_EVENT, onCoinCreated as EventListener)
    window.addEventListener('storage', onStorage)

    return () => {
      window.removeEventListener(COIN_CREATED_EVENT, onCoinCreated as EventListener)
      window.removeEventListener('storage', onStorage)
    }
  }, [address, optimisticUpsertCoin, scheduleCoinRefreshes])

  // Load PumpPlay rounds
  useEffect(() => {
    if (activeTab !== 'pumpplay') return
    const loadRounds = async () => {
      try {
        // Try backend first
        let response = await fetch(`${backend}/gaming/pumpplay/rounds`, {
          signal: AbortSignal.timeout(3000)
        }).catch(() => null)

        if (!response || !response.ok) {
          // Fallback to Next.js API
          response = await fetch('/api/gaming/pumpplay/rounds')
        }

        if (response && response.ok) {
          const data = await response.json()
          // Ensure timeRemaining is a valid number
          const roundsWithTime = (data.rounds || []).map((round: any) => ({
            ...round,
            timeRemaining: typeof round.timeRemaining === 'number' && !isNaN(round.timeRemaining)
              ? round.timeRemaining
              : round.endTime
                ? Math.max(0, new Date(round.endTime).getTime() - Date.now())
                : 0
          }))
          setRounds(roundsWithTime)
        }
      } catch (e) {
        console.warn('Failed to load rounds:', e)
      }
    }
    loadRounds()
    const interval = setInterval(loadRounds, 5000) // Update every 5 seconds for timer
    return () => clearInterval(interval)
  }, [activeTab, backend])

  // Load Meme Royale battles
  useEffect(() => {
    if (activeTab !== 'meme-royale') return
    const loadBattles = async () => {
      try {
        // Try backend first
        let response = await fetch(`${backend}/gaming/meme-royale/battles`, {
          signal: AbortSignal.timeout(3000)
        }).catch(() => null)

        if (!response || !response.ok) {
          // Fallback to Next.js API
          response = await fetch('/api/gaming/meme-royale/battles')
        }

        if (response && response.ok) {
          const data = await response.json()
          setBattles(data.battles || [])
        }
      } catch (e) {
        console.warn('Failed to load battles:', e)
      }
    }
    loadBattles()
    const interval = setInterval(loadBattles, 10000)
    return () => clearInterval(interval)
  }, [activeTab, backend])

  // Load Coinflip leaderboard
  useEffect(() => {
    if (activeTab !== 'arcade') return
    const load = async () => {
      try {
        // Try backend first, fallback to Next.js API
        const fetchWithFallback = async (path: string) => {
          try {
            const response = await fetch(`${backend}${path}`, {
              signal: AbortSignal.timeout(3000)
            })
            if (response.ok) return await response.json()
          } catch { }
          // Fallback
          const response = await fetch(`/api${path}`)
          return response.ok ? await response.json() : { leaderboard: [], recent: [] }
        }

        const [lb, rc] = await Promise.all([
          fetchWithFallback('/gaming/coinflip/leaderboard'),
          fetchWithFallback('/gaming/coinflip/recent')
        ])
        setLeaderboard(lb.leaderboard || [])
        setRecent(rc.recent || [])
        // Compute hero stats
        const uniquePlayers = new Set([
          ...(lb.leaderboard || []).map((r: any) => r.userAddress),
          ...(rc.recent || []).map((r: any) => r.userAddress),
        ])
        setActivePlayers(uniquePlayers.size || (lb.leaderboard?.length ?? 0))
        const totalWon = (rc.recent || [])
          .filter((r: any) => r.outcome === 'win')
          .reduce((sum: number, r: any) => sum + (parseFloat(r.wager || '0') * 2), 0)
        setTotalRewardsUSD(totalWon >= 1000 ? `${(totalWon / 1000).toFixed(1)}K` : totalWon.toFixed(2))

      } catch (e) {
        console.warn('Failed to load coinflip data:', e)
      }
    }
    load()
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [activeTab, backend])

  // PumpPlay: Place Bet
  const placeBet = async () => {
    if (!address || !selectedRound || !betCoin || !betToken) {
      return alert('Select round, coin to bet on, and token to stake')
    }

    setIsBetting(true)

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum)
      const signer = await provider.getSigner()
      const tokenContract = new ethers.Contract(
        betToken,
        [
          'function transfer(address to, uint256 amount) returns (bool)',
          'function balanceOf(address) view returns (uint256)',
          'function decimals() view returns (uint8)'
        ],
        signer
      )

      // Get token decimals (default to 18 if not available)
      let decimals = 18
      try {
        decimals = await tokenContract.decimals()
      } catch {
        // Use default 18 decimals
      }

      const amount = ethers.parseUnits(betAmount, decimals)

      // Check balance
      const balance = await tokenContract.balanceOf(address)
      if (balance < amount) {
        const balanceFormatted = ethers.formatUnits(balance, decimals)
        alert(`Insufficient token balance. You have ${balanceFormatted}, but need ${betAmount}`)
        setIsBetting(false)
        return
      }

      // Transfer stake to backend
      const backendWallet = '0x2dC274ABC0df37647CEd9212e751524708a68996'
      const signaturePayload = await signGamingAction('place a PumpPlay bet')
      console.log('Transferring bet stake...')
      const tx = await tokenContract.transfer(backendWallet, amount)
      await tx.wait()
      console.log('Stake transferred:', tx.hash)

      // Record bet - try backend first, fallback to Next.js API
      let res = await fetch(`${backend}/gaming/pumpplay/bet`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roundId: selectedRound.id,
          userAddress: address,
          coinId: betCoin,
          amount: parseFloat(betAmount),
          tokenAddress: betToken,
          txHash: tx.hash,
          ...signaturePayload
        }),
        signal: AbortSignal.timeout(5000)
      }).catch(() => null)

      if (!res || !res.ok) {
        // Fallback to Next.js API
        res = await fetch('/api/gaming/pumpplay/bet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            roundId: selectedRound.id,
            userAddress: address,
            coinId: betCoin,
            amount: parseFloat(betAmount),
            tokenAddress: betToken,
            txHash: tx.hash,
            ...signaturePayload
          })
        })
      }

      let data
      try {
        data = await res.json()
      } catch (e) {
        throw new Error('Invalid response from server')
      }

      if (data.success) {
        alert(`✅ Bet placed successfully!\n\nYou bet ${betAmount} tokens on ${selectedRound.coinDetails?.find((c: any) => c.id == betCoin)?.symbol || betCoin}\n\nWait for round to end!`)
        // Reload rounds and refresh balances
        setTimeout(() => {
          void loadCoinsData(true)
          void loadNativeBalance()
        }, 2000)
        setSelectedRound(null)
        setBetCoin('')
        setBetAmount('0.5')
      } else {
        alert(data.error || 'Bet failed')
      }
    } catch (e: any) {
      console.error('Bet error:', e)
      alert(e.message || 'Bet failed')
    } finally {
      setIsBetting(false)
    }
  }

  // Meme Royale: Start Battle
  const startBattle = async () => {
    if (!address) return alert('Connect wallet first')
    if (!leftCoin || !rightCoin) return alert('Select two coins to battle')
    if (leftCoin.id === rightCoin.id) return alert('Select different coins!')
    if (!stakeSide) return alert('Pick which side you think will win')
    if (!stakeToken) return alert('Select a token to stake')
    if (parseFloat(stakeAmount) <= 0) return alert('Stake amount must be > 0')

    setIsBattling(true)
    setBattleResult(null)

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum)
      const signer = await provider.getSigner()
      const tokenContract = new ethers.Contract(
        stakeToken,
        [
          'function transfer(address to, uint256 amount) returns (bool)',
          'function balanceOf(address) view returns (uint256)',
          'function decimals() view returns (uint8)'
        ],
        signer
      )

      // Get token decimals (default to 18 if not available)
      let decimals = 18
      try {
        decimals = await tokenContract.decimals()
      } catch {
        // Use default 18 decimals
      }

      const amount = ethers.parseUnits(stakeAmount, decimals)

      const balance = await tokenContract.balanceOf(address)
      if (balance < amount) {
        const balanceFormatted = ethers.formatUnits(balance, decimals)
        alert(`Insufficient token balance. You have ${balanceFormatted}, but need ${stakeAmount}`)
        setIsBattling(false)
        return
      }

      const backendWallet = '0x2dC274ABC0df37647CEd9212e751524708a68996'
      const signaturePayload = await signGamingAction('start a Meme Royale battle')

      console.log('Transferring stake...')
      const transferTx = await tokenContract.transfer(backendWallet, amount)
      await transferTx.wait()
      console.log('Stake transferred:', transferTx.hash)

      // Start AI battle - try backend first, fallback to Next.js API
      let res = await fetch(`${backend}/gaming/meme-royale`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leftCoin,
          rightCoin,
          userAddress: address,
          stakeAmount: parseFloat(stakeAmount),
          stakeSide,
          tokenAddress: stakeToken,
          txHash: transferTx.hash,
          ...signaturePayload
        }),
        signal: AbortSignal.timeout(5000)
      }).catch(() => null)

      if (!res || !res.ok) {
        // Fallback to Next.js API
        res = await fetch('/api/gaming/meme-royale/bet', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            leftCoin,
            rightCoin,
            userAddress: address,
            stakeAmount: parseFloat(stakeAmount),
            stakeSide,
            tokenAddress: stakeToken,
            txHash: transferTx.hash,
            ...signaturePayload
          })
        })
      }

      let data
      try {
        data = await res.json()
      } catch (e) {
        throw new Error('Invalid response from server')
      }

      if (!data.success) {
        throw new Error(data.error || 'Battle failed')
      }

      setBattleResult(data)

      if (data.judged) {
        const userWon = (stakeSide === 'left' && data.winner === 'left') || (stakeSide === 'right' && data.winner === 'right')

        if (userWon) {
          alert(`🎉 YOUR FIGHTER WON!\n\nWinner: ${data.winner === 'left' ? leftCoin.symbol : rightCoin.symbol}\n\nPayout: ${parseFloat(stakeAmount) * 1.8} tokens (1.8x)!\nTx: ${data.payoutTx?.slice(0, 10)}...`)
        } else {
          alert(`😢 Your Fighter Lost\n\nWinner: ${data.winner === 'left' ? leftCoin.symbol : rightCoin.symbol}\n\nBetter luck next time!`)
        }

        // Refresh balances immediately after battle
        setTimeout(() => {
          void loadCoinsData(true)
          void loadNativeBalance()
        }, 2000)
      }

    } catch (e: any) {
      console.error('Battle error:', e)
      alert(e.message || 'Battle failed')
    } finally {
      setIsBattling(false)
    }
  }

  // Coinflip: Play with real token
  const playCoinflip = async () => {
    if (!address) return alert('Connect wallet first')
    if (!flipToken) return alert('Select a token to stake')
    if (parseFloat(flipWager) <= 0) return alert('Wager must be > 0')

    setIsFlipping(true)
    setCoinflipResult(null)

    try {
      const provider = new ethers.BrowserProvider((window as any).ethereum)
      const signer = await provider.getSigner()
      const tokenContract = new ethers.Contract(
        flipToken,
        [
          'function transfer(address to, uint256 amount) returns (bool)',
          'function balanceOf(address) view returns (uint256)',
          'function decimals() view returns (uint8)'
        ],
        signer
      )

      // Get token decimals (default to 18 if not available)
      let decimals = 18
      try {
        decimals = await tokenContract.decimals()
      } catch {
        // Use default 18 decimals
      }

      const amount = ethers.parseUnits(flipWager, decimals)

      const balance = await tokenContract.balanceOf(address)
      if (balance < amount) {
        const balanceFormatted = ethers.formatUnits(balance, decimals)
        alert(`Insufficient token balance. You have ${balanceFormatted}, but need ${flipWager}`)
        setIsFlipping(false)
        return
      }

      const backendWallet = '0x2dC274ABC0df37647CEd9212e751524708a68996'
      const signaturePayload = await signGamingAction('play coinflip')

      console.log('Transferring stake...')
      const transferTx = await tokenContract.transfer(backendWallet, amount)
      await transferTx.wait()
      console.log('Stake transferred:', transferTx.hash)

      // Try backend first, fallback to Next.js API
      let res = await fetch(`${backend}/gaming/coinflip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userAddress: address,
          wager: parseFloat(flipWager),
          guess: flipGuess,
          tokenAddress: flipToken,
          txHash: transferTx.hash,
          ...signaturePayload
        }),
        signal: AbortSignal.timeout(5000)
      }).catch(() => null)

      if (!res || !res.ok) {
        // Fallback to Next.js API
        res = await fetch('/api/gaming/coinflip/play', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userAddress: address,
            wager: parseFloat(flipWager),
            choice: flipGuess, // API uses 'choice' not 'guess'
            tokenAddress: flipToken,
            txHash: transferTx.hash,
            ...signaturePayload
          })
        })
      }

      let data
      try {
        data = await res.json()
      } catch (e) {
        throw new Error('Invalid response from server')
      }

      if (!data.success) {
        throw new Error(data.error || 'Coinflip failed')
      }

      setCoinflipResult(data)

      if (data.provenanceHash) {
        setLastProvenanceHash(data.provenanceHash)
      }

      if (data.outcome === 'win') {
        alert(`🎉 YOU WON!\n\nResult: ${data.result.toUpperCase()}\n\nPayout of ${parseFloat(flipWager) * 2} tokens sent!\nTx: ${data.payoutTx?.slice(0, 10)}...\n\n✅ Game verified on Polygon`)
      } else {
        alert(`😢 You Lost\n\nResult: ${data.result.toUpperCase()}\n\nBetter luck next time!\n\n✅ Game verified on Polygon`)
      }

      // Refresh balances immediately after game ends
      setTimeout(() => {
        void loadCoinsData(true)
        void loadNativeBalance()
      }, 2000)

    } catch (e: any) {
      console.error('Coinflip error:', e)
      alert(e.message || 'Coinflip failed')
    } finally {
      setIsFlipping(false)
    }
  }

  const formatTime = (ms: number | undefined | null) => {
    if (!ms || isNaN(ms) || ms < 0) return '0:00'
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  // Avoid hydration mismatches by only rendering full UI on the client
  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#050816] text-purple-300">
        Loading Gaming Arena...
      </div>
    )
  }

  return (
    <div
      className="min-h-screen relative overflow-x-hidden text-slate-200 selection:bg-blue-500/30"
      style={{ background: 'radial-gradient(circle at top center, #0E1A35 0%, #0B1220 40%, #071029 100%)', backgroundAttachment: 'fixed' }}
      suppressHydrationWarning
    >
      {/* Ambient Lights */}
      <div className="fixed top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none z-0" />
      <div className="fixed bottom-[-20%] right-[-10%] w-[40vw] h-[40vw] rounded-full bg-purple-600/10 blur-[120px] pointer-events-none z-0" />
      {/* Particles */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute w-1 h-1 rounded-full bg-white/10 top-[20%] left-[15%] arena-float" />
        <div className="absolute w-1.5 h-1.5 rounded-full bg-blue-400/20 top-[60%] left-[10%] arena-float-delayed" />
        <div className="absolute w-0.5 h-0.5 rounded-full bg-white/10 top-[30%] right-[25%] arena-float" />
        <div className="absolute w-2 h-2 rounded-full bg-purple-400/20 top-[70%] right-[15%] arena-float-delayed" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6 pt-6 pb-24 flex flex-col gap-8" suppressHydrationWarning>

        {/* ── HEADER ── */}
        <header className="flex flex-col md:flex-row justify-between items-center gap-6 w-full">
          <div className="flex items-center gap-2">
            <a href="/" className="flex items-center justify-center w-10 h-10 rounded-xl arena-glass hover:bg-white/5 transition-colors">
              <span className="text-slate-400 text-base">&#8592;</span>
            </a>
            <div className="h-6 w-px bg-white/10 mx-2" />
            <div className="text-xl font-semibold tracking-tight text-white flex items-center gap-2">
              <img src="/pump-logo.jpg" alt="POL Pump" className="w-9 h-9 rounded-xl object-cover" />
              POLPUMP
            </div>
          </div>

          {/* Wallet Status Pill */}
          <div className="arena-glass rounded-full p-1.5 flex items-center gap-2 md:gap-4 pr-4 arena-border-glow transition-all hover:bg-white/[0.04]">
            <div className="flex items-center gap-2 bg-white/5 rounded-full px-3 py-1.5 border border-white/5">
              <span className="text-blue-400 text-sm">⬡</span>
              <span className="text-xs font-medium text-slate-300 tracking-tight">Polygon</span>
            </div>
            <div className="flex flex-col px-2">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Balance</span>
              <span className="text-sm font-semibold text-white tracking-tight flex items-center gap-1">
                {isLoadingBalance
                  ? <span className="animate-pulse text-xs text-slate-400">...</span>
                  : <>{parseFloat(nativeBalance).toFixed(2)} <span className="text-xs text-slate-400 font-medium">MATIC</span></>}
              </span>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="flex flex-col px-2">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Created</span>
              <span className="text-sm font-semibold text-white tracking-tight">{createdCoins.length} Coins</span>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="flex flex-col px-2">
              <span className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Holdings</span>
              <span className="text-sm font-semibold text-white tracking-tight">{userCoins.length} Coins</span>
            </div>
            <div className="w-px h-8 bg-white/10" />
            {address ? (
              <div className="flex items-center gap-2 pl-2">
                <div className="relative flex items-center justify-center w-6 h-6">
                  <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping" />
                  <div className="w-2 h-2 rounded-full bg-green-400 shadow-[0_0_8px_#4ade80]" />
                </div>
                <span className="text-sm font-medium text-slate-300 font-mono">{address.slice(0, 6)}&#8230;{address.slice(-4)}</span>
              </div>
            ) : (
              <div className="pl-2"><ConnectButton /></div>
            )}
          </div>
        </header>

        {/* ── HERO SECTION ── */}
        <section className="relative flex flex-col lg:flex-row items-center justify-between gap-10 min-h-[420px] py-8">
          {/* Left: Text + CTAs */}
          <div className="flex-1 z-10">
            {/* Gaming Mode Badge */}
            <div className="inline-flex items-center gap-2 arena-glass rounded-full px-4 py-2 mb-6 border border-white/10">
              <div className="w-2 h-2 rounded-full bg-blue-400 arena-pulse-glow" />
              <span className="text-sm text-slate-300 font-medium tracking-wide">Gaming Mode Active</span>
            </div>

            {/* Heading */}
            <h1 className="text-5xl md:text-7xl font-black leading-tight mb-6 tracking-tight">
              <span className="text-white">Enter the</span>
              <br />
              <span
                className="arena-text-gradient"
                style={{ WebkitTextFillColor: 'transparent', background: 'linear-gradient(135deg, #60A5FA 0%, #22D3EE 100%)', WebkitBackgroundClip: 'text', backgroundClip: 'text' }}
              >
                Gaming Arena
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-slate-400 text-lg md:text-xl leading-relaxed mb-10 max-w-lg">
              Play competitive on-chain games. Bet on live market pumps, win rounds, and earn with real tokens directly to your wallet.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap gap-4">
              <button
                onClick={() => {
                  document.getElementById('game-tabs')?.scrollIntoView({ behavior: 'smooth' })
                  setActiveTab('pumpplay')
                }}
                className="group flex items-center gap-3 px-7 py-3.5 rounded-full font-semibold text-white transition-all duration-300 shadow-[0_0_25px_rgba(59,130,246,0.25)] hover:shadow-[0_0_35px_rgba(59,130,246,0.45)] hover:scale-105"
                style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #22d3ee 100%)' }}
              >
                Start Playing
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </button>
              <button
                onClick={() => document.getElementById('game-tabs')?.scrollIntoView({ behavior: 'smooth' })}
                className="flex items-center gap-2 px-7 py-3.5 rounded-full font-semibold text-slate-300 hover:text-white arena-glass border border-white/10 hover:border-white/20 transition-all duration-300 hover:scale-105"
              >
                View Games
              </button>
            </div>
          </div>

          {/* Right: Holographic Circle + Stat Badges */}
          <div className="relative flex-shrink-0 w-72 h-72 lg:w-96 lg:h-96">
            {/* Outer glow ring */}
            <div className="absolute inset-0 rounded-full border border-blue-500/10" />
            {/* Spinning ring */}
            <div
              className="absolute inset-4 rounded-full border border-dashed border-blue-400/10 arena-spin-slow"
            />
            {/* Centre dark glass circle */}
            <div
              className="absolute inset-8 rounded-full flex items-center justify-center"
              style={{ background: 'radial-gradient(circle, rgba(15,23,42,0.9) 60%, rgba(30,41,59,0.5) 100%)', border: '1px solid rgba(59,130,246,0.15)' }}
            >
              {/* Trophy Icon */}
              <div className="arena-float text-7xl select-none" style={{ filter: 'drop-shadow(0 0 20px rgba(96,165,250,0.4))' }}>
                🏆
              </div>
            </div>

            {/* Floating Stat Badge — Active Players (top-right) */}
            <div className="absolute -top-3 -right-4 arena-glass-strong rounded-2xl px-4 py-3 border border-white/10 shadow-xl min-w-[140px] arena-float-delayed">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-blue-400" />
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Active Players</span>
              </div>
              <div className="text-2xl font-black text-white tabular-nums">
                {activePlayers > 0 ? activePlayers.toLocaleString() : allCoins.length > 0 ? (allCoins.length * 3 + rounds.length * 5) : '—'}
              </div>
            </div>

            {/* Floating Stat Badge — Total Rewards (bottom-left) */}
            <div className="absolute -bottom-3 -left-4 arena-glass-strong rounded-2xl px-4 py-3 border border-white/10 shadow-xl min-w-[160px] arena-float">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span className="text-[10px] text-slate-400 uppercase tracking-widest font-semibold">Total Rewards</span>
              </div>
              <div className="text-2xl font-black text-white tabular-nums">
                {totalRewardsUSD && totalRewardsUSD !== '0' ? `$${totalRewardsUSD}` : allCoins.length > 0 ? `$${(allCoins.length * 412.5).toFixed(1)}` : '$0'}
              </div>
            </div>

            {/* Background glow */}
            <div className="absolute inset-0 rounded-full bg-blue-500/5 blur-3xl pointer-events-none" />
          </div>
        </section>

        {/* ── DA PROVENANCE ── */}
        {lastProvenanceHash && (
          <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-xl border-2 border-cyan-400 rounded-2xl p-5 shadow-[0_0_30px_rgba(6,182,212,0.4)] animate-pulse">
            <div className="flex items-center gap-4">
              <div className="text-5xl animate-bounce drop-shadow-[0_0_10px_rgba(6,182,212,1)]">🔐</div>
              <div className="flex-1">
                <div className="font-black text-cyan-300 text-lg">GAME VERIFIED ON POLYGON AMOY</div>
                <div className="text-sm text-purple-300 font-semibold">Your last game result is permanently stored on decentralized storage</div>
                <div className="text-xs text-yellow-400 mt-1 font-mono break-all">{lastProvenanceHash}</div>
              </div>
              <a
                href={`${backend}/gaming/verify/${lastProvenanceHash}`}
                target="_blank"
                className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-6 py-3 rounded-xl hover:from-cyan-400 hover:to-blue-500 text-sm font-black whitespace-nowrap border-2 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.5)] transition-all duration-300"
              >
                VERIFY ↗
              </a>
            </div>
          </div>
        )}

        {/* Balance Change Notification */}
        {balanceChange && (

          <div className={`fixed top-20 right-6 z-50 ${balanceChange.amount > 0 ? 'bg-gradient-to-br from-green-400 to-emerald-600 border-green-300 shadow-[0_0_40px_rgba(34,197,94,0.8)]' : 'bg-gradient-to-br from-red-400 to-rose-600 border-red-300 shadow-[0_0_40px_rgba(239,68,68,0.8)]'} text-white px-8 py-5 rounded-2xl border-4 animate-bounce backdrop-blur-xl`}>
            <div className="text-3xl font-black drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]">
              {balanceChange.amount > 0 ? '🎉 +' : '😢 -'}{Math.abs(balanceChange.amount).toFixed(4)} {balanceChange.token}
            </div>
            <div className="text-base font-bold">{balanceChange.amount > 0 ? 'WINNING CREDITED!' : 'BET DEDUCTED'}</div>
          </div>
        )
        }

        {/* ── PLATFORM COINS & INVENTORY ── */}
        <div className="arena-glass rounded-2xl p-6 arena-border-glow">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <h2 className="text-xl font-semibold text-white mb-1 flex items-center gap-2">
                <span>🎮</span> Gaming with Platform Coins
              </h2>
              <p className="text-sm text-slate-400" suppressHydrationWarning>
                {mounted
                  ? `${allCoins.length} coins available • ${createdCoins.length} created • ${userCoins.length} in your wallet`
                  : 'Loading coins...'}
              </p>
            </div>
            {address && (
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    console.log('🔄 Manual refresh triggered')
                    void loadCoinsData(true)
                  }}
                  className="px-4 py-2.5 bg-gradient-to-r from-blue-500 to-cyan-600 hover:from-blue-600 hover:to-cyan-700 text-white font-bold rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200 border border-blue-400/50"
                  title="Refresh coins list"
                >
                  🔄 Refresh
                </button>
                <button
                  onClick={() => setIsCreateCoinModalOpen(true)}
                  className="px-5 py-2.5 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200 border border-green-400/50"
                >
                  ➕ Create Coin
                </button>
              </div>
            )}
          </div>

          {/* Improved Global Coin Selector */}
          {address && allCoins.length > 0 && (
            <div className="mb-6 p-5 bg-[#1a0b2e]/40 rounded-xl border border-purple-500/30 backdrop-blur-sm">
              <label className="block text-sm font-bold text-purple-300 mb-3 flex items-center gap-2">
                <span>🎯</span>
                <span>Select Coin for Gaming</span>
              </label>
              <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
                <select
                  value={selectedCoin}
                  onChange={(e) => {
                    const value = e.target.value
                    setSelectedCoin(value)
                    if (value) {
                      const lookup = value.toLowerCase()
                      const coin = userCoins.find((c) => getCoinKey(c) === lookup) ||
                        allCoins.find((c) => getCoinKey(c) === lookup)
                      if (coin) {
                        const selectedValue = coin.tokenAddress || coin.id || value
                        setBetToken(selectedValue)
                        setStakeToken(selectedValue)
                        setMinesToken(selectedValue)
                        setFlipToken(selectedValue)
                      }
                    }
                  }}
                  className="flex-1 border border-purple-400/50 rounded-lg px-4 py-3 font-medium bg-[#1a0b2e]/60 text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all"
                >
                  <option value="" className="bg-[#1a0b2e]">-- Select a coin to play with --</option>
                  {userCoins.length > 0 && (
                    <optgroup label="Your Coins (You Hold)" className="bg-[#1a0b2e]">
                      {userCoins.map((c) => (
                        <option key={c.tokenAddress || c.id} value={c.tokenAddress || c.id} className="bg-[#1a0b2e]">
                          {c.symbol || 'UNKNOWN'} ({parseFloat(c.balance || '0').toFixed(4)}) - {c.name || 'Unknown Token'}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {platformOnlyCoins.length > 0 && (
                    <optgroup label="All Platform Coins" className="bg-[#1a0b2e]">
                      {platformOnlyCoins.map((c) => (
                        <option key={c.tokenAddress || c.id || `pending-${c.id}`} value={c.tokenAddress || c.id || ''} className="bg-[#1a0b2e]" disabled={!c.tokenAddress}>
                          {c.symbol || 'UNKNOWN'} (0.0000) - {c.name || 'Unknown Token'} {!c.tokenAddress ? '- Pending Creation' : '- Buy first to play'}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                {selectedCoin && (
                  <div className="px-4 py-3 bg-green-500/20 border border-green-400/50 rounded-lg flex items-center gap-2">
                    <span className="text-green-400 text-xl">✓</span>
                    <span className="text-green-300 font-semibold text-sm">Selected</span>
                  </div>
                )}
              </div>
              {selectedCoin && (
                <p className="text-xs text-purple-300/70 mt-3 flex items-center gap-1">
                  <span>💡</span>
                  <span>This coin will be used for all games. Change it anytime above.</span>
                </p>
              )}
            </div>
          )}

          {!address && (
            <div className="text-center py-8">
              <p className="text-purple-300 font-semibold mb-2">Connect wallet to view your coins</p>
              <ConnectButton />
            </div>
          )}

          {address && loadingCoins && (
            <div className="text-center py-8">
              <p className="text-purple-300 animate-pulse font-semibold">Loading platform coins...</p>
            </div>
          )}

          {address && !loadingCoins && allCoins.length === 0 && userCoins.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-8">
              <p className="text-purple-300/80 text-center">No coins created yet. Create the first coin on the platform!</p>
              <button
                onClick={() => setIsCreateCoinModalOpen(true)}
                className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200 border border-green-400/50"
              >
                ➕ Create Coin
              </button>
            </div>
          )}

          {allCoins.length > 0 && (
            <div className="space-y-4">
              {userCoins.length > 0 && (
                <div>
                  <h3 className="text-sm font-bold text-green-400 mb-3 flex items-center gap-2">
                    <span>✅</span>
                    <span>Your Holdings ({userCoins.length})</span>
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {userCoins.map((c, i) => (
                      <div
                        key={i}
                        onClick={() => {
                          const tokenAddress = c.tokenAddress || c.id
                          if (tokenAddress) {
                            router.push(`/token/${tokenAddress}`)
                          }
                        }}
                        className="bg-green-500/10 border border-green-400/50 rounded-lg px-4 py-2.5 cursor-pointer hover:bg-green-500/20 hover:border-green-400 transition-all duration-200 hover:scale-105"
                      >
                        <div className="font-bold text-sm text-green-300">{c.symbol || 'UNKNOWN'}</div>
                        <div className="text-xs text-green-400/80">{parseFloat(c.balance || '0').toFixed(4)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <h3 className="text-sm font-bold text-purple-300 mb-3 flex items-center gap-2">
                  <span>📋</span>
                  <span>All Platform Coins ({allCoins.length})</span>
                </h3>
                <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                  {allCoins.slice(0, 20).map((c, i) => {
                    const tokenAddress = c.tokenAddress || c.id
                    const isPending = !c.tokenAddress || c.isPending
                    return (
                      <div
                        key={i}
                        onClick={() => {
                          if (tokenAddress && !isPending) {
                            router.push(`/token/${tokenAddress}`)
                          }
                        }}
                        className={`border rounded-lg px-3 py-2 text-xs transition-all duration-200 ${isPending
                          ? 'bg-yellow-500/10 border-yellow-400/30 text-yellow-300/70 cursor-not-allowed'
                          : c.hasBalance
                            ? 'bg-purple-500/10 border-purple-400/50 hover:bg-purple-500/20 text-purple-300 cursor-pointer hover:scale-105'
                            : 'bg-[#1a0b2e]/40 border-purple-500/20 hover:border-purple-500/40 text-purple-300/70 cursor-pointer hover:scale-105'
                          }`}
                        title={isPending ? 'Token creation pending - waiting for on-chain deployment' : undefined}
                      >
                        <span className="font-semibold">{c.symbol || 'UNKNOWN'}</span>
                        <span className="text-purple-400/60 ml-1">- {c.name || 'Unknown'}</span>
                        {isPending && <span className="text-yellow-400/80 ml-1 text-[10px]">⏳ Pending</span>}
                      </div>
                    )
                  })}
                  {allCoins.length > 20 && (
                    <div className="text-xs text-purple-400/60 px-3 py-2">+{allCoins.length - 20} more...</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── GAME TABS (pill style) ── */}
        <div id="game-tabs" className="arena-glass rounded-full p-1.5 flex items-center gap-1 overflow-x-auto hide-scrollbar w-fit">
          <button
            onClick={() => setActiveTab('pumpplay')}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'pumpplay'
              ? 'bg-gradient-to-r from-blue-500/30 to-purple-500/30 border border-blue-500/40 text-white shadow-[0_0_15px_rgba(59,130,246,0.15)]'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
          >
            🚀 PumpPlay
          </button>
          <button
            onClick={() => setActiveTab('meme-royale')}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'meme-royale'
              ? 'bg-gradient-to-r from-pink-500/30 to-red-500/30 border border-pink-500/40 text-white shadow-[0_0_15px_rgba(236,72,153,0.15)]'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
          >
            ⚔️ Meme Royale
          </button>
          <button
            onClick={() => setActiveTab('mines')}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'mines'
              ? 'bg-gradient-to-r from-orange-500/30 to-red-500/30 border border-orange-500/40 text-white shadow-[0_0_15px_rgba(249,115,22,0.15)]'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
          >
            💣 Mines
          </button>
          <button
            onClick={() => setActiveTab('arcade')}
            className={`rounded-full px-5 py-2 text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${activeTab === 'arcade'
              ? 'bg-gradient-to-r from-cyan-500/30 to-green-500/30 border border-cyan-500/40 text-white shadow-[0_0_15px_rgba(34,211,238,0.15)]'
              : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
          >
            🪙 Coinflip
          </button>
        </div>

        {/* ── PUMPPLAY PANEL ── */}
        {
          activeTab === 'pumpplay' && (
            <div className="arena-glass arena-border-glow rounded-2xl p-6 md:p-8">
              <div className="mb-6">
                <h2 className="text-3xl md:text-4xl font-bold mb-3 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 text-transparent bg-clip-text">
                  🎯 PumpPlay - Bet on the Pump
                </h2>
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                  <p className="text-blue-300 font-medium text-sm md:text-base">
                    <span className="font-bold">⚡ How it works:</span> Pick which coin will pump the most in the next 15 minutes.
                    All bets go into a pool. Winners split the pool proportionally! Real tokens, real payouts.
                  </p>
                </div>
              </div>

              {rounds.length === 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4 text-center">
                  <p className="text-yellow-300">⏳ Loading rounds or creating new one...</p>
                </div>
              )}

              {rounds.map((round) => (
                <div
                  key={round.id}
                  className={`border rounded-xl p-5 mb-4 transition-all ${selectedRound?.id === round.id
                    ? 'border-blue-500/50 bg-blue-500/10 shadow-lg'
                    : 'border-purple-500/30 bg-[#1a0b2e]/40 hover:border-blue-500/50 hover:bg-[#1a0b2e]/60 cursor-pointer'
                    }`}
                  onClick={() => !selectedRound && setSelectedRound(round)}
                >
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
                    <h3 className="font-bold text-xl text-white">Round #{round.id}</h3>
                    <div className="flex gap-2 items-center flex-wrap">
                      <span className="bg-green-500/20 text-green-400 border border-green-500/30 px-3 py-1 rounded-full text-xs font-semibold">
                        {round.status.toUpperCase()}
                      </span>
                      <span className="bg-purple-500/20 text-purple-400 border border-purple-500/30 px-3 py-1 rounded-full text-xs font-semibold">
                        ⏱ {formatTime(round.timeRemaining)}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
                    {round.coinDetails?.map((coin: any) => {
                      const totalBet = round.bets?.find((b: any) => b.coinId === coin.id)?.total || 0
                      const isSelected = betCoin == coin.id
                      return (
                        <div
                          key={coin.id}
                          className={`border rounded-lg p-4 transition-all cursor-pointer hover:scale-105 ${isSelected
                            ? 'border-blue-500/50 bg-blue-500/10'
                            : 'border-purple-500/30 bg-[#1a0b2e]/40 hover:border-purple-500/50'
                            }`}
                          onClick={(e) => {
                            e.stopPropagation()
                            const tokenAddress = coin.tokenAddress || coin.id
                            if (tokenAddress) {
                              router.push(`/token/${tokenAddress}`)
                            }
                          }}
                        >
                          <div className="font-bold text-lg text-white hover:text-blue-400 transition-colors">{coin.symbol}</div>
                          <div className="text-xs text-purple-300/70 mb-2">{coin.name}</div>
                          <div className="text-sm font-semibold text-green-400">
                            💰 Pool: {totalBet.toFixed(2)} tokens
                          </div>
                        </div>
                      )
                    })}
                  </div>

                  {selectedRound?.id === round.id && (
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-5 mt-4">
                      <h4 className="font-bold text-lg mb-4 text-white flex items-center gap-2">
                        <span>🎲</span>
                        <span>Place Your Bet</span>
                      </h4>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-semibold mb-2 text-purple-300">Which Coin Will Pump?</label>
                          <select
                            value={betCoin}
                            onChange={(e) => setBetCoin(e.target.value)}
                            className="w-full border border-purple-500/30 rounded-lg px-3 py-2.5 font-medium bg-[#1a0b2e]/60 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            disabled={isBetting}
                          >
                            <option value="" className="bg-[#1a0b2e]">Select coin...</option>
                            {round.coinDetails?.map((c: any) => (
                              <option key={c.id} value={c.id} className="bg-[#1a0b2e]">{c.symbol} - {c.name}</option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold mb-2 text-purple-300">Token to Stake</label>
                          <select
                            value={betToken || selectedCoin}
                            onChange={(e) => {
                              setBetToken(e.target.value)
                              setSelectedCoin(e.target.value)
                            }}
                            className="w-full border border-purple-500/30 rounded-lg px-3 py-2.5 font-medium bg-[#1a0b2e]/60 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            disabled={isBetting}
                          >
                            <option value="" className="bg-[#1a0b2e]">Select your coin...</option>
                            {userCoins.map((c) => (
                              <option key={c.tokenAddress || c.id} value={c.tokenAddress || c.id} className="bg-[#1a0b2e]">
                                {c.symbol || 'UNKNOWN'} ({parseFloat(c.balance || '0').toFixed(4)}) - {c.name || 'Unknown Token'}
                              </option>
                            ))}
                          </select>
                          {userCoins.length === 0 && (
                            <p className="text-xs text-red-400 mt-1">You don't hold any coins. Buy some first!</p>
                          )}
                          {selectedCoin && (
                            <p className="text-xs text-blue-400 mt-1">💡 Using globally selected coin</p>
                          )}
                        </div>

                        <div>
                          <label className="block text-sm font-semibold mb-2 text-purple-300">Amount</label>
                          <input
                            type="number"
                            value={betAmount}
                            onChange={(e) => setBetAmount(e.target.value)}
                            step="0.1"
                            min="0.1"
                            className="w-full border border-purple-500/30 rounded-lg px-3 py-2.5 font-medium bg-[#1a0b2e]/60 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            disabled={isBetting}
                          />
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button
                          onClick={placeBet}
                          disabled={!address || !betCoin || !betToken || isBetting}
                          className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold shadow-lg transition-all transform hover:scale-105"
                        >
                          {isBetting ? '🔄 Placing Bet...' : '🎲 Place Bet Now!'}
                        </button>
                        <button
                          onClick={() => {
                            setSelectedRound(null)
                            setBetCoin('')
                            setBetToken('')
                          }}
                          className="px-6 py-3 bg-[#1a0b2e]/60 text-purple-300 border border-purple-500/30 rounded-lg hover:bg-[#1a0b2e]/80 font-semibold transition-all"
                          disabled={isBetting}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <div className="mt-6 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <h3 className="font-semibold text-yellow-400 mb-3 flex items-center gap-2">
                  <span>ℹ️</span>
                  <span>How Payouts Work</span>
                </h3>
                <ul className="text-sm text-yellow-300/80 space-y-2">
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>All bets go into a shared pool</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>When round ends, the coin that pumped most wins</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>Winners split the entire pool based on their bet size</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>Automatic payouts sent to your wallet</span>
                  </li>
                </ul>
              </div>
            </div>
          )
        }

        {/* Improved Meme Royale Tab */}
        {
          activeTab === 'meme-royale' && (
            <div className="bg-gradient-to-br from-[#1a0b2e]/60 to-[#16213e]/60 backdrop-blur-xl border border-pink-500/30 rounded-2xl p-6 md:p-8 shadow-xl">
              <div className="mb-6">
                <h2 className="text-3xl md:text-4xl font-bold mb-3 bg-gradient-to-r from-pink-400 via-purple-400 to-red-400 text-transparent bg-clip-text">
                  ⚔️ Meme Royale - AI Battle Arena
                </h2>
                <div className="bg-pink-500/10 border border-pink-500/30 rounded-lg p-4">
                  <p className="text-pink-300 font-medium text-sm md:text-base">
                    <span className="font-bold">⚡ How it works:</span> Pick two coins to battle. AI judges them on virality, trend fit, and creativity.
                    Stake tokens on your pick - win = 1.8x payout! Powered by POL Pump AI.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                <div className={`border rounded-xl p-5 transition-all ${stakeSide === 'left'
                  ? 'border-blue-500/50 bg-blue-500/10'
                  : 'border-purple-500/30 bg-[#1a0b2e]/40'
                  }`}>
                  <h3 className="font-bold text-lg mb-3 text-white">🥊 Left Fighter</h3>
                  <select
                    value={leftCoin?.id || ''}
                    onChange={(e) => {
                      const coin = allCoins.find(c => c.id === parseInt(e.target.value))
                      setLeftCoin(coin ? { ...coin, id: coin.id } : null)
                    }}
                    className="w-full border border-purple-500/30 rounded-lg px-3 py-2.5 mb-3 font-medium bg-[#1a0b2e]/60 text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    disabled={isBattling}
                  >
                    <option value="" className="bg-[#1a0b2e]">Select fighter...</option>
                    {allCoins.map((c) => (
                      <option key={c.id} value={c.id} className="bg-[#1a0b2e]">{c.symbol} - {c.name} {c.hasBalance ? '✓' : ''}</option>
                    ))}
                  </select>
                  {leftCoin && (
                    <div className="bg-[#1a0b2e]/60 border border-purple-500/30 rounded-lg p-4">
                      <div
                        onClick={() => {
                          const tokenAddress = leftCoin.tokenAddress || leftCoin.id
                          if (tokenAddress) {
                            router.push(`/token/${tokenAddress}`)
                          }
                        }}
                        className="font-bold text-xl text-blue-400 cursor-pointer hover:text-blue-300 hover:underline transition-colors mb-2"
                      >
                        {leftCoin.symbol}
                      </div>
                      <div
                        onClick={() => {
                          const tokenAddress = leftCoin.tokenAddress || leftCoin.id
                          if (tokenAddress) {
                            router.push(`/token/${tokenAddress}`)
                          }
                        }}
                        className="text-sm text-purple-300/70 mb-3 cursor-pointer hover:text-purple-300 hover:underline transition-colors"
                      >
                        {leftCoin.name}
                      </div>
                      <button
                        onClick={() => setStakeSide('left')}
                        disabled={isBattling}
                        className={`w-full py-2.5 rounded-lg font-semibold transition-all ${stakeSide === 'left'
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'bg-[#1a0b2e]/60 text-purple-300 border border-purple-500/30 hover:bg-[#1a0b2e]/80'
                          }`}
                      >
                        {stakeSide === 'left' ? '✅ Betting on LEFT' : 'Bet on LEFT'}
                      </button>
                    </div>
                  )}
                </div>

                <div className={`border rounded-xl p-5 transition-all ${stakeSide === 'right'
                  ? 'border-pink-500/50 bg-pink-500/10'
                  : 'border-purple-500/30 bg-[#1a0b2e]/40'
                  }`}>
                  <h3 className="font-bold text-lg mb-3 text-white">🥊 Right Fighter</h3>
                  <select
                    value={rightCoin?.id || ''}
                    onChange={(e) => {
                      const coin = allCoins.find(c => c.id === parseInt(e.target.value))
                      setRightCoin(coin ? { ...coin, id: coin.id } : null)
                    }}
                    className="w-full border border-purple-500/30 rounded-lg px-3 py-2.5 mb-3 font-medium bg-[#1a0b2e]/60 text-white focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    disabled={isBattling}
                  >
                    <option value="" className="bg-[#1a0b2e]">Select fighter...</option>
                    {allCoins.map((c) => (
                      <option key={c.id} value={c.id} className="bg-[#1a0b2e]">{c.symbol} - {c.name} {c.hasBalance ? '✓' : ''}</option>
                    ))}
                  </select>
                  {rightCoin && (
                    <div className="bg-[#1a0b2e]/60 border border-purple-500/30 rounded-lg p-4">
                      <div
                        onClick={() => {
                          const tokenAddress = rightCoin.tokenAddress || rightCoin.id
                          if (tokenAddress) {
                            router.push(`/token/${tokenAddress}`)
                          }
                        }}
                        className="font-bold text-xl text-pink-400 cursor-pointer hover:text-pink-300 hover:underline transition-colors mb-2"
                      >
                        {rightCoin.symbol}
                      </div>
                      <div
                        onClick={() => {
                          const tokenAddress = rightCoin.tokenAddress || rightCoin.id
                          if (tokenAddress) {
                            router.push(`/token/${tokenAddress}`)
                          }
                        }}
                        className="text-sm text-purple-300/70 mb-3 cursor-pointer hover:text-purple-300 hover:underline transition-colors"
                      >
                        {rightCoin.name}
                      </div>
                      <button
                        onClick={() => setStakeSide('right')}
                        disabled={isBattling}
                        className={`w-full py-2.5 rounded-lg font-semibold transition-all ${stakeSide === 'right'
                          ? 'bg-pink-600 text-white shadow-lg'
                          : 'bg-[#1a0b2e]/60 text-purple-300 border border-purple-500/30 hover:bg-[#1a0b2e]/80'
                          }`}
                      >
                        {stakeSide === 'right' ? '✅ Betting on RIGHT' : 'Bet on RIGHT'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-purple-300">Token to Stake</label>
                  <select
                    value={stakeToken || selectedCoin}
                    onChange={(e) => {
                      setStakeToken(e.target.value)
                      setSelectedCoin(e.target.value)
                    }}
                    className="w-full border border-purple-500/30 rounded-lg px-3 py-2.5 font-medium bg-[#1a0b2e]/60 text-white focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    disabled={isBattling}
                  >
                    <option value="" className="bg-[#1a0b2e]">Select your coin...</option>
                    {userCoins.map((c) => (
                      <option key={c.tokenAddress || c.id} value={c.tokenAddress || c.id} className="bg-[#1a0b2e]">
                        {c.symbol || 'UNKNOWN'} ({parseFloat(c.balance || '0').toFixed(4)}) - {c.name || 'Unknown Token'}
                      </option>
                    ))}
                  </select>
                  {userCoins.length === 0 && (
                    <p className="text-xs text-red-400 mt-1">You don't hold any coins. Buy some first!</p>
                  )}
                  {selectedCoin && (
                    <p className="text-xs text-blue-400 mt-1">💡 Using globally selected coin</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2 text-purple-300">Stake Amount</label>
                  <input
                    type="number"
                    value={stakeAmount}
                    onChange={(e) => setStakeAmount(e.target.value)}
                    step="0.1"
                    min="0.1"
                    className="w-full border border-purple-500/30 rounded-lg px-3 py-2.5 font-medium bg-[#1a0b2e]/60 text-white focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                    disabled={isBattling}
                  />
                </div>
              </div>

              <button
                onClick={startBattle}
                disabled={!address || !leftCoin || !rightCoin || !stakeSide || !stakeToken || isBattling}
                className="w-full bg-gradient-to-r from-red-600 to-purple-600 text-white px-10 py-4 rounded-lg hover:from-red-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg shadow-lg mb-6 transition-all transform hover:scale-105"
              >
                {isBattling ? '🔄 AI Judging Battle...' : '⚔️ START BATTLE!'}
              </button>

              {battleResult && battleResult.judged && (
                <div className="bg-gradient-to-br from-green-500/10 to-blue-500/10 border border-green-500/30 rounded-xl p-6 mb-6">
                  <h3 className="text-2xl font-bold mb-4 text-center text-white">🏆 Battle Results - AI Judge</h3>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
                    <div className={`border rounded-xl p-4 transition-all ${battleResult.winner === 'left'
                      ? 'border-green-500/50 bg-green-500/10'
                      : 'border-purple-500/30 bg-[#1a0b2e]/40'
                      }`}>
                      <div
                        onClick={() => {
                          const tokenAddress = leftCoin.tokenAddress || leftCoin.id
                          if (tokenAddress) {
                            router.push(`/token/${tokenAddress}`)
                          }
                        }}
                        className="font-bold text-xl mb-2 text-blue-400 cursor-pointer hover:text-blue-300 hover:underline transition-colors"
                      >
                        {leftCoin.symbol}
                      </div>
                      <div className="text-4xl font-bold text-blue-400 mb-2">{battleResult.judged.left?.total || 0}/30</div>
                      <div className="text-xs space-y-1 text-purple-300/80">
                        <div>Virality: {battleResult.judged.left?.virality || 0}/10</div>
                        <div>Trend: {battleResult.judged.left?.trend || 0}/10</div>
                        <div>Creativity: {battleResult.judged.left?.creativity || 0}/10</div>
                      </div>
                      <div className="text-sm text-purple-300/70 mt-3 italic">
                        "{battleResult.judged.left?.reasons || 'No reasons'}"
                      </div>
                    </div>

                    <div className={`border rounded-xl p-4 transition-all ${battleResult.winner === 'right'
                      ? 'border-green-500/50 bg-green-500/10'
                      : 'border-purple-500/30 bg-[#1a0b2e]/40'
                      }`}>
                      <div
                        onClick={() => {
                          const tokenAddress = rightCoin.tokenAddress || rightCoin.id
                          if (tokenAddress) {
                            router.push(`/token/${tokenAddress}`)
                          }
                        }}
                        className="font-bold text-xl mb-2 text-pink-400 cursor-pointer hover:text-pink-300 hover:underline transition-colors"
                      >
                        {rightCoin.symbol}
                      </div>
                      <div className="text-4xl font-bold text-pink-400 mb-2">{battleResult.judged.right?.total || 0}/30</div>
                      <div className="text-xs space-y-1 text-purple-300/80">
                        <div>Virality: {battleResult.judged.right?.virality || 0}/10</div>
                        <div>Trend: {battleResult.judged.right?.trend || 0}/10</div>
                        <div>Creativity: {battleResult.judged.right?.creativity || 0}/10</div>
                      </div>
                      <div className="text-sm text-purple-300/70 mt-3 italic">
                        "{battleResult.judged.right?.reasons || 'No reasons'}"
                      </div>
                    </div>
                  </div>

                  <div className="text-center bg-[#1a0b2e]/60 border border-green-500/30 rounded-xl p-4">
                    <div className="text-2xl font-bold mb-2 text-white">
                      🏆 WINNER: <span className="text-green-400">
                        {battleResult.winner === 'left' ? leftCoin.symbol : rightCoin.symbol}
                      </span>
                    </div>
                    {battleResult.payoutTx && (
                      <div className="text-green-400 font-semibold">
                        💰 You won {parseFloat(stakeAmount) * 1.8} tokens!
                        <div className="text-xs text-purple-300/70 font-mono mt-1">
                          Tx: {battleResult.payoutTx.slice(0, 10)}...{battleResult.payoutTx.slice(-8)}
                        </div>
                      </div>
                    )}
                    <div className="text-xs text-purple-300/70 mt-2">Judged by POL Pump AI</div>
                  </div>
                </div>
              )}

              <div>
                <h3 className="font-semibold mb-3 text-lg text-white">📜 Recent Battles</h3>
                <div className="space-y-2">
                  {battles.map((b) => (
                    <div key={b.id} className="bg-[#1a0b2e]/40 border border-purple-500/30 rounded-lg p-3 flex justify-between items-center hover:bg-[#1a0b2e]/60 transition-all">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-white">{b.leftSymbol}</span>
                        <span className="text-purple-400">vs</span>
                        <span className="font-semibold text-white">{b.rightSymbol}</span>
                      </div>
                      <div className="text-sm flex items-center gap-3">
                        <span className={b.leftScore > b.rightScore ? 'text-green-400 font-bold' : 'text-purple-300/70'}>
                          {b.leftScore}
                        </span>
                        <span className="text-purple-400">-</span>
                        <span className={b.rightScore > b.leftScore ? 'text-green-400 font-bold' : 'text-purple-300/70'}>
                          {b.rightScore}
                        </span>
                        <span className="text-xs text-purple-300/70">
                          🏆 {b.leftScore > b.rightScore ? b.leftSymbol : b.rightSymbol}
                        </span>
                      </div>
                    </div>
                  ))}
                  {battles.length === 0 && <p className="text-purple-300/70 text-center py-4">No battles yet - be the first!</p>}
                </div>
              </div>

              <div className="mt-6 bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
                <h3 className="font-semibold text-purple-400 mb-3 flex items-center gap-2">
                  <span>ℹ️</span>
                  <span>Battle Rules</span>
                </h3>
                <ul className="text-sm text-purple-300/80 space-y-2">
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>AI judges coins on 3 criteria: Virality, Trend Fit, Creativity (each 0-10)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>Highest total score wins the battle</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>Win your bet = 1.8x payout (house takes 10% fee)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>Powered by POL Pump AI - decentralized trading platform</span>
                  </li>
                </ul>
              </div>
            </div>
          )
        }

        {/* Improved Mines Tab */}
        {
          activeTab === 'mines' && (
            <div className="bg-gradient-to-br from-[#1a0b2e]/60 to-[#16213e]/60 backdrop-blur-xl border border-orange-500/30 rounded-2xl p-6 md:p-8 shadow-xl">
              <div className="mb-6">
                <h2 className="text-3xl md:text-4xl font-bold mb-3 bg-gradient-to-r from-orange-400 via-red-400 to-pink-400 text-transparent bg-clip-text">
                  💣 Mines - Reveal & Win
                </h2>
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                  <p className="text-orange-300 font-medium text-sm md:text-base">
                    <span className="font-bold">⚡ How it works:</span> Click tiles to reveal gems 💎. Avoid bombs 💣! Cash out anytime with progressive multipliers. More mines = higher risk & reward!
                  </p>
                </div>
              </div>

              {gameStatus === 'idle' && (
                <div className="max-w-2xl mx-auto">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-purple-300">Mines Count</label>
                      <select
                        value={minesCount}
                        onChange={(e) => setMinesCount(parseInt(e.target.value))}
                        className="w-full border border-purple-500/30 rounded-lg px-3 py-2.5 font-medium bg-[#1a0b2e]/60 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      >
                        {[1, 3, 5, 10, 15, 20, 24].map(n => (
                          <option key={n} value={n} className="bg-[#1a0b2e]">{n} Mines ({(n / 25 * 100).toFixed(0)}%)</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-purple-300">Token to Stake</label>
                      <select
                        value={minesToken || selectedCoin}
                        onChange={(e) => {
                          setMinesToken(e.target.value)
                          setSelectedCoin(e.target.value)
                        }}
                        className="w-full border border-purple-500/30 rounded-lg px-3 py-2.5 font-medium bg-[#1a0b2e]/60 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      >
                        <option value="" className="bg-[#1a0b2e]">Select coin...</option>
                        {userCoins.map((c) => (
                          <option key={c.tokenAddress || c.id} value={c.tokenAddress || c.id} className="bg-[#1a0b2e]">
                            {c.symbol || 'UNKNOWN'} ({parseFloat(c.balance || '0').toFixed(4)})
                          </option>
                        ))}
                      </select>
                      {selectedCoin && (
                        <p className="text-xs text-blue-400 mt-1">💡 Using globally selected coin</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-semibold mb-2 text-purple-300">Bet Amount</label>
                      <input
                        type="number"
                        value={minesBet}
                        onChange={(e) => setMinesBet(e.target.value)}
                        step="0.1"
                        min="0.1"
                        className="w-full border border-purple-500/30 rounded-lg px-3 py-2.5 font-medium bg-[#1a0b2e]/60 text-white focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      />
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      if (!address || !minesToken || parseFloat(minesBet) <= 0) {
                        return alert('Connect wallet and select token/amount')
                      }
                      try {
                        const provider = new ethers.BrowserProvider((window as any).ethereum)
                        const signer = await provider.getSigner()
                        const tokenContract = new ethers.Contract(
                          minesToken,
                          [
                            'function transfer(address to, uint256 amount) returns (bool)',
                            'function balanceOf(address) view returns (uint256)',
                            'function decimals() view returns (uint8)'
                          ],
                          signer
                        )

                        // Get token decimals
                        let decimals = 18
                        try {
                          decimals = await tokenContract.decimals()
                        } catch {
                          // Use default 18 decimals
                        }

                        const amount = ethers.parseUnits(minesBet, decimals)

                        // Check balance
                        const balance = await tokenContract.balanceOf(address)
                        if (balance < amount) {
                          const balanceFormatted = ethers.formatUnits(balance, decimals)
                          alert(`Insufficient token balance. You have ${balanceFormatted}, but need ${minesBet}`)
                          return
                        }

                        const tx = await tokenContract.transfer('0x2dC274ABC0df37647CEd9212e751524708a68996', amount)
                        await tx.wait()
                        const signaturePayload = await signGamingAction('start mines game')

                        // Try backend first, fallback to Next.js API
                        let res = await fetch(`${backend}/gaming/mines/start`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            userAddress: address,
                            betAmount: parseFloat(minesBet),
                            minesCount,
                            tokenAddress: minesToken,
                            txHash: tx.hash,
                            ...signaturePayload
                          }),
                          signal: AbortSignal.timeout(5000)
                        }).catch(() => null)

                        if (!res || !res.ok) {
                          // Fallback to Next.js API
                          res = await fetch('/api/gaming/mines/start', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              userAddress: address,
                              betAmount: parseFloat(minesBet),
                              minesCount,
                              tokenAddress: minesToken,
                              txHash: tx.hash,
                              ...signaturePayload
                            })
                          })
                        }

                        if (!res || !res.ok) {
                          const errorMessage = await getErrorMessageFromResponse(
                            res,
                            'Failed to start game. Please try again.'
                          )
                          throw new Error(errorMessage)
                        }

                        let data
                        try {
                          data = await res.json()
                        } catch (e) {
                          throw new Error('Invalid response from server')
                        }

                        if (data.success) {
                          setMinesGame(data)
                          setGameStatus('active')
                          setRevealedTiles([])
                          setMinePositions([])
                          setCurrentMultiplier(1.0)
                        } else {
                          alert(data.error || 'Failed to start game')
                        }
                      } catch (e: any) {
                        console.error('Start game error:', e)
                        alert(e.message || 'Failed to start game. Please check your connection and try again.')
                      }
                    }}
                    disabled={!address || !minesToken}
                    className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white px-8 py-4 rounded-lg hover:from-orange-700 hover:to-red-700 disabled:opacity-50 font-bold text-lg shadow-lg transition-all transform hover:scale-105"
                  >
                    💣 Start Game
                  </button>
                </div>
              )}

              {gameStatus === 'active' && (
                <div>
                  <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mb-6 bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                    <div>
                      <div className="text-sm text-orange-300/80">Multiplier</div>
                      <div className="text-3xl font-bold text-orange-400">{currentMultiplier.toFixed(2)}x</div>
                    </div>
                    <div>
                      <div className="text-sm text-orange-300/80">Potential Win</div>
                      <div className="text-2xl font-bold text-green-400">{(parseFloat(minesBet) * currentMultiplier).toFixed(4)}</div>
                    </div>
                    <button
                      onClick={async () => {
                        if (!address) {
                          alert('Please connect your wallet first')
                          return
                        }
                        try {
                          const signaturePayload = await signGamingAction('cash out mines game')
                          // Try backend first
                          let res = await fetch(`${backend}/gaming/mines/cashout`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              gameId: minesGame.gameId,
                              userAddress: address,
                              ...signaturePayload
                            }),
                            signal: AbortSignal.timeout(5000)
                          }).catch(() => null)

                          // Fallback to Next.js API
                          if (!res || !res.ok) {
                            res = await fetch('/api/gaming/mines/cashout', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                gameId: minesGame.gameId,
                                userAddress: address,
                                ...signaturePayload
                              })
                            })
                          }

                          if (!res || !res.ok) {
                            const errorMessage = await getErrorMessageFromResponse(
                              res,
                              'Failed to cash out. Please try again.'
                            )
                            throw new Error(errorMessage)
                          }

                          const data = await res.json();
                          if (data.success) {
                            setGameStatus('cashed');
                            alert(`💰 Cashed out ${data.cashoutAmount.toFixed(4)} tokens!`);
                            setTimeout(() => {
                              void loadCoinsData(true)
                            }, 2000);
                          } else {
                            alert(data.error || 'Failed to cash out')
                          }
                        } catch (e: any) {
                          console.error('Cashout error:', e)
                          alert(e.message || 'Failed to cash out. Please try again.')
                        }
                      }}
                      disabled={revealedTiles.length === 0 || !address}
                      className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 font-bold transition-all"
                    >
                      💰 Cash Out
                    </button>
                  </div>
                  <div className="grid grid-cols-5 gap-2 mb-4">
                    {Array.from({ length: 25 }, (_, i) => {
                      const isRevealed = revealedTiles.includes(i);
                      const isMine = minePositions.includes(i);
                      return (
                        <button
                          key={i}
                          onClick={async () => {
                            if (isRevealed || !address) return;
                            try {
                              const signaturePayload = await signGamingAction('reveal mines tile')
                              // Try backend first
                              let res = await fetch(`${backend}/gaming/mines/reveal`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                  gameId: minesGame.gameId,
                                  tileIndex: i,
                                  userAddress: address,
                                  ...signaturePayload
                                }),
                                signal: AbortSignal.timeout(5000)
                              }).catch(() => null)

                              // Fallback to Next.js API
                              if (!res || !res.ok) {
                                res = await fetch('/api/gaming/mines/reveal', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  body: JSON.stringify({
                                    gameId: minesGame.gameId,
                                    tileIndex: i,
                                    userAddress: address,
                                    ...signaturePayload
                                  })
                                })
                              }

                              if (!res || !res.ok) {
                                const errorMessage = await getErrorMessageFromResponse(
                                  res,
                                  'Failed to reveal tile. Please try again.'
                                )
                                throw new Error(errorMessage)
                              }

                              const data = await res.json();

                              if (!data.success) {
                                throw new Error(data.error || 'Failed to reveal tile')
                              }

                              // Handle game over (hit mine)
                              if (data.gameOver && data.isMine) {
                                // Extract all mine positions from gridState
                                const allMines = data.gridState?.filter((t: any) => t.isMine).map((t: any) => t.index) || []
                                setRevealedTiles(data.revealedTiles || []);
                                setMinePositions(allMines);
                                setGameStatus('lost');
                                alert('💥 BOOM!');
                              } else if (data.gameOver && data.won) {
                                // Game won - all safe tiles revealed
                                const allMines = data.gridState?.filter((t: any) => t.isMine).map((t: any) => t.index) || []
                                setRevealedTiles(data.revealedTiles || []);
                                setMinePositions(allMines);
                                setGameStatus('won');
                                alert('🎉 WON!');
                              } else {
                                // Continue playing
                                setRevealedTiles(data.revealedTiles || []);
                                if (data.currentMultiplier) {
                                  setCurrentMultiplier(data.currentMultiplier);
                                }
                              }
                            } catch (e: any) {
                              console.error('Reveal error:', e)
                              alert(e.message || 'Failed to reveal tile. Please try again.')
                            }
                          }}
                          disabled={isRevealed || !address}
                          className={`aspect-square text-2xl font-bold rounded-lg transition-all ${isRevealed
                            ? (isMine ? 'bg-red-500 text-white' : 'bg-green-500 text-white')
                            : 'bg-[#1a0b2e]/60 border border-purple-500/30 hover:bg-[#1a0b2e]/80 hover:border-purple-500/50 active:scale-95 text-white'
                            }`}
                        >
                          {isRevealed ? (isMine ? '💣' : '💎') : '?'}
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-center text-sm text-purple-300/70">{revealedTiles.length} / {25 - minesCount} revealed</div>
                </div>
              )}

              {(gameStatus === 'lost' || gameStatus === 'won' || gameStatus === 'cashed') && (
                <div className="text-center">
                  <div className={`text-4xl font-bold mb-4 ${gameStatus === 'won' || gameStatus === 'cashed' ? 'text-green-400' : 'text-red-400'}`}>
                    {gameStatus === 'won' && '🎉 PERFECT!'}
                    {gameStatus === 'lost' && '💥 BOOM!'}
                    {gameStatus === 'cashed' && '💰 Cashed Out!'}
                  </div>
                  <div className="grid grid-cols-5 gap-2 mb-6">
                    {Array.from({ length: 25 }, (_, i) => (
                      <div
                        key={i}
                        className={`aspect-square text-2xl font-bold rounded-lg flex items-center justify-center ${minePositions.includes(i)
                          ? 'bg-red-500 text-white'
                          : 'bg-green-500 text-white opacity-40'
                          }`}
                      >
                        {minePositions.includes(i) ? '💣' : revealedTiles.includes(i) ? '💎' : ''}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => {
                      setGameStatus('idle');
                      setMinesGame(null);
                      setRevealedTiles([]);
                      setMinePositions([]);
                      setCurrentMultiplier(1.0);
                    }}
                    className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 font-bold transition-all"
                  >
                    Play Again
                  </button>
                </div>
              )}

              <div className="mt-8 bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                <h3 className="font-semibold text-orange-400 mb-3 flex items-center gap-2">
                  <span>ℹ️</span>
                  <span>How It Works</span>
                </h3>
                <ul className="text-sm text-orange-300/80 space-y-2">
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>Progressive multipliers: Each safe tile increases your payout</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>More mines = Higher multipliers but higher risk</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>Cash out anytime to secure winnings!</span>
                  </li>
                </ul>
              </div>
            </div>
          )
        }

        {/* Improved Coinflip Tab */}
        {
          activeTab === 'arcade' && (
            <div className="bg-gradient-to-br from-[#1a0b2e]/60 to-[#16213e]/60 backdrop-blur-xl border border-cyan-500/30 rounded-2xl p-6 md:p-8 shadow-xl">
              <div className="mb-6">
                <h2 className="text-3xl md:text-4xl font-bold mb-3 bg-gradient-to-r from-cyan-400 via-green-400 to-blue-400 text-transparent bg-clip-text">
                  🎰 Coinflip
                </h2>
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
                  <p className="text-cyan-300 font-medium text-sm md:text-base">
                    <span className="font-bold">⚡ How it works:</span> Stake your tokens, pick heads or tails.
                    Win = Auto 2x payout sent directly to your wallet!
                    Results verified with Polygon chain blockhash entropy.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                  <label className="block text-sm font-semibold mb-2 text-purple-300">Pick Side</label>
                  <select
                    value={flipGuess}
                    onChange={(e) => setFlipGuess(e.target.value as 'heads' | 'tails')}
                    className="w-full border border-purple-500/30 rounded-lg px-3 py-2.5 font-medium bg-[#1a0b2e]/60 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                    disabled={isFlipping}
                  >
                    <option value="heads" className="bg-[#1a0b2e]">🪙 Heads</option>
                    <option value="tails" className="bg-[#1a0b2e]">🎯 Tails</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2 text-purple-300">Token to Stake</label>
                  <select
                    value={flipToken || selectedCoin}
                    onChange={(e) => {
                      setFlipToken(e.target.value)
                      setSelectedCoin(e.target.value)
                    }}
                    className="w-full border border-purple-500/30 rounded-lg px-3 py-2.5 font-medium bg-[#1a0b2e]/60 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                    disabled={isFlipping}
                  >
                    <option value="" className="bg-[#1a0b2e]">Select your coin...</option>
                    {userCoins.map((c) => (
                      <option key={c.tokenAddress || c.id} value={c.tokenAddress || c.id} className="bg-[#1a0b2e]">
                        {c.symbol || 'UNKNOWN'} ({parseFloat(c.balance || '0').toFixed(4)}) - {c.name || 'Unknown Token'}
                      </option>
                    ))}
                  </select>
                  {selectedCoin && (
                    <p className="text-xs text-blue-400 mt-1">💡 Using globally selected coin</p>
                  )}
                  {userCoins.length === 0 && (
                    <p className="text-xs text-red-400 mt-1">Buy some coins first!</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold mb-2 text-purple-300">Wager Amount</label>
                  <input
                    type="number"
                    value={flipWager}
                    onChange={(e) => setFlipWager(e.target.value)}
                    step="0.1"
                    min="0.1"
                    className="w-full border border-purple-500/30 rounded-lg px-3 py-2.5 font-medium bg-[#1a0b2e]/60 text-white focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500"
                    disabled={isFlipping}
                  />
                </div>
              </div>

              <button
                onClick={playCoinflip}
                disabled={!address || !flipToken || isFlipping}
                className="w-full bg-gradient-to-r from-green-600 to-blue-600 text-white px-8 py-3 rounded-lg hover:from-green-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed mb-6 font-bold text-lg shadow-lg transition-all transform hover:scale-105"
              >
                {isFlipping ? '🔄 Flipping...' : '🪙 Flip Now!'}
              </button>

              {coinflipResult && (
                <div className={`border rounded-xl p-6 mb-6 ${coinflipResult.outcome === 'win'
                  ? 'bg-green-500/10 border-green-500/30'
                  : 'bg-red-500/10 border-red-500/30'
                  }`}>
                  <div className="text-center">
                    <h3 className="text-3xl font-bold mb-2 text-white">
                      {coinflipResult.outcome === 'win' ? '🎉 YOU WON! 🎉' : '😢 You Lost'}
                    </h3>
                    <div className="text-6xl my-4">
                      {coinflipResult.result === 'heads' ? '🪙' : '🎯'}
                    </div>
                    <div className="text-2xl font-bold mb-2 text-white">
                      Result: <span className="text-purple-400">{coinflipResult.result.toUpperCase()}</span>
                    </div>
                    {coinflipResult.outcome === 'win' && (
                      <div className="bg-[#1a0b2e]/60 border border-green-500/30 rounded-lg p-4 mt-4">
                        <div className="text-lg font-semibold text-green-400">
                          💰 Payout: {parseFloat(flipWager) * 2} tokens
                        </div>
                        {coinflipResult.payoutTx && (
                          <div className="text-sm text-purple-300/70 mt-2">
                            Tx: <span className="font-mono">{coinflipResult.payoutTx.slice(0, 10)}...{coinflipResult.payoutTx.slice(-8)}</span>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="text-sm text-purple-300/70 mt-4">
                      <div>Block #{coinflipResult.blockNumber}</div>
                      <div className="font-mono text-xs">Hash: {coinflipResult.blockHash?.slice(0, 20)}...</div>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
                <div>
                  <h3 className="font-semibold mb-3 text-lg text-white">🏆 Leaderboard</h3>
                  <div className="text-sm bg-[#1a0b2e]/40 border border-purple-500/30 p-3 rounded-lg max-h-64 overflow-auto">
                    {leaderboard.map((r, i) => (
                      <div key={i} className={`flex justify-between py-2 ${i < 3 ? 'font-bold' : ''} text-white`}>
                        <span>
                          {i === 0 && '🥇 '}
                          {i === 1 && '🥈 '}
                          {i === 2 && '🥉 '}
                          <span className="font-mono text-purple-300">{r.userAddress.slice(0, 6)}…{r.userAddress.slice(-4)}</span>
                        </span>
                        <span className="text-green-400">{r.wins}W / <span className="text-red-400">{r.losses}L</span> <span className="text-purple-300/70">({r.plays})</span></span>
                      </div>
                    ))}
                    {leaderboard.length === 0 && <div className="text-purple-300/70 py-4 text-center">No plays yet - be the first!</div>}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold mb-3 text-lg text-white">📜 Recent Plays</h3>
                  <div className="text-sm bg-[#1a0b2e]/40 border border-purple-500/30 p-3 rounded-lg max-h-64 overflow-auto">
                    {recent.map((r, i) => (
                      <div key={i} className="flex justify-between py-2 text-white">
                        <span className="font-mono text-purple-300">{r.userAddress.slice(0, 6)}…{r.userAddress.slice(-4)}</span>
                        <span className={r.outcome === 'win' ? 'text-green-400 font-semibold' : 'text-red-400'}>
                          {r.outcome.toUpperCase()} • {r.wager}
                        </span>
                      </div>
                    ))}
                    {recent.length === 0 && <div className="text-purple-300/70 py-4 text-center">No recent plays</div>}
                  </div>
                </div>
              </div>

              <div className="mt-8 bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                <h3 className="font-semibold text-yellow-400 mb-3 flex items-center gap-2">
                  <span>ℹ️</span>
                  <span>Fair Play Guarantee</span>
                </h3>
                <ul className="text-sm text-yellow-300/80 space-y-2">
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>Results determined by Polygon blockchain blockhash (verifiable)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>Automatic 2x payout on wins - sent directly to your wallet</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>No house edge - pure 50/50 odds</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span>•</span>
                    <span>All transactions on-chain and transparent</span>
                  </li>
                </ul>
              </div>
            </div>
          )
        }

        <div className="mt-6 text-center text-slate-500 text-sm">
          <p>🎮 All games powered by Polygon — Decentralized Trading Platform</p>
        </div>

        {/* Token Creator Modal */}
        <TokenCreatorModal
          isOpen={isCreateCoinModalOpen}
          onClose={() => setIsCreateCoinModalOpen(false)
          }
          onTokenCreated={async (tokenData) => {
            console.log('✅ Token created:', tokenData)

            // Optimistically insert the newly created coin so it appears instantly in gaming.
            optimisticUpsertCoin({
              ...tokenData,
              creator: address || 'Unknown',
              createdAt: new Date().toISOString(),
            })

            // Save token to database via API
            let saveSuccess = false
            if (tokenData.tokenAddress && tokenData.curveAddress && tokenData.txHash) {
              const payload = {
                name: tokenData.name,
                symbol: tokenData.symbol,
                supply: tokenData.supply,
                description: tokenData.description,
                imageHash: tokenData.imageHash,
                tokenAddress: tokenData.tokenAddress,
                curveAddress: tokenData.curveAddress,
                txHash: tokenData.txHash,
                creator: address || 'Unknown',
                telegramUrl: tokenData.telegramUrl,
                xUrl: tokenData.xUrl,
                discordUrl: tokenData.discordUrl,
                websiteUrl: tokenData.websiteUrl,
              }

              const attemptSave = async (delayMs: number) => {
                await new Promise((r) => setTimeout(r, delayMs))
                const headers: Record<string, string> = { 'Content-Type': 'application/json' }
                if (apiKey) headers['x-api-key'] = apiKey
                if (accessToken) headers.Authorization = `Bearer ${accessToken}`
                const resp = await fetch('/api/coins', {
                  method: 'POST',
                  headers,
                  body: JSON.stringify(payload),
                })
                if (!resp.ok) {
                  const txt = await resp.text().catch(() => '')
                  throw new Error(`status ${resp.status}: ${txt || 'unknown error'}`)
                }
                const result = await resp.json()
                if (!result.success) {
                  throw new Error(result.error || 'unknown save error')
                }
                return result
              }

              const backoffs = [0, 750, 1500, 3000]
              for (const wait of backoffs) {
                try {
                  const result = await attemptSave(wait)
                  console.log('✅ Token saved to database:', result.coin?.id || 'unknown')
                  saveSuccess = true
                  break
                } catch (saveError: any) {
                  console.warn(`Save attempt failed (wait ${wait}ms):`, saveError?.message || saveError)
                }
              }
            }

            // Refresh coin data after persistence attempts complete.
            if (address) {
              if (saveSuccess) {
                scheduleCoinRefreshes([500, 1500, 3000])
              } else {
                scheduleCoinRefreshes([0, 1500, 3000])
              }
            }
            setIsCreateCoinModalOpen(false)
          }}
        />
      </div>
    </div>
  )
}

