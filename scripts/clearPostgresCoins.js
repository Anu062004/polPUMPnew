/**
 * Script to clear all coins from PostgreSQL database
 * This will work with both Vercel Postgres and standard PostgreSQL
 * Usage: node scripts/clearPostgresCoins.js
 */

require('dotenv').config()

async function clearPostgreSQL() {
  try {
    // Try to use @vercel/postgres first
    try {
      const { sql } = require('@vercel/postgres')
      
      // Check if we have connection string
      if (process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL) {
        console.log('📂 Connecting to Vercel Postgres...')
        
        // Get count before deletion
        const countResult = await sql`SELECT COUNT(*) as count FROM coins`
        const countBefore = parseInt(countResult[0]?.count || '0', 10)
        
        // Delete all coins
        await sql`DELETE FROM coins`
        
        // Verify deletion
        const verifyResult = await sql`SELECT COUNT(*) as count FROM coins`
        const countAfter = parseInt(verifyResult[0]?.count || '0', 10)
        const deleted = countBefore - countAfter
        
        console.log(`✅ Cleared ${deleted} coins from Vercel Postgres database`)
        return deleted
      }
    } catch (vercelError) {
      console.log('ℹ️  Vercel Postgres not available, trying standard PostgreSQL...')
    }
    
    // Fallback to standard pg Pool
    const { Pool } = require('pg')
    
    const connectionString = process.env.POSTGRES_PRISMA_URL || 
                             process.env.POSTGRES_URL || 
                             process.env.POSTGRES_URL_NON_POOLING ||
                             process.env.DATABASE_URL
    
    if (!connectionString) {
      console.log('ℹ️  PostgreSQL not configured (no connection string found)')
      return 0
    }
    
    console.log('📂 Connecting to PostgreSQL...')
    const pool = new Pool({ connectionString })
    
    try {
      // Get count before deletion
      const countResult = await pool.query('SELECT COUNT(*) as count FROM coins')
      const countBefore = parseInt(countResult.rows[0]?.count || '0', 10)
      
      // Delete all coins
      await pool.query('DELETE FROM coins')
      
      // Verify deletion
      const verifyResult = await pool.query('SELECT COUNT(*) as count FROM coins')
      const countAfter = parseInt(verifyResult.rows[0]?.count || '0', 10)
      const deleted = countBefore - countAfter
      
      console.log(`✅ Cleared ${deleted} coins from PostgreSQL database`)
      return deleted
    } finally {
      await pool.end()
    }
  } catch (error) {
    if (error.message?.includes('not configured') || 
        error.message?.includes('POSTGRES_PRISMA_URL') ||
        error.message?.includes('not available') ||
        error.message?.includes('connection string')) {
      console.log('ℹ️  PostgreSQL not configured (nothing to clear)')
      return 0
    }
    console.error('⚠️  Error clearing PostgreSQL:', error.message)
    console.error('Full error:', error)
    return 0
  }
}

async function main() {
  console.log('🧹 Clearing all coins from PostgreSQL...\n')
  
  try {
    const deleted = await clearPostgreSQL()
    
    console.log('\n✅ PostgreSQL cleanup complete!')
    console.log(`   Deleted: ${deleted} coins`)
    console.log('\n💡 Note: If you still see tokens in the explore section,')
    console.log('   they might be cached in your browser. Clear browser cache or')
    console.log('   run in browser console:')
    console.log('   localStorage.clear()')
    
  } catch (error) {
    console.error('❌ Error clearing PostgreSQL:', error)
    process.exit(1)
  }
}

if (require.main === module) {
  main()
}

module.exports = { clearPostgreSQL }

