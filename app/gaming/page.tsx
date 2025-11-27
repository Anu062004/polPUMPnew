"use client"

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { ethers } from 'ethers'
import { useRouter } from 'next/navigation'
import TokenCreatorModal from '../components/TokenCreatorModal'
import BlobBackground from '../components/BlobBackground'

export default function GamingPage() {
  const { address } = useAccount()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'pumpplay'|'meme-royale'|'mines'|'arcade'>('pumpplay')
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'
  
  // Platform Coins & User Holdings
  const [allCoins, setAllCoins] = useState<any[]>([])
  const [userCoins, setUserCoins] = useState<any[]>([])
  const [loadingCoins, setLoadingCoins] = useState(false)
  const [balanceChange, setBalanceChange] = useState<{amount: number, token: string} | null>(null)
  
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
  const [stakeSide, setStakeSide] = useState<'left'|'right'|''>('')
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
  const [gameStatus, setGameStatus] = useState<'idle'|'active'|'won'|'lost'|'cashed'>('idle')
  const [minesHistory, setMinesHistory] = useState<any[]>([])
  
  // Coinflip State
  const [coinflipResult, setCoinflipResult] = useState<any>(null)
  const [flipWager, setFlipWager] = useState<string>('0.1')
  const [flipGuess, setFlipGuess] = useState<'heads'|'tails'>('heads')
  const [flipToken, setFlipToken] = useState<string>('')
  const [leaderboard, setLeaderboard] = useState<any[]>([])
  const [recent, setRecent] = useState<any[]>([])
  const [isFlipping, setIsFlipping] = useState(false)
  
  // Polygon Amoy DA Provenance State
  const [lastProvenanceHash, setLastProvenanceHash] = useState<string|null>(null)
  
  // Wallet Balance Tracking
  const [nativeBalance, setNativeBalance] = useState<string>('0.0')
  const [isLoadingBalance, setIsLoadingBalance] = useState(false)

  // Load native MATIC balance
  const loadNativeBalance = async () => {
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
  }

  // Auto-refresh native balance
  useEffect(() => {
    if (!address) return
    loadNativeBalance()
    const interval = setInterval(loadNativeBalance, 10000) // Refresh every 10s
    return () => clearInterval(interval)
  }, [address])

  // Load platform coins and user holdings with real-time balance updates
  // Uses Next.js API route as fallback if backend is not available
  const loadCoinsData = async () => {
    if (!address) return
    setLoadingCoins(true)
    
    try {
      // Try backend first with better error handling
      let response: Response | null = null
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s timeout
        
        response = await fetch(`${backend}/gaming/coins/${address}`, { 
          cache: 'no-store',
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)
      } catch (fetchError: any) {
        // Silently handle connection errors - backend is not available
        if (fetchError.name === 'AbortError' || fetchError.message?.includes('Failed to fetch') || fetchError.message?.includes('ERR_CONNECTION_REFUSED')) {
          // Backend not available, will use fallback
          response = null
        } else {
          throw fetchError
        }
      }
      
      // Fallback to Next.js API route if backend failed
      if (!response || !response.ok) {
        try {
          response = await fetch(`/api/gaming/coins/${address}`, { cache: 'no-store' })
        } catch (apiError) {
          console.warn('Both backend and API route failed, using empty data')
          setAllCoins([])
          setUserCoins([])
          setLoadingCoins(false)
          return
        }
      }
      
      if (response && response.ok) {
        const data = await response.json()
        setAllCoins(data.coins || [])
        setUserCoins(data.userHoldings || [])
        setLoadingCoins(false)
        // Only log success, not errors
        // console.log(`✅ Balance updated: ${data.totalCoins || 0} coins, you hold ${data.coinsWithBalance || 0}`)
        // Also refresh native balance
        loadNativeBalance()
      } else {
        // Set empty arrays on error instead of throwing
        setAllCoins([])
        setUserCoins([])
        setLoadingCoins(false)
      }
    } catch (e: any) {
      // Silently handle errors - don't spam console
      setAllCoins([])
      setUserCoins([])
      setLoadingCoins(false)
    }
  }

  useEffect(() => {
    if (!address) return
    loadCoinsData()
    const interval = setInterval(loadCoinsData, 10000) // Refresh every 10s
    return () => clearInterval(interval)
  }, [address, backend])

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
          setRounds(data.rounds || [])
        }
      } catch (e) {
        console.warn('Failed to load rounds:', e)
      }
    }
    loadRounds()
    const interval = setInterval(loadRounds, 10000)
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
  }, [activeTab, backend, battleResult])

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
          } catch {}
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
      } catch (e) {
        console.warn('Failed to load coinflip data:', e)
      }
    }
    load()
    const interval = setInterval(load, 10000)
    return () => clearInterval(interval)
  }, [activeTab, backend, coinflipResult])

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
          txHash: tx.hash
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
            txHash: tx.hash
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
        alert(`✅ Bet placed successfully!\n\nYou bet ${betAmount} tokens on ${selectedRound.coinDetails?.find((c:any) => c.id == betCoin)?.symbol || betCoin}\n\nWait for round to end!`)
        // Reload rounds and refresh balances
        setTimeout(() => {
          loadCoinsData()
          loadNativeBalance()
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
          txHash: transferTx.hash
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
            txHash: transferTx.hash
          })
        })
      }
      
      let data
      try {
        data = await res.json()
      } catch (e) {
        throw new Error('Invalid response from server')
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
          loadCoinsData()
          loadNativeBalance()
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
          txHash: transferTx.hash
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
            txHash: transferTx.hash
          })
        })
      }
      
      let data
      try {
        data = await res.json()
      } catch (e) {
        throw new Error('Invalid response from server')
      }
      
      setCoinflipResult(data)
      
      if (data.provenanceHash) {
        setLastProvenanceHash(data.provenanceHash)
      }
      
      if (data.outcome === 'win') {
        alert(`🎉 YOU WON!\n\nResult: ${data.result.toUpperCase()}\n\nPayout of ${parseFloat(flipWager) * 2} tokens sent!\nTx: ${data.payoutTx?.slice(0, 10)}...\n\n✅ Game verified on Polygon Amoy`)
      } else {
        alert(`😢 You Lost\n\nResult: ${data.result.toUpperCase()}\n\nBetter luck next time!\n\n✅ Game verified on Polygon Amoy`)
      }
      
      // Refresh balances immediately after game ends
      setTimeout(() => {
        loadCoinsData()
        loadNativeBalance()
      }, 2000)
      
    } catch (e: any) {
      console.error('Coinflip error:', e)
      alert(e.message || 'Coinflip failed')
    } finally {
      setIsFlipping(false)
    }
  }

  const formatTime = (ms: number) => {
    const minutes = Math.floor(ms / 60000)
    const seconds = Math.floor((ms % 60000) / 1000)
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <BlobBackground />
      <div className="relative z-10 p-6">
        <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-5xl font-black bg-gradient-to-r from-pink-500 via-purple-500 to-cyan-500 text-transparent bg-clip-text drop-shadow-[0_0_30px_rgba(168,85,247,0.5)] animate-pulse">
              🎮 GAMING ARENA 🎮
            </h1>
            <div className="flex gap-2 mt-3">
              <span className="bg-gradient-to-r from-green-400 to-emerald-600 text-white text-xs px-3 py-1.5 rounded-full border-2 border-green-300 shadow-[0_0_15px_rgba(34,197,94,0.5)] font-bold animate-bounce">
                ✅ POL PUMP AI
              </span>
              <span className="bg-gradient-to-r from-blue-400 to-cyan-600 text-white text-xs px-3 py-1.5 rounded-full border-2 border-cyan-300 shadow-[0_0_15px_rgba(6,182,212,0.5)] font-bold animate-bounce animation-delay-200">
                🔒 POLYGON AMOY VERIFIED
              </span>
            </div>
          </div>
          
          {/* Wallet Connect & Balance Display - Neon Style */}
          <div className="flex items-center gap-4">
            {address && (
              <div className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 backdrop-blur-xl border-2 border-purple-400 rounded-2xl px-6 py-4 shadow-[0_0_30px_rgba(168,85,247,0.4)] hover:shadow-[0_0_50px_rgba(168,85,247,0.6)] transition-all duration-300">
                <div className="flex items-center gap-4">
                  <div>
                    <div className="text-xs text-cyan-300 font-bold tracking-wider">CONNECTED WALLET</div>
                    <div className="text-sm font-mono text-white font-black bg-gradient-to-r from-yellow-300 to-orange-400 text-transparent bg-clip-text">
                      {address.slice(0, 6)}...{address.slice(-4)}
                    </div>
                  </div>
                  <div className="h-12 w-px bg-gradient-to-b from-pink-500 to-cyan-500"></div>
                  <div>
                    <div className="text-xs text-pink-300 font-bold tracking-wider">MATIC BALANCE</div>
                    <div className="text-xl font-black text-green-400 flex items-center gap-1 drop-shadow-[0_0_10px_rgba(34,197,94,0.8)]">
                      {isLoadingBalance ? (
                        <span className="animate-pulse">...</span>
                      ) : (
                        <>
                          <span>{parseFloat(nativeBalance).toFixed(4)}</span>
                          <span className="text-sm text-green-300">MATIC</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="h-12 w-px bg-gradient-to-b from-cyan-500 to-purple-500"></div>
                  <div>
                    <div className="text-xs text-purple-300 font-bold tracking-wider">TOKENS HELD</div>
                    <div className="text-xl font-black text-cyan-400 drop-shadow-[0_0_10px_rgba(6,182,212,0.8)]">
                      {userCoins.length}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex flex-col gap-2">
              <div className="[&>button]:bg-gradient-to-r [&>button]:from-pink-500 [&>button]:to-purple-600 [&>button]:border-2 [&>button]:border-pink-400 [&>button]:shadow-[0_0_20px_rgba(236,72,153,0.5)] [&>button]:hover:shadow-[0_0_35px_rgba(236,72,153,0.8)]">
                <ConnectButton />
              </div>
              <a href="/" className="text-cyan-400 hover:text-pink-400 font-bold text-sm text-center transition-colors duration-300 drop-shadow-[0_0_5px_rgba(6,182,212,0.5)]">← HOME</a>
            </div>
          </div>
        </div>
        
        {/* 0G DA Provenance Verification - Neon Style */}
        {lastProvenanceHash && (
          <div className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 backdrop-blur-xl border-2 border-cyan-400 rounded-2xl p-5 mb-6 shadow-[0_0_30px_rgba(6,182,212,0.4)] animate-pulse">
            <div className="flex items-center gap-4">
              <div className="text-5xl animate-bounce drop-shadow-[0_0_10px_rgba(6,182,212,1)]">🔐</div>
              <div className="flex-1">
                <div className="font-black text-cyan-300 text-lg drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]">GAME VERIFIED ON POLYGON AMOY</div>
                <div className="text-sm text-purple-300 font-semibold">Your last game result is permanently stored on decentralized storage</div>
                <div className="text-xs text-yellow-400 mt-1 font-mono break-all">{lastProvenanceHash}</div>
              </div>
              <a 
                href={`${backend}/gaming/verify/${lastProvenanceHash}`}
                target="_blank"
                className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white px-6 py-3 rounded-xl hover:from-cyan-400 hover:to-blue-500 text-sm font-black whitespace-nowrap border-2 border-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.5)] hover:shadow-[0_0_35px_rgba(6,182,212,0.8)] transition-all duration-300"
              >
                VERIFY ↗
              </a>
            </div>
          </div>
        )}

        {/* Balance Change Notification - Neon Style */}
        {balanceChange && (
          <div className={`fixed top-20 right-6 z-50 ${balanceChange.amount > 0 ? 'bg-gradient-to-br from-green-400 to-emerald-600 border-green-300 shadow-[0_0_40px_rgba(34,197,94,0.8)]' : 'bg-gradient-to-br from-red-400 to-rose-600 border-red-300 shadow-[0_0_40px_rgba(239,68,68,0.8)]'} text-white px-8 py-5 rounded-2xl border-4 animate-bounce backdrop-blur-xl`}>
            <div className="text-3xl font-black drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]">
              {balanceChange.amount > 0 ? '🎉 +' : '😢 -'}{Math.abs(balanceChange.amount).toFixed(4)} {balanceChange.token}
            </div>
            <div className="text-base font-bold">{balanceChange.amount > 0 ? 'WINNING CREDITED!' : 'BET DEDUCTED'}</div>
          </div>
        )}

        {/* Platform Coins & Holdings Display - Neon Style */}
        <div className="bg-gradient-to-br from-purple-900/40 to-pink-900/40 backdrop-blur-xl border-2 border-pink-500 rounded-2xl p-6 mb-6 shadow-[0_0_30px_rgba(236,72,153,0.3)]">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-black text-transparent bg-gradient-to-r from-yellow-400 via-pink-400 to-purple-400 bg-clip-text drop-shadow-[0_0_10px_rgba(251,191,36,0.5)]">
              🎮 GAMING WITH PLATFORM COINS
            </h2>
            <div className="flex items-center gap-4">
              <div className="text-sm text-cyan-300 font-bold">
                {allCoins.length} COINS AVAILABLE • {userCoins.length} YOU HOLD
              </div>
              {address && (
                <button
                  onClick={() => setIsCreateCoinModalOpen(true)}
                  className="px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200 border-2 border-green-400 text-sm"
                >
                  ➕ Create Coin
                </button>
              )}
            </div>
          </div>
          
          {/* Global Coin Selector */}
          {address && allCoins.length > 0 && (
            <div className="mb-4 p-4 bg-black/30 rounded-xl border-2 border-purple-400/50">
              <label className="block text-sm font-bold text-purple-300 mb-2">
                🎯 Select Coin for Gaming
              </label>
              <div className="flex gap-3 items-center">
                <select
                  value={selectedCoin}
                  onChange={(e) => {
                    setSelectedCoin(e.target.value)
                    // Auto-set token for all games when coin is selected
                    if (e.target.value) {
                      const coin = userCoins.find(c => c.tokenAddress === e.target.value) || 
                                  allCoins.find(c => c.tokenAddress === e.target.value)
                      if (coin) {
                        setBetToken(e.target.value)
                        setStakeToken(e.target.value)
                        setMinesToken(e.target.value)
                        setFlipToken(e.target.value)
                      }
                    }
                  }}
                  className="flex-1 border-2 border-purple-400 rounded-lg px-4 py-2 font-medium bg-white text-gray-900 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">-- Select a coin to play with --</option>
                  {userCoins.length > 0 && (
                    <optgroup label="Your Coins (You Hold)">
                      {userCoins.map((c) => (
                        <option key={c.tokenAddress || c.id} value={c.tokenAddress || c.id}>
                          {c.symbol || 'UNKNOWN'} ({parseFloat(c.balance || '0').toFixed(4)}) - {c.name || 'Unknown Token'}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {allCoins.filter(c => !userCoins.find(uc => (uc.tokenAddress || uc.id) === (c.tokenAddress || c.id))).length > 0 && (
                    <optgroup label="All Platform Coins">
                      {allCoins
                        .filter(c => !userCoins.find(uc => (uc.tokenAddress || uc.id) === (c.tokenAddress || c.id)))
                        .map((c) => (
                          <option key={c.tokenAddress || c.id} value={c.tokenAddress || c.id}>
                            {c.symbol || 'UNKNOWN'} (0.0000) - {c.name || 'Unknown Token'} - Buy first to play
                          </option>
                        ))}
                    </optgroup>
                  )}
                </select>
                {selectedCoin && (
                  <div className="px-4 py-2 bg-green-500/20 border-2 border-green-400 rounded-lg">
                    <span className="text-green-300 font-bold text-sm">✓ Selected</span>
                  </div>
                )}
              </div>
              {selectedCoin && (
                <p className="text-xs text-purple-300 mt-2">
                  💡 This coin will be used for all games. Change it anytime above.
                </p>
              )}
            </div>
          )}
          {!address && <p className="text-purple-300 font-semibold">CONNECT WALLET TO VIEW YOUR COINS</p>}
          {address && loadingCoins && <p className="text-pink-300 animate-pulse font-semibold">LOADING PLATFORM COINS...</p>}
          {address && !loadingCoins && allCoins.length === 0 && (
            <div className="flex flex-col items-center gap-4 py-6">
              <p className="text-gray-500 text-center mb-2">No coins created yet. Create the first coin on the platform!</p>
              <button
                onClick={() => setIsCreateCoinModalOpen(true)}
                className="px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white font-bold rounded-xl shadow-lg transform hover:scale-105 transition-all duration-200 border-2 border-green-400"
              >
                ➕ Create Coin
              </button>
            </div>
          )}
          {allCoins.length > 0 && (
            <div>
              {userCoins.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-semibold text-green-700 mb-2">✅ Your Holdings ({userCoins.length})</h3>
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
                        className="bg-green-50 border-2 border-green-400 rounded-lg px-3 py-2 cursor-pointer hover:bg-green-100 hover:border-green-500 transition-all duration-200 hover:scale-105"
                      >
                        <div className="font-bold text-sm">{c.symbol || 'UNKNOWN'}</div>
                        <div className="text-xs text-gray-600">{parseFloat(c.balance || '0').toFixed(4)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <h3 className="text-sm font-semibold text-blue-700 mb-2">📋 All Platform Coins ({allCoins.length})</h3>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                  {allCoins.slice(0, 20).map((c, i) => {
                    const tokenAddress = c.tokenAddress || c.id
                    return (
                      <div 
                        key={i} 
                        onClick={() => {
                          if (tokenAddress) {
                            router.push(`/token/${tokenAddress}`)
                          }
                        }}
                        className={`border rounded-lg px-3 py-1 text-xs cursor-pointer transition-all duration-200 hover:scale-105 ${
                          c.hasBalance 
                            ? 'bg-blue-50 border-blue-300 hover:bg-blue-100 hover:border-blue-400' 
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                        }`}
                      >
                        <span className="font-semibold">{c.symbol || 'UNKNOWN'}</span> - {c.name || 'Unknown Token'}
                      </div>
                    )
                  })}
                  {allCoins.length > 20 && <div className="text-xs text-gray-500 px-2">+{allCoins.length - 20} more...</div>}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Tabs - Neon Gaming Style */}
        <div className="flex gap-4 mb-6 flex-wrap">
          <button
            onClick={() => setActiveTab('pumpplay')}
            className={`px-8 py-4 rounded-2xl font-black text-lg transition-all duration-300 transform hover:scale-105 ${
              activeTab === 'pumpplay'
                ? 'bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-[0_0_30px_rgba(59,130,246,0.6)] border-2 border-blue-400'
                : 'bg-gray-800/50 text-purple-300 hover:bg-gray-700/70 border-2 border-purple-500/30 backdrop-blur-sm'
            }`}
          >
            🎯 PUMPPLAY
          </button>
          <button
            onClick={() => setActiveTab('meme-royale')}
            className={`px-8 py-4 rounded-2xl font-black text-lg transition-all duration-300 transform hover:scale-105 ${
              activeTab === 'meme-royale'
                ? 'bg-gradient-to-r from-pink-500 to-red-600 text-white shadow-[0_0_30px_rgba(236,72,153,0.6)] border-2 border-pink-400'
                : 'bg-gray-800/50 text-pink-300 hover:bg-gray-700/70 border-2 border-pink-500/30 backdrop-blur-sm'
            }`}
          >
            ⚔️ MEME ROYALE
          </button>
          <button
            onClick={() => setActiveTab('mines')}
            className={`px-8 py-4 rounded-2xl font-black text-lg transition-all duration-300 transform hover:scale-105 ${
              activeTab === 'mines'
                ? 'bg-gradient-to-r from-orange-500 to-red-600 text-white shadow-[0_0_30px_rgba(249,115,22,0.6)] border-2 border-orange-400'
                : 'bg-gray-800/50 text-orange-300 hover:bg-gray-700/70 border-2 border-orange-500/30 backdrop-blur-sm'
            }`}
          >
            💣 MINES
          </button>
          <button
            onClick={() => setActiveTab('arcade')}
            className={`px-8 py-4 rounded-2xl font-black text-lg transition-all duration-300 transform hover:scale-105 ${
              activeTab === 'arcade'
                ? 'bg-gradient-to-r from-cyan-500 to-green-600 text-white shadow-[0_0_30px_rgba(6,182,212,0.6)] border-2 border-cyan-400'
                : 'bg-gray-800/50 text-cyan-300 hover:bg-gray-700/70 border-2 border-cyan-500/30 backdrop-blur-sm'
            }`}
          >
            🎰 COINFLIP
          </button>
        </div>

        {/* PumpPlay Tab - Neon Style */}
        {activeTab === 'pumpplay' && (
          <div className="bg-gradient-to-br from-blue-900/40 to-purple-900/40 backdrop-blur-xl border-2 border-blue-500 rounded-3xl p-8 shadow-[0_0_40px_rgba(59,130,246,0.4)]">
            <h2 className="text-4xl font-black mb-6 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 text-transparent bg-clip-text drop-shadow-[0_0_15px_rgba(147,51,234,0.8)]">
              🎯 PUMPPLAY - BET ON THE PUMP
            </h2>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-blue-800 font-medium">
                ⚡ <strong>How it works:</strong> Pick which coin will pump the most in the next 15 minutes. 
                All bets go into a pool. Winners split the pool proportionally! Real tokens, real payouts.
              </p>
            </div>

            {rounds.length === 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 text-center">
                <p className="text-yellow-800">⏳ Loading rounds or creating new one...</p>
              </div>
            )}

            {rounds.map((round) => (
              <div 
                key={round.id} 
                className={`border-2 rounded-lg p-5 mb-4 transition-all ${
                  selectedRound?.id === round.id 
                    ? 'border-blue-500 bg-blue-50 shadow-lg' 
                    : 'border-gray-200 hover:border-blue-300 cursor-pointer'
                }`}
                onClick={() => !selectedRound && setSelectedRound(round)}
              >
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-xl">Round #{round.id}</h3>
                  <div className="flex gap-3 items-center">
                    <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold">
                      {round.status.toUpperCase()}
                    </span>
                    <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-semibold">
                      ⏱ {formatTime(round.timeRemaining)}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-3 gap-4 mb-4">
                  {round.coinDetails?.map((coin: any) => {
                    const totalBet = round.bets?.find((b: any) => b.coinId === coin.id)?.total || 0
                    const isSelected = betCoin == coin.id
                    return (
                      <div 
                        key={coin.id} 
                        className={`border-2 rounded-lg p-4 transition-all cursor-pointer hover:scale-105 ${
                          isSelected ? 'border-blue-500 bg-blue-100' : 'border-gray-200 bg-slate-50 hover:border-gray-300'
                        }`}
                        onClick={() => {
                          const tokenAddress = coin.tokenAddress || coin.id
                          if (tokenAddress) {
                            router.push(`/token/${tokenAddress}`)
                          }
                        }}
                      >
                        <div className="font-bold text-lg hover:underline">{coin.symbol}</div>
                        <div className="text-xs text-gray-500 mb-2 hover:underline">{coin.name}</div>
                        <div className="text-sm font-semibold text-green-600">
                          💰 Pool: {totalBet.toFixed(2)} tokens
                        </div>
                      </div>
                    )
                  })}
                </div>

                {selectedRound?.id === round.id && (
                  <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300 rounded-lg p-5 mt-4">
                    <h4 className="font-bold text-lg mb-4">🎲 Place Your Bet</h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-semibold mb-2">Which Coin Will Pump?</label>
                        <select
                          value={betCoin}
                          onChange={(e) => setBetCoin(e.target.value)}
                          className="w-full border-2 rounded-lg px-3 py-2 font-medium"
                          disabled={isBetting}
                        >
                          <option value="">Select coin...</option>
                          {round.coinDetails?.map((c: any) => (
                            <option key={c.id} value={c.id}>{c.symbol} - {c.name}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold mb-2">Token to Stake</label>
                        <select
                          value={betToken || selectedCoin}
                          onChange={(e) => {
                            setBetToken(e.target.value)
                            setSelectedCoin(e.target.value)
                          }}
                          className="w-full border-2 rounded-lg px-3 py-2 font-medium"
                          disabled={isBetting}
                        >
                          <option value="">Select your coin...</option>
                          {userCoins.map((c) => (
                            <option key={c.tokenAddress || c.id} value={c.tokenAddress || c.id}>
                              {c.symbol || 'UNKNOWN'} ({parseFloat(c.balance || '0').toFixed(4)}) - {c.name || 'Unknown Token'}
                            </option>
                          ))}
                        </select>
                        {userCoins.length === 0 && (
                          <p className="text-xs text-red-600 mt-1">You don't hold any coins. Buy some first!</p>
                        )}
                        {selectedCoin && (
                          <p className="text-xs text-blue-600 mt-1">💡 Using globally selected coin</p>
                        )}
                      </div>
                      
                      <div>
                        <label className="block text-sm font-semibold mb-2">Amount</label>
                        <input
                          type="number"
                          value={betAmount}
                          onChange={(e) => setBetAmount(e.target.value)}
                          step="0.1"
                          min="0.1"
                          className="w-full border-2 rounded-lg px-3 py-2 font-medium"
                          disabled={isBetting}
                        />
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <button
                        onClick={placeBet}
                        disabled={!address || !betCoin || !betToken || isBetting}
                        className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-8 py-3 rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold shadow-lg"
                      >
                        {isBetting ? '🔄 Placing Bet...' : '🎲 Place Bet Now!'}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedRound(null)
                          setBetCoin('')
                          setBetToken('')
                        }}
                        className="bg-gray-300 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-400 font-semibold"
                        disabled={isBetting}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-900 mb-2">ℹ️ How Payouts Work</h3>
              <ul className="text-sm text-yellow-800 space-y-1">
                <li>• All bets go into a shared pool</li>
                <li>• When round ends, the coin that pumped most wins</li>
                <li>• Winners split the entire pool based on their bet size</li>
                <li>• Automatic payouts sent to your wallet</li>
              </ul>
            </div>
          </div>
        )}

        {/* Meme Royale Tab */}
        {activeTab === 'meme-royale' && (
          <div className="bg-white border rounded-xl p-6 shadow-sm">
            <h2 className="text-2xl font-semibold mb-4">⚔️ Meme Royale - AI Battle Arena</h2>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
              <p className="text-purple-800 font-medium">
                ⚡ <strong>How it works:</strong> Pick two coins to battle. AI judges them on virality, trend fit, and creativity. 
                Stake tokens on your pick - win = 1.8x payout! Powered by POL Pump AI.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className={`border-2 rounded-lg p-5 ${stakeSide === 'left' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                <h3 className="font-bold text-lg mb-3">🥊 Left Fighter</h3>
                <select
                  value={leftCoin?.id || ''}
                  onChange={(e) => {
                    const coin = allCoins.find(c => c.id === parseInt(e.target.value))
                    setLeftCoin(coin ? {...coin, id: coin.id} : null)
                  }}
                  className="w-full border-2 rounded-lg px-3 py-2 mb-3 font-medium"
                  disabled={isBattling}
                >
                  <option value="">Select fighter...</option>
                  {allCoins.map((c) => (
                    <option key={c.id} value={c.id}>{c.symbol} - {c.name} {c.hasBalance ? '✓' : ''}</option>
                  ))}
                </select>
                {leftCoin && (
                  <div className="bg-white border-2 rounded-lg p-4">
                    <div 
                      onClick={() => {
                        const tokenAddress = leftCoin.tokenAddress || leftCoin.id
                        if (tokenAddress) {
                          router.push(`/token/${tokenAddress}`)
                        }
                      }}
                      className="font-bold text-xl text-blue-600 cursor-pointer hover:text-blue-800 hover:underline transition-colors"
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
                      className="text-sm text-gray-600 mb-2 cursor-pointer hover:text-gray-800 hover:underline transition-colors"
                    >
                      {leftCoin.name}
                    </div>
                    <button
                      onClick={() => setStakeSide('left')}
                      disabled={isBattling}
                      className={`w-full py-2 rounded-lg font-semibold ${
                        stakeSide === 'left' 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {stakeSide === 'left' ? '✅ Betting on LEFT' : 'Bet on LEFT'}
                    </button>
                  </div>
                )}
              </div>

              <div className={`border-2 rounded-lg p-5 ${stakeSide === 'right' ? 'border-purple-500 bg-purple-50' : 'border-gray-200'}`}>
                <h3 className="font-bold text-lg mb-3">🥊 Right Fighter</h3>
                <select
                  value={rightCoin?.id || ''}
                  onChange={(e) => {
                    const coin = allCoins.find(c => c.id === parseInt(e.target.value))
                    setRightCoin(coin ? {...coin, id: coin.id} : null)
                  }}
                  className="w-full border-2 rounded-lg px-3 py-2 mb-3 font-medium"
                  disabled={isBattling}
                >
                  <option value="">Select fighter...</option>
                  {allCoins.map((c) => (
                    <option key={c.id} value={c.id}>{c.symbol} - {c.name} {c.hasBalance ? '✓' : ''}</option>
                  ))}
                </select>
                {rightCoin && (
                  <div className="bg-white border-2 rounded-lg p-4">
                    <div 
                      onClick={() => {
                        const tokenAddress = rightCoin.tokenAddress || rightCoin.id
                        if (tokenAddress) {
                          router.push(`/token/${tokenAddress}`)
                        }
                      }}
                      className="font-bold text-xl text-purple-600 cursor-pointer hover:text-purple-800 hover:underline transition-colors"
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
                      className="text-sm text-gray-600 mb-2 cursor-pointer hover:text-gray-800 hover:underline transition-colors"
                    >
                      {rightCoin.name}
                    </div>
                    <button
                      onClick={() => setStakeSide('right')}
                      disabled={isBattling}
                      className={`w-full py-2 rounded-lg font-semibold ${
                        stakeSide === 'right' 
                          ? 'bg-purple-600 text-white' 
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
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
                <label className="block text-sm font-semibold mb-2">Token to Stake</label>
                <select
                  value={stakeToken || selectedCoin}
                  onChange={(e) => {
                    setStakeToken(e.target.value)
                    setSelectedCoin(e.target.value)
                  }}
                  className="w-full border-2 rounded-lg px-3 py-2 font-medium"
                  disabled={isBattling}
                >
                  <option value="">Select your coin...</option>
                  {userCoins.map((c) => (
                    <option key={c.tokenAddress || c.id} value={c.tokenAddress || c.id}>
                      {c.symbol || 'UNKNOWN'} ({parseFloat(c.balance || '0').toFixed(4)}) - {c.name || 'Unknown Token'}
                    </option>
                  ))}
                </select>
                {userCoins.length === 0 && (
                  <p className="text-xs text-red-600 mt-1">You don't hold any coins. Buy some first!</p>
                )}
                {selectedCoin && (
                  <p className="text-xs text-blue-600 mt-1">💡 Using globally selected coin</p>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-semibold mb-2">Stake Amount</label>
                <input
                  type="number"
                  value={stakeAmount}
                  onChange={(e) => setStakeAmount(e.target.value)}
                  step="0.1"
                  min="0.1"
                  className="w-full border-2 rounded-lg px-3 py-2 font-medium"
                  disabled={isBattling}
                />
              </div>
            </div>

            <button
              onClick={startBattle}
              disabled={!address || !leftCoin || !rightCoin || !stakeSide || !stakeToken || isBattling}
              className="bg-gradient-to-r from-red-600 to-purple-600 text-white px-10 py-4 rounded-lg hover:from-red-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-lg shadow-lg mb-6"
            >
              {isBattling ? '🔄 AI Judging Battle...' : '⚔️ START BATTLE!'}
            </button>

            {battleResult && battleResult.judged && (
              <div className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-400 rounded-lg p-6 mb-6">
                <h3 className="text-2xl font-bold mb-4 text-center">🏆 Battle Results - AI Judge</h3>
                
                <div className="grid grid-cols-2 gap-6 mb-4">
                  <div className={`border-2 rounded-lg p-4 ${battleResult.winner === 'left' ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}>
                    <div 
                      onClick={() => {
                        const tokenAddress = leftCoin.tokenAddress || leftCoin.id
                        if (tokenAddress) {
                          router.push(`/token/${tokenAddress}`)
                        }
                      }}
                      className="font-bold text-xl mb-2 cursor-pointer hover:underline transition-colors"
                    >
                      {leftCoin.symbol}
                    </div>
                    <div className="text-4xl font-bold text-blue-600 mb-2">{battleResult.judged.left?.total || 0}/30</div>
                    <div className="text-xs space-y-1 text-gray-700">
                      <div>Virality: {battleResult.judged.left?.virality || 0}/10</div>
                      <div>Trend: {battleResult.judged.left?.trend || 0}/10</div>
                      <div>Creativity: {battleResult.judged.left?.creativity || 0}/10</div>
                    </div>
                    <div className="text-sm text-gray-600 mt-3 italic">
                      "{battleResult.judged.left?.reasons || 'No reasons'}"
                    </div>
                  </div>
                  
                  <div className={`border-2 rounded-lg p-4 ${battleResult.winner === 'right' ? 'border-green-500 bg-green-50' : 'border-gray-300'}`}>
                    <div 
                      onClick={() => {
                        const tokenAddress = rightCoin.tokenAddress || rightCoin.id
                        if (tokenAddress) {
                          router.push(`/token/${tokenAddress}`)
                        }
                      }}
                      className="font-bold text-xl mb-2 cursor-pointer hover:underline transition-colors"
                    >
                      {rightCoin.symbol}
                    </div>
                    <div className="text-4xl font-bold text-purple-600 mb-2">{battleResult.judged.right?.total || 0}/30</div>
                    <div className="text-xs space-y-1 text-gray-700">
                      <div>Virality: {battleResult.judged.right?.virality || 0}/10</div>
                      <div>Trend: {battleResult.judged.right?.trend || 0}/10</div>
                      <div>Creativity: {battleResult.judged.right?.creativity || 0}/10</div>
                    </div>
                    <div className="text-sm text-gray-600 mt-3 italic">
                      "{battleResult.judged.right?.reasons || 'No reasons'}"
                    </div>
                  </div>
                </div>

                <div className="text-center bg-white border-2 border-green-500 rounded-lg p-4">
                  <div className="text-2xl font-bold mb-2">
                    🏆 WINNER: <span className="text-green-600">
                      {battleResult.winner === 'left' ? leftCoin.symbol : rightCoin.symbol}
                    </span>
                  </div>
                  {battleResult.payoutTx && (
                    <div className="text-green-700 font-semibold">
                      💰 You won {parseFloat(stakeAmount) * 1.8} tokens!
                      <div className="text-xs text-gray-600 font-mono mt-1">
                        Tx: {battleResult.payoutTx.slice(0, 10)}...{battleResult.payoutTx.slice(-8)}
                      </div>
                    </div>
                  )}
                  <div className="text-xs text-gray-500 mt-2">Judged by POL Pump AI</div>
                </div>
              </div>
            )}

            <div>
              <h3 className="font-semibold mb-3 text-lg">📜 Recent Battles</h3>
              <div className="space-y-2">
                {battles.map((b) => (
                  <div key={b.id} className="bg-slate-50 border rounded-lg p-3 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <span className="font-semibold">{b.leftSymbol}</span>
                      <span className="text-gray-400">vs</span>
                      <span className="font-semibold">{b.rightSymbol}</span>
                    </div>
                    <div className="text-sm flex items-center gap-3">
                      <span className={b.leftScore > b.rightScore ? 'text-green-600 font-bold' : 'text-gray-500'}>
                        {b.leftScore}
                      </span>
                      <span className="text-gray-400">-</span>
                      <span className={b.rightScore > b.leftScore ? 'text-green-600 font-bold' : 'text-gray-500'}>
                        {b.rightScore}
                      </span>
                      <span className="text-xs text-gray-500">
                        🏆 {b.leftScore > b.rightScore ? b.leftSymbol : b.rightSymbol}
                      </span>
                    </div>
                  </div>
                ))}
                {battles.length === 0 && <p className="text-gray-500 text-center py-4">No battles yet - be the first!</p>}
              </div>
            </div>

            <div className="mt-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h3 className="font-semibold text-purple-900 mb-2">ℹ️ Battle Rules</h3>
              <ul className="text-sm text-purple-800 space-y-1">
                <li>• AI judges coins on 3 criteria: Virality, Trend Fit, Creativity (each 0-10)</li>
                <li>• Highest total score wins the battle</li>
                <li>• Win your bet = 1.8x payout (house takes 10% fee)</li>
                <li>• Powered by POL Pump AI - decentralized trading platform</li>
              </ul>
            </div>
          </div>
        )}

        {/* Mines Tab */}
        {activeTab === 'mines' && (
          <div className="bg-white border rounded-xl p-6 shadow-sm">
            <h2 className="text-2xl font-semibold mb-4">💣 Mines - Reveal & Win</h2>
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-6">
              <p className="text-orange-800 font-medium">
                ⚡ <strong>How it works:</strong> Click tiles to reveal gems 💎. Avoid bombs 💣! Cash out anytime with progressive multipliers. More mines = higher risk & reward!
              </p>
            </div>

            {gameStatus === 'idle' && (
              <div className="max-w-2xl mx-auto">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div>
                    <label className="block text-sm font-semibold mb-2">Mines Count</label>
                    <select value={minesCount} onChange={(e) => setMinesCount(parseInt(e.target.value))} className="w-full border-2 rounded-lg px-3 py-2 font-medium">
                      {[1, 3, 5, 10, 15, 20, 24].map(n => (<option key={n} value={n}>{n} Mines ({(n/25*100).toFixed(0)}%)</option>))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Token to Stake</label>
                    <select 
                      value={minesToken || selectedCoin} 
                      onChange={(e) => {
                        setMinesToken(e.target.value)
                        setSelectedCoin(e.target.value)
                      }} 
                      className="w-full border-2 rounded-lg px-3 py-2 font-medium"
                    >
                      <option value="">Select coin...</option>
                      {userCoins.map((c) => (<option key={c.tokenAddress || c.id} value={c.tokenAddress || c.id}>{c.symbol || 'UNKNOWN'} ({parseFloat(c.balance || '0').toFixed(4)})</option>))}
                    </select>
                    {selectedCoin && (
                      <p className="text-xs text-blue-600 mt-1">💡 Using globally selected coin</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold mb-2">Bet Amount</label>
                    <input type="number" value={minesBet} onChange={(e) => setMinesBet(e.target.value)} step="0.1" min="0.1" className="w-full border-2 rounded-lg px-3 py-2 font-medium" />
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
                      
                      // Try backend first, fallback to Next.js API
                      let res = await fetch(`${backend}/gaming/mines/start`, {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                          userAddress: address,
                          betAmount: parseFloat(minesBet),
                          minesCount,
                          tokenAddress: minesToken,
                          txHash: tx.hash
                        }),
                        signal: AbortSignal.timeout(5000)
                      }).catch(() => null)
                      
                      if (!res || !res.ok) {
                        // Fallback to Next.js API
                        res = await fetch('/api/gaming/mines/start', {
                          method: 'POST',
                          headers: {'Content-Type': 'application/json'},
                          body: JSON.stringify({
                            userAddress: address,
                            betAmount: parseFloat(minesBet),
                            minesCount,
                            tokenAddress: minesToken,
                            txHash: tx.hash
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
                        setMinesGame(data)
                        setGameStatus('active')
                        setRevealedTiles([])
                        setMinePositions([])
                        setCurrentMultiplier(1.0)
                      } else {
                        alert(data.error || 'Failed to start game')
                      }
                    } catch (e: any) {
                      alert(e.message || 'Failed')
                    }
                  }}
                  disabled={!address || !minesToken}
                  className="w-full bg-gradient-to-r from-orange-600 to-red-600 text-white px-8 py-4 rounded-lg hover:from-orange-700 hover:to-red-700 disabled:opacity-50 font-bold text-lg shadow-lg"
                >
                  💣 Start Game
                </button>
              </div>
            )}

            {gameStatus === 'active' && (<div><div className="flex justify-between items-center mb-6 bg-gradient-to-r from-orange-50 to-red-50 border-2 border-orange-300 rounded-lg p-4"><div><div className="text-sm text-gray-600">Multiplier</div><div className="text-3xl font-bold text-orange-600">{currentMultiplier.toFixed(2)}x</div></div><div><div className="text-sm text-gray-600">Potential Win</div><div className="text-2xl font-bold text-green-600">{(parseFloat(minesBet) * currentMultiplier).toFixed(4)}</div></div><button onClick={async () => { try { const res = await fetch(`${backend}/gaming/mines/cashout`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({gameId: minesGame.gameId})}); const data = await res.json(); if (data.success) { setGameStatus('cashed'); alert(`💰 Cashed out ${data.cashoutAmount.toFixed(4)} tokens!`); setTimeout(() => loadCoinsData(), 2000); } } catch (e: any) { alert(e.message) } }} disabled={revealedTiles.length === 0} className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 disabled:opacity-50 font-bold">💰 Cash Out</button></div><div className="grid grid-cols-5 gap-2 mb-4">{Array.from({ length: 25 }, (_, i) => { const isRevealed = revealedTiles.includes(i); const isMine = minePositions.includes(i); return (<button key={i} onClick={async () => { if (isRevealed) return; try { const res = await fetch(`${backend}/gaming/mines/reveal`, {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({gameId: minesGame.gameId, tileIndex: i})}); const data = await res.json(); if (data.hitMine) { setRevealedTiles(data.revealedTiles); setMinePositions(data.minePositions); setGameStatus('lost'); alert('💥 BOOM!'); } else { setRevealedTiles(data.revealedTiles); setCurrentMultiplier(data.currentMultiplier); if (data.status === 'won') { setMinePositions(data.minePositions); setGameStatus('won'); alert('🎉 WON!'); } } } catch (e: any) { alert(e.message) } }} disabled={isRevealed} className={`aspect-square text-2xl font-bold rounded-lg transition-all ${isRevealed ? (isMine ? 'bg-red-500 text-white' : 'bg-green-500 text-white') : 'bg-gray-200 hover:bg-gray-300 active:scale-95'}`}>{isRevealed ? (isMine ? '💣' : '💎') : '?'}</button>); })}</div><div className="text-center text-sm text-gray-600">{revealedTiles.length} / {25 - minesCount} revealed</div></div>)}

            {(gameStatus === 'lost' || gameStatus === 'won' || gameStatus === 'cashed') && (<div className="text-center"><div className={`text-4xl font-bold mb-4 ${gameStatus === 'won' || gameStatus === 'cashed' ? 'text-green-600' : 'text-red-600'}`}>{gameStatus === 'won' && '🎉 PERFECT!'}{gameStatus === 'lost' && '💥 BOOM!'}{gameStatus === 'cashed' && '💰 Cashed Out!'}</div><div className="grid grid-cols-5 gap-2 mb-6">{Array.from({ length: 25 }, (_, i) => (<div key={i} className={`aspect-square text-2xl font-bold rounded-lg flex items-center justify-center ${minePositions.includes(i) ? 'bg-red-500 text-white' : 'bg-green-500 text-white opacity-40'}`}>{minePositions.includes(i) ? '💣' : revealedTiles.includes(i) ? '💎' : ''}</div>))}</div><button onClick={() => { setGameStatus('idle'); setMinesGame(null); setRevealedTiles([]); setMinePositions([]); setCurrentMultiplier(1.0); }} className="bg-blue-600 text-white px-8 py-3 rounded-lg hover:bg-blue-700 font-bold">Play Again</button></div>)}

            <div className="mt-8 bg-orange-50 border border-orange-200 rounded-lg p-4"><h3 className="font-semibold text-orange-900 mb-2">ℹ️ How It Works</h3><ul className="text-sm text-orange-800 space-y-1"><li>• Progressive multipliers: Each safe tile increases your payout</li><li>• More mines = Higher multipliers but higher risk</li><li>• Cash out anytime to secure winnings!</li></ul></div>
          </div>
        )}

        {/* AI Arcade Tab */}
        {activeTab === 'arcade' && (
          <div className="bg-white border rounded-xl p-6 shadow-sm">
            <h2 className="text-2xl font-semibold mb-4">🎰 AI Arcade - Coinflip</h2>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <p className="text-blue-800 font-medium">
                ⚡ <strong>How it works:</strong> Stake your tokens, pick heads or tails. 
                Win = Auto 2x payout sent directly to your wallet! 
                Results verified with Polygon Amoy chain blockhash entropy.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium mb-1">Pick Side</label>
                <select
                  value={flipGuess}
                  onChange={(e) => setFlipGuess(e.target.value as 'heads'|'tails')}
                  className="w-full border rounded px-3 py-2"
                  disabled={isFlipping}
                >
                  <option value="heads">🪙 Heads</option>
                  <option value="tails">🎯 Tails</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Token to Stake</label>
                <select
                  value={flipToken || selectedCoin}
                  onChange={(e) => {
                    setFlipToken(e.target.value)
                    setSelectedCoin(e.target.value)
                  }}
                  className="w-full border rounded px-3 py-2"
                  disabled={isFlipping}
                >
                  <option value="">Select your coin...</option>
                  {userCoins.map((c) => (
                    <option key={c.tokenAddress || c.id} value={c.tokenAddress || c.id}>
                      {c.symbol || 'UNKNOWN'} ({parseFloat(c.balance || '0').toFixed(4)}) - {c.name || 'Unknown Token'}
                    </option>
                  ))}
                </select>
                {selectedCoin && (
                  <p className="text-xs text-blue-600 mt-1">💡 Using globally selected coin</p>
                )}
                {userCoins.length === 0 && (
                  <p className="text-xs text-red-600 mt-1">Buy some coins first!</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Wager Amount</label>
                <input
                  type="number"
                  value={flipWager}
                  onChange={(e) => setFlipWager(e.target.value)}
                  step="0.1"
                  min="0.1"
                  className="w-full border rounded px-3 py-2"
                  disabled={isFlipping}
                />
              </div>
            </div>

            <button
              onClick={playCoinflip}
              disabled={!address || !flipToken || isFlipping}
              className="bg-gradient-to-r from-green-600 to-blue-600 text-white px-8 py-3 rounded-lg hover:from-green-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed mb-6 font-bold text-lg shadow-lg"
            >
              {isFlipping ? '🔄 Flipping...' : '🪙 Flip Now!'}
            </button>

            {coinflipResult && (
              <div className={`border-2 rounded-lg p-6 mb-6 ${coinflipResult.outcome === 'win' ? 'bg-green-50 border-green-400' : 'bg-red-50 border-red-400'}`}>
                <div className="text-center">
                  <h3 className="text-3xl font-bold mb-2">
                    {coinflipResult.outcome === 'win' ? '🎉 YOU WON! 🎉' : '😢 You Lost'}
                  </h3>
                  <div className="text-6xl my-4">
                    {coinflipResult.result === 'heads' ? '🪙' : '🎯'}
                  </div>
                  <div className="text-2xl font-bold mb-2">
                    Result: <span className="text-purple-600">{coinflipResult.result.toUpperCase()}</span>
                  </div>
                  {coinflipResult.outcome === 'win' && (
                    <div className="bg-white border-2 border-green-500 rounded-lg p-4 mt-4">
                      <div className="text-lg font-semibold text-green-700">
                        💰 Payout: {parseFloat(flipWager) * 2} tokens
                      </div>
                      {coinflipResult.payoutTx && (
                        <div className="text-sm text-gray-600 mt-2">
                          Tx: <span className="font-mono">{coinflipResult.payoutTx.slice(0, 10)}...{coinflipResult.payoutTx.slice(-8)}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="text-sm text-gray-600 mt-4">
                    <div>Block #{coinflipResult.blockNumber}</div>
                    <div className="font-mono text-xs">Hash: {coinflipResult.blockHash?.slice(0, 20)}...</div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
              <div>
                <h3 className="font-semibold mb-2 text-lg">🏆 Leaderboard</h3>
                <div className="text-sm bg-slate-50 p-3 rounded border max-h-64 overflow-auto">
                  {leaderboard.map((r,i)=> (
                    <div key={i} className={`flex justify-between py-2 ${i < 3 ? 'font-bold' : ''}`}>
                      <span>
                        {i === 0 && '🥇 '}
                        {i === 1 && '🥈 '}
                        {i === 2 && '🥉 '}
                        <span className="font-mono">{r.userAddress.slice(0,6)}…{r.userAddress.slice(-4)}</span>
                      </span>
                      <span className="text-green-600">{r.wins}W / <span className="text-red-600">{r.losses}L</span> ({r.plays})</span>
                    </div>
                  ))}
                  {leaderboard.length===0 && <div className="text-slate-500 py-4 text-center">No plays yet - be the first!</div>}
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-lg">📜 Recent Plays</h3>
                <div className="text-sm bg-slate-50 p-3 rounded border max-h-64 overflow-auto">
                  {recent.map((r,i)=> (
                    <div key={i} className="flex justify-between py-2">
                      <span className="font-mono">{r.userAddress.slice(0,6)}…{r.userAddress.slice(-4)}</span>
                      <span className={r.outcome === 'win' ? 'text-green-600 font-semibold' : 'text-red-600'}>
                        {r.outcome.toUpperCase()} • {r.wager}
                      </span>
                    </div>
                  ))}
                  {recent.length===0 && <div className="text-slate-500 py-4 text-center">No recent plays</div>}
                </div>
              </div>
            </div>

            <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-900 mb-2">ℹ️ Fair Play Guarantee</h3>
              <ul className="text-sm text-yellow-800 space-y-1">
                <li>• Results determined by Polygon Amoy blockchain blockhash (verifiable)</li>
                <li>• Automatic 2x payout on wins - sent directly to your wallet</li>
                <li>• No house edge - pure 50/50 odds</li>
                <li>• All transactions on-chain and transparent</li>
              </ul>
            </div>
          </div>
        )}

        <div className="mt-6 text-center text-gray-500 text-sm">
          <p>🎮 All games powered by Polygon Amoy - Decentralized Trading Platform</p>
        </div>
        </div>
      </div>
      
      {/* Token Creator Modal */}
      <TokenCreatorModal
        isOpen={isCreateCoinModalOpen}
        onClose={() => setIsCreateCoinModalOpen(false)}
        onTokenCreated={(tokenData) => {
          console.log('✅ Token created:', tokenData)
          // Refresh coins list after creation
          if (address) {
            setTimeout(() => {
              loadCoinsData()
            }, 2000) // Wait 2 seconds for backend to index
          }
          setIsCreateCoinModalOpen(false)
        }}
      />
    </div>
  )
}
