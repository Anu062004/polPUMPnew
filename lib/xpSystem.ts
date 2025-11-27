/**
 * XP System for POL Pump
 * Tracks user experience points and levels based on platform activity
 */

export interface Quest {
  id: string
  name: string
  description: string
  xpReward: number
  type: 'trade' | 'create' | 'stake' | 'referral' | 'daily'
  requirements: {
    count?: number
    amount?: number
    days?: number
  }
  completed: boolean
  progress: number
}

export interface UserXP {
  wallet: string
  xp: number
  level: number
  totalTrades: number
  tokensCreated: number
  daysActive: number
  questsCompleted: number
}

const XP_PER_LEVEL = 1000
const XP_MULTIPLIER = 1.2 // Each level requires 20% more XP

export class XPSystem {
  /**
   * Calculate level from XP
   */
  static calculateLevel(xp: number): number {
    let level = 1
    let xpRequired = XP_PER_LEVEL

    while (xp >= xpRequired) {
      xp -= xpRequired
      level++
      xpRequired = Math.floor(XP_PER_LEVEL * Math.pow(XP_MULTIPLIER, level - 1))
    }

    return level
  }

  /**
   * Calculate XP required for next level
   */
  static xpForNextLevel(currentLevel: number): number {
    return Math.floor(XP_PER_LEVEL * Math.pow(XP_MULTIPLIER, currentLevel - 1))
  }

  /**
   * Calculate XP progress to next level
   */
  static xpProgress(xp: number, level: number): { current: number; required: number; percentage: number } {
    let xpInCurrentLevel = xp
    let xpRequired = XP_PER_LEVEL

    for (let l = 1; l < level; l++) {
      xpInCurrentLevel -= xpRequired
      xpRequired = Math.floor(XP_PER_LEVEL * Math.pow(XP_MULTIPLIER, l))
    }

    return {
      current: xpInCurrentLevel,
      required: xpRequired,
      percentage: (xpInCurrentLevel / xpRequired) * 100,
    }
  }

  /**
   * Award XP for trading
   */
  static awardTradeXP(tradeAmount: number, isBuy: boolean): number {
    // Base XP: 10 for buy, 5 for sell
    let baseXP = isBuy ? 10 : 5

    // Bonus XP based on trade size (capped at 100 XP per trade)
    const amountBonus = Math.min(Math.floor(tradeAmount / 1e18), 90) // 1 XP per MATIC, max 90

    return baseXP + amountBonus
  }

  /**
   * Award XP for creating token
   */
  static awardCreateTokenXP(): number {
    return 100 // Fixed reward for creating a token
  }

  /**
   * Award XP for daily activity
   */
  static awardDailyLoginXP(consecutiveDays: number): number {
    // 10 XP base, +5 for each consecutive day (max 50 XP)
    return 10 + Math.min(consecutiveDays * 5, 40)
  }

  /**
   * Award XP for referral
   */
  static awardReferralXP(): number {
    return 50 // Fixed reward for referring a user
  }

  /**
   * Get available quests
   */
  static getQuests(userStats: Partial<UserXP>): Quest[] {
    const quests: Quest[] = [
      {
        id: 'first_trade',
        name: 'First Trade',
        description: 'Complete your first trade',
        xpReward: 25,
        type: 'trade',
        requirements: { count: 1 },
        completed: (userStats.totalTrades || 0) >= 1,
        progress: Math.min((userStats.totalTrades || 0) / 1, 1),
      },
      {
        id: 'trader_10',
        name: 'Active Trader',
        description: 'Complete 10 trades',
        xpReward: 100,
        type: 'trade',
        requirements: { count: 10 },
        completed: (userStats.totalTrades || 0) >= 10,
        progress: Math.min((userStats.totalTrades || 0) / 10, 1),
      },
      {
        id: 'trader_100',
        name: 'Power Trader',
        description: 'Complete 100 trades',
        xpReward: 500,
        type: 'trade',
        requirements: { count: 100 },
        completed: (userStats.totalTrades || 0) >= 100,
        progress: Math.min((userStats.totalTrades || 0) / 100, 1),
      },
      {
        id: 'create_token',
        name: 'Token Creator',
        description: 'Create your first token',
        xpReward: 200,
        type: 'create',
        requirements: { count: 1 },
        completed: (userStats.tokensCreated || 0) >= 1,
        progress: Math.min((userStats.tokensCreated || 0) / 1, 1),
      },
      {
        id: 'daily_3',
        name: 'Consistent Trader',
        description: 'Trade for 3 consecutive days',
        xpReward: 150,
        type: 'daily',
        requirements: { days: 3 },
        completed: (userStats.daysActive || 0) >= 3,
        progress: Math.min((userStats.daysActive || 0) / 3, 1),
      },
      {
        id: 'daily_7',
        name: 'Weekly Warrior',
        description: 'Trade for 7 consecutive days',
        xpReward: 500,
        type: 'daily',
        requirements: { days: 7 },
        completed: (userStats.daysActive || 0) >= 7,
        progress: Math.min((userStats.daysActive || 0) / 7, 1),
      },
    ]

    return quests
  }

  /**
   * Check and complete quests
   */
  static checkQuests(userStats: Partial<UserXP>, completedQuestIds: string[]): {
    newQuests: Quest[]
    totalXPReward: number
  } {
    const availableQuests = this.getQuests(userStats)
    const newQuests = availableQuests.filter(
      quest => quest.completed && !completedQuestIds.includes(quest.id)
    )
    const totalXPReward = newQuests.reduce((sum, quest) => sum + quest.xpReward, 0)

    return { newQuests, totalXPReward }
  }
}


