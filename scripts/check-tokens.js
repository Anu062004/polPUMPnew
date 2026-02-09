// Quick script to check database tokens
const { getSql } = require('./lib/postgresManager');

(async () => {
    try {
        const sql = await getSql();
        if (sql) {
            const coins = await sql`SELECT symbol, name, token_address, created_at FROM coins ORDER BY created_at DESC`;
            console.log(`\n✅ Tokens in PostgreSQL database: ${coins.length}\n`);

            if (coins.length === 0) {
                console.log('   No tokens found in database.');
            } else {
                coins.forEach((c, i) => {
                    const date = new Date(c.created_at).toLocaleString();
                    console.log(`   ${i + 1}. ${c.symbol} (${c.name})`);
                    console.log(`      Address: ${c.token_address || 'N/A'}`);
                    console.log(`      Created: ${date}\n`);
                });
            }
        } else {
            console.log('❌ PostgreSQL not available');
        }
    } catch (error) {
        console.error('Error:', error.message);
    }
})();
