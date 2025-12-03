/**
 * Script to delete all coins except PEPEMAXXXX (PEPA)
 * Run with: node scripts/delete-coins-except-pepa.js
 */

const sqlite3 = require('sqlite3')
const { open } = require('sqlite')
const path = require('path')
const fs = require('fs').promises

const DB_PATH = path.join(__dirname, '..', 'data', 'coins.db')

async function deleteCoinsExceptPEPA() {
  try {
    // Check if database exists
    try {
      await fs.access(DB_PATH)
    } catch {
      console.log('❌ Database not found at:', DB_PATH)
      return
    }

    const db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    })

    // First, check what coins exist
    const allCoins = await db.all('SELECT id, name, symbol FROM coins')
    console.log(`\n📊 Found ${allCoins.length} coins in database:`)
    allCoins.forEach(coin => {
      console.log(`   - ${coin.name} (${coin.symbol})`)
    })

    // Delete all coins except PEPA (case-insensitive)
    const result = await db.run(
      'DELETE FROM coins WHERE LOWER(symbol) != LOWER(?)',
      ['PEPA']
    )

    await db.close()

    console.log(`\n✅ Deleted ${result.changes} coins`)
    console.log('✅ Kept only PEPEMAXXXX (PEPA)')
    console.log('\n📊 Remaining coins:')
    
    // Verify what's left
    const db2 = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    })
    const remaining = await db2.all('SELECT id, name, symbol FROM coins')
    remaining.forEach(coin => {
      console.log(`   - ${coin.name} (${coin.symbol})`)
    })
    await db2.close()

    console.log('\n✨ Done!')
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

deleteCoinsExceptPEPA()






