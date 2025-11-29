/**
 * Script to delete a specific coin by symbol or name
 * Usage: node scripts/delete-coin.js ACR
 * Or: node scripts/delete-coin.js "aryanchinr"
 */

const sqlite3 = require('sqlite3')
const { open } = require('sqlite')
const path = require('path')

const DB_PATH = path.join(__dirname, '..', 'data', 'coins.db')

async function deleteCoin(identifier) {
  try {
    const db = await open({
      filename: DB_PATH,
      driver: sqlite3.Database
    })

    // First, find the coin
    const coins = await db.all(
      `SELECT id, name, symbol, tokenAddress FROM coins 
       WHERE LOWER(symbol) = LOWER(?) OR LOWER(name) = LOWER(?) OR name LIKE ?`,
      [identifier, identifier, `%${identifier}%`]
    )

    if (coins.length === 0) {
      console.log(`❌ No coin found matching: ${identifier}`)
      await db.close()
      return
    }

    console.log(`\n📊 Found ${coins.length} coin(s) matching "${identifier}":`)
    coins.forEach(coin => {
      console.log(`   - ${coin.name} (${coin.symbol}) - ID: ${coin.id}`)
    })

    // Delete the coin(s)
    const result = await db.run(
      `DELETE FROM coins WHERE LOWER(symbol) = LOWER(?) OR LOWER(name) = LOWER(?) OR name LIKE ?`,
      [identifier, identifier, `%${identifier}%`]
    )

    await db.close()

    console.log(`\n✅ Deleted ${result.changes} coin(s)`)
    console.log('✨ Done!')
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

const identifier = process.argv[2] || 'ACR'
deleteCoin(identifier)


