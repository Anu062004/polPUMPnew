/**
 * Script to clear all coin data from databases
 * Usage: node scripts/clearAllCoins.js
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
    console.log('📂 SQLite database found, clearing coins...')
    
    const db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    })
    
    const result = await db.run('DELETE FROM coins')
    await db.close()
    
    console.log(`✅ Cleared ${result.changes} coins from SQLite database`)
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
    const { getSql } = require('../lib/postgresManager')
    const sql = await getSql()
    
    if (!sql) {
      console.log('ℹ️  PostgreSQL not configured (nothing to clear)')
      return 0
    }
    
    console.log('📂 PostgreSQL connected, clearing coins...')
    const result = await sql`DELETE FROM coins`
    
    // Get count (PostgreSQL DELETE returns rowCount)
    const countResult = await sql`SELECT COUNT(*) as count FROM coins`
    const count = countResult[0]?.count || 0
    
    console.log(`✅ Cleared coins from PostgreSQL database`)
    return result.count || 0
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

async function main() {
  console.log('🧹 Clearing all coin data...\n')
  
  let sqliteCount = 0
  let postgresCount = 0
  
  try {
    // Clear SQLite
    sqliteCount = await clearSQLite()
    
    // Clear PostgreSQL
    postgresCount = await clearPostgreSQL()
    
    console.log('\n✅ Coin data clearing complete!')
    console.log(`   SQLite: ${sqliteCount} coins cleared`)
    console.log(`   PostgreSQL: ${postgresCount} coins cleared`)
    console.log('\n⚠️  Note: localStorage data is client-side and must be cleared in the browser.')
    console.log('   Open browser console and run: localStorage.removeItem("pol_coins_data")')
    console.log('   Or: localStorage.removeItem("0g_coins")')
    console.log('   Or: localStorage.removeItem("pol_coins")')
    
  } catch (error) {
    console.error('❌ Error clearing coins:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = { clearSQLite, clearPostgreSQL }








