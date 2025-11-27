/**
 * TypeScript types for gaming endpoints
 * These match the exact structure expected by the frontend in app/gaming/page.tsx
 */

// ==================== PumpPlay ====================

export interface PumpPlayCoin {
  id: string
  name: string
  symbol: string
  tokenAddress?: string
  imageHash?: string
  description?: string
  createdAt?: number
  creator?: string
  txHash?: string
  supply?: string
}

export interface PumpPlayBet {
  coinId: string
  total: number
}

export interface PumpPlayRound {
  id: number
  createdAt: number
  endsAt: number
  timeRemaining: number
  coinDetails: PumpPlayCoin[]
  candidates: string[]
  status: 'open' | 'closed' | 'resolved'
  winnerCoinId: string | null
  totalPool: number
  bets: PumpPlayBet[]
}

// ==================== Meme Royale ====================

export interface MemeRoyaleBattle {
  id: number
  leftCoin: PumpPlayCoin
  rightCoin: PumpPlayCoin
  leftSymbol: string
  rightSymbol: string
  leftScore: number
  rightScore: number
  winnerCoinId: string | null
  winnerCoin: PumpPlayCoin | null
  judge: string
  createdAt: number
}

export interface MemeRoyaleJudgedScore {
  virality: number
  trend: number
  creativity: number
  total: number
  reasons: string
}

export interface MemeRoyaleBattleResult {
  success: boolean
  judged: {
    left: MemeRoyaleJudgedScore
    right: MemeRoyaleJudgedScore
  }
  battleId: number
  leftScore: number
  rightScore: number
  winnerCoinId: string
  winner: 'left' | 'right'
  userWon: boolean
  message: string
  payoutTx?: string
}

// ==================== Coinflip ====================

export interface CoinflipGame {
  id: number
  userAddress: string
  wager: number
  outcome: 'win' | 'lose'
  result: 'heads' | 'tails'
  blockNumber: number | null
  blockHash: string | null
  createdAt: number
}

export interface CoinflipResult {
  success: boolean
  outcome: 'win' | 'lose'
  result: 'heads' | 'tails'
  userChoice: 'heads' | 'tails'
  won: boolean
  blockNumber: number | null
  blockHash: string | null
  payoutTx?: string
  provenanceHash?: string
}

export interface CoinflipLeaderboardEntry {
  userAddress: string
  totalGames: number
  wins: number
  losses: number
  plays: number
  totalWinnings?: number
  totalWagered?: number
  winRate?: string
}

export interface CoinflipRecentEntry {
  id: number
  userAddress: string
  wager: number
  outcome: 'win' | 'lose'
  won: boolean
  blockNumber: number | null
  blockHash: string | null
  createdAt: number
}

// ==================== Mines ====================

export interface MinesGame {
  gameId: number
  totalTiles: number
  minesCount: number
}

export interface MinesRevealResponse {
  success: boolean
  hitMine: boolean
  gameOver?: boolean
  won?: boolean
  revealedTile: number
  isMine: boolean
  currentMultiplier: number
  revealedTiles: number[]
  minePositions: number[]
  status: 'active' | 'won' | 'lost'
  gridState?: Array<{
    index: number
    revealed: boolean
    isMine: boolean
  }>
}

export interface MinesCashoutResponse {
  success: boolean
  cashoutAmount: number
  multiplier: number
}


