# Guide: Delete All Coins from Prisma Database

Your Prisma project ID: `cmikaq5sv0gp829gz0kx849jw`

## Method 1: Using the Script (Recommended)

### Step 1: Install Required Packages
```bash
npm install pg @vercel/postgres dotenv
```

### Step 2: Set Up Environment Variables
Make sure your `.env` file has one of these connection strings:

```env
# For Vercel Postgres (recommended)
POSTGRES_PRISMA_URL=postgresql://user:password@host:port/database?sslmode=require

# Or alternative
POSTGRES_URL=postgresql://user:password@host:port/database?sslmode=require

# Or standard PostgreSQL
DATABASE_URL=postgresql://user:password@host:port/database?sslmode=require
```

### Step 3: Run the Script
```bash
node scripts/deleteCoinsFromPrisma.js
```

This will:
- Connect to your Prisma/PostgreSQL database
- Count existing coins
- Delete all coins
- Verify deletion

## Method 2: Using Prisma Studio (GUI)

1. **Install Prisma CLI** (if not already installed):
   ```bash
   npm install -g prisma
   ```

2. **Open Prisma Studio**:
   ```bash
   npx prisma studio
   ```

3. **Navigate to the `coins` table**

4. **Select all coins** (Ctrl+A or Cmd+A)

5. **Click "Delete"** button

## Method 3: Using SQL Directly

### Option A: Via Vercel Dashboard

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Storage** → **Postgres**
4. Click on **SQL Editor**
5. Run this query:
   ```sql
   DELETE FROM coins;
   ```
6. Click **Run**

### Option B: Via psql Command Line

```bash
# Connect to your database
psql "your-connection-string-here"

# Or if using connection string from .env
psql $POSTGRES_PRISMA_URL

# Then run:
DELETE FROM coins;

# Verify:
SELECT COUNT(*) FROM coins;
# Should return 0

# Exit:
\q
```

### Option C: Via API Endpoint

If you have `ADMIN_SECRET` set in your environment:

```bash
# Local
curl -X DELETE "http://localhost:3000/api/coins?secret=YOUR_ADMIN_SECRET"

# Production
curl -X DELETE "https://your-domain.com/api/coins?secret=YOUR_ADMIN_SECRET"
```

## Method 4: Using Prisma Client (If you have Prisma setup)

If you have a Prisma schema file, you can create a script:

```javascript
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

async function deleteAllCoins() {
  const result = await prisma.coin.deleteMany({})
  console.log(`Deleted ${result.count} coins`)
}

deleteAllCoins()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
```

## Verification

After deleting, verify the deletion:

```sql
SELECT COUNT(*) FROM coins;
-- Should return 0
```

## Clear Browser Cache

After deleting from the database, clear your browser cache:

1. **Open browser console** (F12)
2. **Run**:
   ```javascript
   localStorage.clear()
   ```
3. **Hard refresh**: `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

## Troubleshooting

### Error: "Cannot find module '@vercel/postgres'"
```bash
npm install @vercel/postgres
```

### Error: "Cannot find module 'pg'"
```bash
npm install pg
```

### Error: "Connection refused" or "ENOTFOUND"
- Check your connection string is correct
- Verify your database is accessible
- Check firewall/network settings

### Error: "relation 'coins' does not exist"
- The table might have a different name
- Check your database schema
- The table might be in a different schema (e.g., `public.coins`)

## Need Help?

If you're still seeing tokens after deletion:
1. Check that you deleted from the correct database (production vs development)
2. Clear browser cache and localStorage
3. Check if there's a CDN or caching layer that needs to be cleared
4. Verify the API is reading from the correct database

