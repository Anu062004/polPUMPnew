/**
 * Script to delete all coins from Prisma/PostgreSQL database
 * Usage: node scripts/deleteCoinsFromPrisma.js
 * 
 * Make sure you have POSTGRES_PRISMA_URL or POSTGRES_URL in your .env file
 */

require('dotenv').config()

async function deleteAllCoins() {
  try {
    console.log('🔗 Connecting to Prisma/PostgreSQL database...\n')
    
    // Try @vercel/postgres first (for Vercel Postgres)
    try {
      const { sql } = require('@vercel/postgres')
      
      if (process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL) {
        console.log('📊 Checking current coin count...')
        const countResult = await sql`SELECT COUNT(*) as count FROM coins`
        const countBefore = parseInt(countResult[0]?.count || '0', 10)
        
        if (countBefore === 0) {
          console.log('✅ No coins found in database. Nothing to delete.')
          return
        }
        
        console.log(`📦 Found ${countBefore} coins in database`)
        console.log('🗑️  Deleting all coins...')
        
        // Delete all coins
        await sql`DELETE FROM coins`
        
        // Verify deletion
        const verifyResult = await sql`SELECT COUNT(*) as count FROM coins`
        const countAfter = parseInt(verifyResult[0]?.count || '0', 10)
        const deleted = countBefore - countAfter
        
        console.log(`\n✅ Successfully deleted ${deleted} coins from Prisma database!`)
        console.log(`   Before: ${countBefore} coins`)
        console.log(`   After: ${countAfter} coins`)
        return
      }
    } catch (vercelError) {
      console.log('ℹ️  Vercel Postgres not available, trying standard PostgreSQL...\n')
    }
    
    // Fallback to standard pg Pool
    const { Pool } = require('pg')
    
    const connectionString = process.env.POSTGRES_PRISMA_URL || 
                             process.env.POSTGRES_URL || 
                             process.env.POSTGRES_URL_NON_POOLING ||
                             process.env.DATABASE_URL
    
    if (!connectionString) {
      console.error('❌ Error: No PostgreSQL connection string found!')
      console.error('\n💡 Please set one of these in your .env file:')
      console.error('   - POSTGRES_PRISMA_URL (recommended for Vercel)')
      console.error('   - POSTGRES_URL')
      console.error('   - DATABASE_URL')
      process.exit(1)
    }
    
    console.log('📊 Connecting to PostgreSQL...')
    const pool = new Pool({ connectionString })
    
    try {
      // Get count before deletion
      const countResult = await pool.query('SELECT COUNT(*) as count FROM coins')
      const countBefore = parseInt(countResult.rows[0]?.count || '0', 10)
      
      if (countBefore === 0) {
        console.log('✅ No coins found in database. Nothing to delete.')
        return
      }
      
      console.log(`📦 Found ${countBefore} coins in database`)
      console.log('🗑️  Deleting all coins...')
      
      // Delete all coins
      await pool.query('DELETE FROM coins')
      
      // Verify deletion
      const verifyResult = await pool.query('SELECT COUNT(*) as count FROM coins')
      const countAfter = parseInt(verifyResult.rows[0]?.count || '0', 10)
      const deleted = countBefore - countAfter
      
      console.log(`\n✅ Successfully deleted ${deleted} coins from Prisma database!`)
      console.log(`   Before: ${countBefore} coins`)
      console.log(`   After: ${countAfter} coins`)
    } finally {
      await pool.end()
    }
  } catch (error) {
    console.error('\n❌ Error deleting coins:', error.message)
    console.error('\n💡 Troubleshooting:')
    console.error('   1. Check that your .env file has the correct connection string')
    console.error('   2. Verify your database is accessible')
    console.error('   3. Make sure you have the required packages: npm install pg @vercel/postgres')
    console.error('\nFull error:', error)
    process.exit(1)
  }
}

async function main() {
  console.log('🧹 Deleting all coins from Prisma/PostgreSQL database\n')
  console.log('⚠️  WARNING: This will permanently delete ALL coins from your database!')
  console.log('   Make sure you have a backup if needed.\n')
  
  await deleteAllCoins()
  
  console.log('\n✨ Done! All testnet tokens have been removed.')
  console.log('\n💡 Next steps:')
  console.log('   1. Refresh your explore page - tokens should be gone')
  console.log('   2. Clear browser cache if tokens still appear:')
  console.log('      - Open browser console (F12)')
  console.log('      - Run: localStorage.clear()')
  console.log('      - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)')
}

if (require.main === module) {
  main()
}

module.exports = { deleteAllCoins }

