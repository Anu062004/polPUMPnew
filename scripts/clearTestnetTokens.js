/**
 * Script to clear all testnet tokens from databases
 * This removes all tokens created on Polygon Amoy testnet
 * Usage: node scripts/clearTestnetTokens.js
 */

const sqlite3 = require('sqlite3')
const { open } = require('sqlite')
const path = require('path')
const fs = require('fs').promises

async function clearSQLite() {
  const dbPath = path.join(__dirname, '..', 'data', 'coins.db')
  
  try {
    // Check if database exists
    await fs.access(dbPath)
    console.log('📂 SQLite database found, clearing testnet tokens...')
    
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    })
    
    // Get count before deletion
    const countResult = await db.get('SELECT COUNT(*) as count FROM coins')
    const countBefore = countResult?.count || 0
    
    // Delete all coins (since we switched to mainnet, all existing coins are from testnet)
    const result = await db.run('DELETE FROM coins')
    await db.close()
    
    console.log(`✅ Cleared ${result.changes} testnet tokens from SQLite database`)
    return result.changes
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.log('ℹ️  SQLite database does not exist (nothing to clear)')
      return 0
    }
    throw error
  }
}

async function clearPostgreSQL() {
  try {
    // Try to import postgresManager
    let getSql
    try {
      const postgresManager = require('../lib/postgresManager')
      getSql = postgresManager.getSql || postgresManager.default?.getSql
    } catch (e) {
      // If module not found, try alternative import
      console.log('ℹ️  PostgreSQL manager not available (skipping PostgreSQL cleanup)')
      return 0
    }
    
    if (!getSql) {
      console.log('ℹ️  PostgreSQL getSql function not available')
      return 0
    }
    
    const sql = await getSql()
    
    if (!sql) {
      console.log('ℹ️  PostgreSQL not configured (nothing to clear)')
      return 0
    }
    
    console.log('📂 PostgreSQL connected, clearing testnet tokens...')
    
    // Get count before deletion
    const countResult = await sql`SELECT COUNT(*) as count FROM coins`
    const countBefore = countResult[0]?.count || 0
    
    // Delete all coins (since we switched to mainnet, all existing coins are from testnet)
    await sql`DELETE FROM coins`
    
    // Verify deletion
    const verifyResult = await sql`SELECT COUNT(*) as count FROM coins`
    const countAfter = verifyResult[0]?.count || 0
    const deleted = countBefore - countAfter
    
    console.log(`✅ Cleared ${deleted} testnet tokens from PostgreSQL database`)
    return deleted
  } catch (error) {
    if (error.message?.includes('not configured') || 
        error.message?.includes('POSTGRES_PRISMA_URL') ||
        error.message?.includes('not available')) {
      console.log('ℹ️  PostgreSQL not configured (nothing to clear)')
      return 0
    }
    console.error('⚠️  Error clearing PostgreSQL:', error.message)
    return 0
  }
}

async function clearProfileData() {
  try {
    const profilesPath = path.join(__dirname, '..', 'data', 'profiles.json')
    
    // Check if profiles.json exists
    try {
      await fs.access(profilesPath)
      console.log('📂 Clearing token data from profiles...')
      
      const profilesData = await fs.readFile(profilesPath, 'utf8')
      const profiles = JSON.parse(profilesData)
      
      let clearedCount = 0
      
      // Clear tokensCreated from all profiles
      for (const wallet in profiles) {
        if (profiles[wallet].tokensCreated && profiles[wallet].tokensCreated.length > 0) {
          clearedCount += profiles[wallet].tokensCreated.length
          profiles[wallet].tokensCreated = []
        }
      }
      
      await fs.writeFile(profilesPath, JSON.stringify(profiles, null, 2))
      console.log(`✅ Cleared ${clearedCount} tokens from ${Object.keys(profiles).length} profiles`)
      return clearedCount
    } catch (error) {
      if (error.code === 'ENOENT') {
        console.log('ℹ️  profiles.json does not exist (nothing to clear)')
        return 0
      }
      throw error
    }
  } catch (error) {
    console.error('⚠️  Error clearing profile data:', error.message)
    return 0
  }
}

async function main() {
  console.log('🧹 Clearing all testnet tokens...\n')
  console.log('⚠️  Note: Since we switched to Polygon Mainnet, all existing tokens are from testnet.')
  console.log('   This will remove all tokens from the database.\n')
  
  let sqliteCount = 0
  let postgresCount = 0
  let profileCount = 0
  
  try {
    // Clear SQLite
    sqliteCount = await clearSQLite()
    
    // Clear PostgreSQL
    postgresCount = await clearPostgreSQL()
    
    // Clear profile data
    profileCount = await clearProfileData()
    
    console.log('\n✅ Testnet token cleanup complete!')
    console.log(`   SQLite: ${sqliteCount} tokens cleared`)
    console.log(`   PostgreSQL: ${postgresCount} tokens cleared`)
    console.log(`   Profiles: ${profileCount} tokens cleared`)
    console.log('\n💡 Next steps:')
    console.log('   1. Create new tokens on Polygon Mainnet')
    console.log('   2. Clear browser localStorage if needed:')
    console.log('      - Open browser console (F12)')
    console.log('      - Run: localStorage.removeItem("pol_coins_data")')
    console.log('      - Run: localStorage.removeItem("0g_coins")')
    console.log('      - Run: localStorage.removeItem("pol_coins")')
    
  } catch (error) {
    console.error('❌ Error clearing testnet tokens:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = { clearSQLite, clearPostgreSQL, clearProfileData }

