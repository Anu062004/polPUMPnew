# How to Clear All Testnet Tokens

Since your product is now deployed to mainnet, you need to remove all testnet tokens. Here are the steps:

## ✅ Already Completed

1. ✅ Cleared `data/profiles.json` - All tokens removed from user profiles
2. ✅ Cleared `data/coin-index-0g.json` - Token index cleared
3. ✅ Cleared SQLite database (`data/coins.db`) - All local tokens removed

## 🔧 Still Need to Do

### Option 1: Clear PostgreSQL via API (Recommended if you have ADMIN_SECRET)

If you have `ADMIN_SECRET` set in your environment variables:

```bash
# Replace YOUR_ADMIN_SECRET with your actual secret
curl -X DELETE "http://localhost:3000/api/coins?secret=YOUR_ADMIN_SECRET"
```

Or if deployed:
```bash
curl -X DELETE "https://your-domain.com/api/coins?secret=YOUR_ADMIN_SECRET"
```

### Option 2: Clear PostgreSQL Directly (Production/Vercel)

If you're using Vercel Postgres or a remote PostgreSQL database:

1. **Via Vercel Dashboard:**
   - Go to your Vercel project
   - Navigate to Storage → Postgres
   - Open the SQL Editor
   - Run: `DELETE FROM coins;`

2. **Via psql command line:**
   ```bash
   psql YOUR_CONNECTION_STRING -c "DELETE FROM coins;"
   ```

### Option 3: Clear Browser Cache

The tokens might be cached in your browser. Clear them:

1. **Open browser console (F12)**
2. **Run these commands:**
   ```javascript
   localStorage.clear()
   // Or specifically:
   localStorage.removeItem("pol_coins_data")
   localStorage.removeItem("0g_coins")
   localStorage.removeItem("pol_coins")
   ```
3. **Hard refresh the page:** `Ctrl+Shift+R` (Windows) or `Cmd+Shift+R` (Mac)

### Option 4: Use the Clear Scripts

Run these scripts in order:

```bash
# Clear SQLite (already done)
node scripts/clearTestnetTokens.js

# Clear PostgreSQL (if configured locally)
node scripts/clearPostgresCoins.js

# Or clear all coins
node scripts/clearAllCoins.js
```

## 🔍 Verify Tokens Are Cleared

1. Check the explore page - it should show "No tokens found"
2. Check your database:
   ```sql
   SELECT COUNT(*) FROM coins;
   ```
   Should return 0

## 📝 Notes

- If tokens still appear after clearing databases, it's likely browser cache
- Make sure to clear cache on all browsers/devices where you've accessed the app
- If using a CDN or caching layer, you may need to clear that as well

