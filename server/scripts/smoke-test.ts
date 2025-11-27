/**
 * Smoke Test Script for Gaming Backend
 * 
 * Tests all endpoints to verify backend is working correctly.
 * 
 * Usage:
 *   cd server
 *   npx ts-node scripts/smoke-test.ts
 * 
 * Or with ts-node-dev:
 *   npx ts-node-dev scripts/smoke-test.ts
 */

// Use node-fetch for Node.js compatibility
// @ts-ignore - node-fetch types may not match exactly
import fetch from 'node-fetch'

const BASE_URL = process.env.BACKEND_URL || 'http://localhost:4000'
const TEST_ADDRESS = '0x1234567890123456789012345678901234567890' // Dummy address for testing

interface TestResult {
  name: string
  success: boolean
  status?: number
  error?: string
}

const results: TestResult[] = []

/**
 * Run a test and log the result
 */
async function runTest(
  name: string,
  method: 'GET' | 'POST',
  path: string,
  body?: any
): Promise<void> {
  try {
    const url = `${BASE_URL}${path}`
    const options: any = {
      method,
      headers: { 'Content-Type': 'application/json' }
    }
    
    if (body && method === 'POST') {
      options.body = JSON.stringify(body)
    }
    
    const response = await fetch(url, options)
    const data = await response.json().catch(() => ({ error: 'Invalid JSON response' }))
    
    if (response.ok) {
      results.push({ name, success: true, status: response.status })
      console.log(`✅ ${name}: ${response.status} OK`)
    } else {
      results.push({
        name,
        success: false,
        status: response.status,
        error: data.error || `HTTP ${response.status}`
      })
      console.log(`❌ ${name}: ${response.status} - ${data.error || 'Unknown error'}`)
    }
  } catch (error: any) {
    results.push({
      name,
      success: false,
      error: error.message || 'Request failed'
    })
    console.log(`❌ ${name}: ${error.message || 'Request failed'}`)
  }
}

/**
 * Main test runner
 */
async function runSmokeTests() {
  console.log('🧪 Starting smoke tests for gaming backend...\n')
  console.log(`📍 Base URL: ${BASE_URL}\n`)
  
  // Test 1: Health check
  console.log('1️⃣ Testing health endpoint...')
  await runTest('Health Check', 'GET', '/health')
  console.log('')
  
  // Test 2: Get coins (requires valid address format)
  console.log('2️⃣ Testing coins endpoint...')
  await runTest('Get Coins', 'GET', `/gaming/coins/${TEST_ADDRESS}`)
  console.log('')
  
  // Test 3: PumpPlay rounds
  console.log('3️⃣ Testing PumpPlay endpoints...')
  await runTest('Get PumpPlay Rounds', 'GET', '/gaming/pumpplay/rounds')
  await runTest('Place PumpPlay Bet', 'POST', '/gaming/pumpplay/bet', {
    roundId: 1,
    userAddress: TEST_ADDRESS,
    coinId: 'test-coin',
    amount: 0.5,
    tokenAddress: TEST_ADDRESS
  })
  console.log('')
  
  // Test 4: Meme Royale battles
  console.log('4️⃣ Testing Meme Royale endpoints...')
  await runTest('Get Meme Royale Battles', 'GET', '/gaming/meme-royale/battles')
  await runTest('Start Meme Royale Battle', 'POST', '/gaming/meme-royale', {
    leftCoin: { id: 'coin1', tokenAddress: TEST_ADDRESS },
    rightCoin: { id: 'coin2', tokenAddress: TEST_ADDRESS },
    userAddress: TEST_ADDRESS,
    stakeAmount: 0.5,
    stakeSide: 'left',
    tokenAddress: TEST_ADDRESS
  })
  console.log('')
  
  // Test 5: Coinflip
  console.log('5️⃣ Testing Coinflip endpoints...')
  await runTest('Get Coinflip Leaderboard', 'GET', '/gaming/coinflip/leaderboard')
  await runTest('Get Coinflip Recent', 'GET', '/gaming/coinflip/recent?limit=10')
  await runTest('Play Coinflip', 'POST', '/gaming/coinflip', {
    userAddress: TEST_ADDRESS,
    wager: 0.1,
    guess: 'heads',
    tokenAddress: TEST_ADDRESS
  })
  console.log('')
  
  // Test 6: Mines
  console.log('6️⃣ Testing Mines endpoints...')
  await runTest('Start Mines Game', 'POST', '/gaming/mines/start', {
    userAddress: TEST_ADDRESS,
    betAmount: 0.5,
    tokenAddress: TEST_ADDRESS,
    minesCount: 3
  })
  
  // Note: reveal and cashout require a valid gameId from start, so we test with invalid ID
  await runTest('Reveal Mines Tile', 'POST', '/gaming/mines/reveal', {
    gameId: 99999,
    tileIndex: 0
  })
  await runTest('Cashout Mines Game', 'POST', '/gaming/mines/cashout', {
    gameId: 99999
  })
  console.log('')
  
  // Summary
  console.log('📊 Test Summary:')
  console.log('='.repeat(50))
  const passed = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  
  results.forEach(result => {
    const icon = result.success ? '✅' : '❌'
    const status = result.status ? ` (${result.status})` : ''
    const error = result.error ? ` - ${result.error}` : ''
    console.log(`${icon} ${result.name}${status}${error}`)
  })
  
  console.log('='.repeat(50))
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`)
  
  if (failed === 0) {
    console.log('\n🎉 All tests passed! Backend is working correctly.')
    process.exit(0)
  } else {
    console.log('\n⚠️  Some tests failed. Check backend logs for details.')
    process.exit(1)
  }
}

// Run tests
runSmokeTests().catch(error => {
  console.error('❌ Smoke test runner failed:', error)
  process.exit(1)
})

