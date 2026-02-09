/**
 * Script to remove specific test tokens from databases
 * Usage: node scripts/cleanup-test-tokens.js
 */

const sqlite3 = require('sqlite3')
const { open } = require('sqlite')
const path = require('path')
const fs = require('fs').promises

// Test tokens to remove
const TEST_TOKENS = ['WOW', 'meme1', 'DEC', 'aaaaa', 'Abcd', 'DOGEWOW']

async function cleanupSQLite() {
    const dbPath = path.join(__dirname, '..', 'data', 'coins.db')

    try {
        // Check if database exists
        await fs.access(dbPath)
        console.log('📂 SQLite database found, removing test tokens...')

        const db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        })

        let totalRemoved = 0
        for (const symbol of TEST_TOKENS) {
            const result = await db.run('DELETE FROM coins WHERE symbol = ?', symbol)
            if (result.changes > 0) {
                console.log(`   ✅ Removed ${result.changes} token(s) with symbol: ${symbol}`)
                totalRemoved += result.changes
            }
        }

        await db.close()

        console.log(`✅ Total removed from SQLite: ${totalRemoved} tokens`)
        return totalRemoved
    } catch (error) {
        if (error.code === 'ENOENT') {
            console.log('ℹ️  SQLite database does not exist (nothing to clean)')
            return 0
        }
        throw error
    }
}

async function cleanupPostgreSQL() {
    try {
        const { getSql } = require('../lib/postgresManager')
        const sql = await getSql()

        if (!sql) {
            console.log('ℹ️  PostgreSQL not configured (nothing to clean)')
            return 0
        }

        console.log('📂 PostgreSQL connected, removing test tokens...')

        let totalRemoved = 0
        for (const symbol of TEST_TOKENS) {
            const result = await sql`
        DELETE FROM coins 
        WHERE symbol = ${symbol}
      `
            if (result.count > 0) {
                console.log(`   ✅ Removed ${result.count} token(s) with symbol: ${symbol}`)
                totalRemoved += result.count
            }
        }

        console.log(`✅ Total removed from PostgreSQL: ${totalRemoved} tokens`)

        // Show remaining tokens
        const remaining = await sql`SELECT symbol, name, creator FROM coins ORDER BY created_at DESC`
        console.log(`\n📋 Remaining tokens in database: ${remaining.length}`)
        remaining.forEach(coin => {
            console.log(`   - ${coin.symbol} (${coin.name}) by ${coin.creator?.slice(0, 10)}...`)
        })

        return totalRemoved
    } catch (error) {
        if (error.message?.includes('not configured') ||
            error.message?.includes('POSTGRES_PRISMA_URL') ||
            error.message?.includes('not available')) {
            console.log('ℹ️  PostgreSQL not configured (nothing to clean)')
            return 0
        }
        console.error('⚠️  Error cleaning PostgreSQL:', error.message)
        return 0
    }
}

async function main() {
    console.log('🧹 Removing test tokens from databases...\n')
    console.log(`Test tokens to remove: ${TEST_TOKENS.join(', ')}\n`)

    let sqliteCount = 0
    let postgresCount = 0

    try {
        // Clean SQLite
        sqliteCount = await cleanupSQLite()

        // Clean PostgreSQL
        postgresCount = await cleanupPostgreSQL()

        console.log('\n✅ Test token cleanup complete!')
        console.log(`   SQLite: ${sqliteCount} tokens removed`)
        console.log(`   PostgreSQL: ${postgresCount} tokens removed`)
        console.log('\n💡 Tip: Refresh your gaming page to see the updated token list.')

    } catch (error) {
        console.error('❌ Error cleaning test tokens:', error)
        process.exit(1)
    }
}

if (require.main === module) {
    main()
}

module.exports = { cleanupSQLite, cleanupPostgreSQL }
