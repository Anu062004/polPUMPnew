# PostgreSQL Setup Guide (Vercel Postgres)

This project now uses **Vercel Postgres** for production database storage instead of SQLite. This provides persistent, scalable database storage that works perfectly in serverless environments.

## Setup Instructions

### 1. Create Vercel Postgres Database

1. Go to your Vercel project dashboard
2. Navigate to **Storage** → **Create Database**
3. Select **Postgres**
4. Choose a name for your database (e.g., `pol-pump-db`)
5. Select a region closest to your users
6. Click **Create**

### 2. Environment Variables

Vercel will automatically add these environment variables to your project:
- `POSTGRES_URL` - Connection string for the database
- `POSTGRES_PRISMA_URL` - Prisma-compatible connection string
- `POSTGRES_URL_NON_POOLING` - Direct connection (for migrations)

These are automatically available in your Next.js API routes.

### 3. Local Development

For local development, you have two options:

#### Option A: Use Vercel Postgres (Recommended)
1. Copy the `POSTGRES_URL` from your Vercel project settings
2. Add it to your `.env.local` file:
```env
POSTGRES_URL=postgres://user:password@host:port/database
```

#### Option B: Use Local PostgreSQL
1. Install PostgreSQL locally
2. Create a database:
```bash
createdb polpump
```
3. Add to `.env.local`:
```env
DATABASE_URL=postgresql://localhost:5432/polpump
```

### 4. Initialize Database Schema

The database schema is automatically initialized on first use. When you deploy or run the app, the tables will be created automatically.

If you need to manually initialize:
```typescript
import { initializeSchema } from './lib/postgresManager'
await initializeSchema()
```

## Migration from SQLite

The application automatically uses PostgreSQL when `POSTGRES_URL` is available. If you have existing SQLite data:

1. **Export SQLite data** (if needed):
```bash
sqlite3 data/coins.db .dump > coins_backup.sql
```

2. **Import to PostgreSQL** (manual process):
   - Use a tool like [pgloader](https://pgloader.readthedocs.io/) or
   - Write a migration script to transfer data

## Database Schema

The PostgreSQL schema includes:

### Tables
- `coins` - Token/coin metadata and market data
- `gaming_coinflip` - Coinflip game records
- `gaming_mines` - Mines game records
- `gaming_pumpplay_rounds` - PumpPlay game rounds
- `gaming_pumpplay_bets` - PumpPlay bets
- `gaming_meme_royale` - Meme Royale battles
- `livestreams` - Livestream state per token

### Column Naming
PostgreSQL uses `snake_case` for column names (e.g., `token_address`, `created_at`), but the application automatically maps them to `camelCase` for JavaScript compatibility.

## Benefits

✅ **Persistent Storage** - Data survives serverless function invocations  
✅ **Scalable** - Handles high traffic and concurrent connections  
✅ **Reliable** - Managed by Vercel with automatic backups  
✅ **Fast** - Optimized for serverless environments  
✅ **No File System Issues** - No more `EROFS` or `SQLITE_CANTOPEN` errors  

## Troubleshooting

### Connection Errors
- Verify `POSTGRES_URL` is set in Vercel environment variables
- Check that the database is created and active
- Ensure your Vercel project has access to the database

### Schema Issues
- The schema initializes automatically on first use
- Check logs for any initialization errors
- Manually run `initializeSchema()` if needed

### Local Development
- Make sure PostgreSQL is running locally
- Verify `DATABASE_URL` or `POSTGRES_URL` is set correctly
- Check connection string format

## Support

For issues with Vercel Postgres:
- [Vercel Postgres Documentation](https://vercel.com/docs/storage/vercel-postgres)
- [Vercel Support](https://vercel.com/support)



