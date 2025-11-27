/**
 * POL Pump Gaming Backend Server
 * 
 * Dedicated backend server for all gaming endpoints expected by the frontend.
 * Uses SQLite3 for data storage and matches the exact API contract from app/gaming/page.tsx
 * 
 * Setup:
 *   cd server
 *   npm install
 *   npm run dev
 * 
 * Production:
 *   npm run build
 *   npm start
 * 
 * See README.md and .env.example for configuration details.
 */

import express, { Request, Response, NextFunction } from 'express'
import cors from 'cors'
import { config, validateConfig, printConfigSummary } from './config'
import { getGamingDatabase, getCoinsDatabase, closeDatabases, runMigrations } from './db'
import { getTokenBalance, getLatestBlock, testRpcConnection, getProvider } from './blockchain'
import { ethers } from 'ethers'

const app = express()

// Middleware
app.use(cors({
  origin: config.server.cors.origin,
  credentials: config.server.cors.credentials
}))
app.use(express.json())

// Request logging middleware (logs method, path, and critical params)
app.use((req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now()
  
  // Extract critical parameters (non-sensitive)
  const params: Record<string, any> = {}
  if (req.params.address) params.address = `${req.params.address.slice(0, 6)}...${req.params.address.slice(-4)}`
  if (req.body?.userAddress) params.userAddress = `${req.body.userAddress.slice(0, 6)}...${req.body.userAddress.slice(-4)}`
  if (req.body?.gameId) params.gameId = req.body.gameId
  if (req.body?.roundId) params.roundId = req.body.roundId
  if (req.body?.tileIndex !== undefined) params.tileIndex = req.body.tileIndex
  if (req.body?.minesCount) params.minesCount = req.body.minesCount
  if (req.body?.coinId) params.coinId = req.body.coinId
  if (req.query?.limit) params.limit = req.query.limit
  
  const paramsStr = Object.keys(params).length > 0 
    ? `\n   Params: ${JSON.stringify(params)}`
    : ''
  
  console.log(`📥 ${req.method} ${req.path}${paramsStr}`)
  
  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - startTime
    const statusEmoji = res.statusCode >= 500 ? '❌' : res.statusCode >= 400 ? '⚠️' : '✅'
    console.log(`${statusEmoji} ${res.statusCode} ${req.method} ${req.path} (${duration}ms)`)
  })
  
  next()
})

// ERC20 ABI for token balance queries (kept for compatibility with existing code)
const ERC20_ABI = [
  'function balanceOf(address account) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
]

// Error handler middleware
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }
}

// ==================== HEALTH CHECK ====================

app.get('/health', async (req: Request, res: Response) => {
  try {
    // Test database connection
    await getGamingDatabase()
    await getCoinsDatabase()
    
    // Test RPC connection (non-blocking)
    const rpcHealthy = await testRpcConnection()
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      databases: 'connected',
      rpc: rpcHealthy ? 'connected' : 'unavailable'
    })
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      error: error.message
    })
  }
})

// ==================== GAMING: COINS ====================

app.get('/gaming/coins/:address', asyncHandler(async (req: Request, res: Response) => {
  const userAddress = req.params.address

  if (!userAddress || !ethers.isAddress(userAddress)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid address',
      coins: [],
      userHoldings: [],
      totalCoins: 0,
      coinsWithBalance: 0
    })
  }

  // Use centralized provider from blockchain module
  const provider = getProvider()
  const db = await getCoinsDatabase()

  // Get all coins from database
  const coins = await db.all(`
    SELECT * FROM coins 
    WHERE tokenAddress IS NOT NULL AND tokenAddress != ''
    ORDER BY createdAt DESC
    LIMIT 100
  `)

  // Fetch balances for all coins
  const userHoldings: any[] = []
  const coinsWithData: any[] = []

  // Process coins in batches to avoid rate limits
  const batchSize = 10
  for (let i = 0; i < coins.length; i += batchSize) {
    const batch = coins.slice(i, i + batchSize)

    await Promise.all(
      batch.map(async (coin: any) => {
        try {
          if (!coin.tokenAddress) return

          // Use centralized blockchain helper (non-blocking)
          const balance = await getTokenBalance(coin.tokenAddress, userAddress)
          const hasBalance = parseFloat(balance) > 0

          const coinData = {
            id: coin.id || coin.txHash,
            name: coin.name,
            symbol: coin.symbol,
            tokenAddress: coin.tokenAddress,
            curveAddress: coin.curveAddress || null,
            imageHash: coin.imageHash,
            description: coin.description,
            createdAt: coin.createdAt,
            creator: coin.creator,
            txHash: coin.txHash,
            supply: coin.supply,
            hasBalance
          }

          coinsWithData.push(coinData)

          if (hasBalance) {
            userHoldings.push({
              ...coinData,
              balance,
              hasBalance: true
            })
          }
        } catch (error: any) {
          console.warn(`Error processing coin ${coin.id}:`, error.message)
          coinsWithData.push({
            id: coin.id || coin.txHash,
            name: coin.name,
            symbol: coin.symbol,
            tokenAddress: coin.tokenAddress,
            curveAddress: coin.curveAddress || null,
            imageHash: coin.imageHash,
            description: coin.description,
            createdAt: coin.createdAt,
            creator: coin.creator,
            txHash: coin.txHash,
            supply: coin.supply,
            hasBalance: false
          })
        }
      })
    )

    // Small delay between batches
    if (i + batchSize < coins.length) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
  }

  res.json({
    success: true,
    coins: coinsWithData,
    userHoldings: userHoldings,
    totalCoins: coinsWithData.length,
    coinsWithBalance: userHoldings.length
  })
}))

// Import gaming route handlers
import { setupPumpPlayRoutes } from './routes/pumpplay'
import { setupMemeRoyaleRoutes } from './routes/meme-royale'
import { setupCoinflipRoutes } from './routes/coinflip'
import { setupMinesRoutes } from './routes/mines'

// Setup all gaming routes with centralized database getters
// getProvider is imported from blockchain module
setupPumpPlayRoutes(app, getGamingDatabase, getCoinsDatabase)
setupMemeRoyaleRoutes(app, getGamingDatabase, getCoinsDatabase, getProvider)
setupCoinflipRoutes(app, getGamingDatabase, getProvider)
setupMinesRoutes(app, getGamingDatabase)

// Global error handler (catches unhandled errors)
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  // Enhanced error logging with full stack trace
  console.error('❌ Unhandled server error:', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  })
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  })
})

// Graceful shutdown handler
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...')
  await closeDatabases()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  console.log('\n🛑 Shutting down gracefully...')
  await closeDatabases()
  process.exit(0)
})

// Start server
async function startServer() {
  try {
    // Validate configuration
    validateConfig()
    printConfigSummary()

    // Initialize databases and run migrations
    await getGamingDatabase()
    await getCoinsDatabase()
    await runMigrations()

    // Test RPC connection (non-blocking)
    const rpcHealthy = await testRpcConnection()
    if (rpcHealthy) {
      console.log('✅ RPC connection healthy')
    } else {
      console.warn('⚠️ RPC connection unavailable (on-chain features disabled)')
    }

    app.listen(config.server.port, () => {
      console.log(`🚀 Gaming backend server running on port ${config.server.port}`)
      console.log(`📡 Health check: http://localhost:${config.server.port}/health`)
      console.log(`🌐 CORS origin: ${config.server.cors.origin}`)
    })
  } catch (error) {
    console.error('❌ Failed to start server:', error)
    process.exit(1)
  }
}

startServer()
