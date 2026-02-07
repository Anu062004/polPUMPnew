# Vercel Deployment Guide for POLpump

Complete guide to deploy POLpump on Vercel with all required configurations.

## 📋 Prerequisites

1. **GitHub Account** - Your code should be in a GitHub repository
2. **Vercel Account** - Sign up at [vercel.com](https://vercel.com)
3. **Polygon RPC Endpoint** - Get from Infura, Alchemy, or QuickNode
4. **Vercel Postgres Database** - For production database (optional but recommended)
5. **WalletConnect Project ID** - Get from [WalletConnect Cloud](https://cloud.walletconnect.com)

---

## 🚀 Step-by-Step Deployment

### Step 1: Connect Repository to Vercel

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click **"Add New..."** → **"Project"**
3. Import your GitHub repository: `Anu062004/polPUMPnew`
4. Vercel will auto-detect it's a Next.js project

### Step 2: Configure Project Settings

**Root Directory:** `0gPump` (if your project is in a subdirectory)

**Build Command:** `npm run build` (auto-detected)

**Output Directory:** `.next` (auto-detected)

**Install Command:** `npm install --legacy-peer-deps` (already configured in vercel.json)

**Node.js Version:** `20.x` (as specified in package.json)

### Step 3: Set Up Vercel Postgres Database (Recommended)

1. In your Vercel project, go to **Storage** tab
2. Click **"Create Database"** → **"Postgres"**
3. Choose a region close to your users
4. Copy the connection strings (you'll need `POSTGRES_PRISMA_URL`)

### Step 4: Configure Environment Variables

Go to **Settings** → **Environment Variables** and add the following:

#### 🔴 Required Environment Variables

```env
# Network Configuration
NEXT_PUBLIC_NETWORK=polygon
NEXT_PUBLIC_CHAIN_ID=137

# Polygon Mainnet RPC (REQUIRED)
# Get from: https://infura.io, https://alchemy.com, or https://quicknode.com
NEXT_PUBLIC_EVM_RPC=https://polygon-mainnet.infura.io/v3/YOUR_INFURA_KEY
# OR
NEXT_PUBLIC_EVM_RPC=https://polygon-mainnet.g.alchemy.com/v2/YOUR_ALCHEMY_KEY

# Database (REQUIRED for production)
# Get from Vercel Storage → Postgres
POSTGRES_PRISMA_URL=postgres://default:password@host:5432/verceldb?sslmode=require
# Optional: Also add these if available
POSTGRES_URL=postgres://default:password@host:5432/verceldb
POSTGRES_URL_NON_POOLING=postgres://default:password@host:5432/verceldb
```

#### 🟡 Contract Addresses (Already Deployed)

```env
# Factory Contracts
NEXT_PUBLIC_FACTORY_ADDRESS=0xFb1A309B37f3AEe5B4A8c0fB4135b3732780Ab69
NEXT_PUBLIC_ENHANCED_FACTORY_ADDRESS=0x2Bb6c5118CB65C5E8cA774fCE59cd08024E9ad76
NEXT_PUBLIC_PUMPFUN_FACTORY_ADDRESS=0xa214AE0b2C9A3062208c82faCA879e766558dc15
NEXT_PUBLIC_AUTO_TRADING_FACTORY_ADDRESS=0x46B7ae01b3e53ad77Df82867d24a87610B0780b4

# DEX Contracts
NEXT_PUBLIC_WETH_ADDRESS=0xFd84545E34762943E29Ab17f98815280c4a90Cb6
NEXT_PUBLIC_UNISWAP_FACTORY_ADDRESS=0x297dcec928893bf73C8b9c22dB3Efa2143E0dE53
NEXT_PUBLIC_ROUTER_ADDRESS=0xE23469d5aFb586B8c45D669958Ced489ee9Afb09

# Gaming Contracts
NEXT_PUBLIC_GAME_BANK_ADDRESS=0xDeAdB867DA927d7b8e7CF2FF6105571DD4B5be1a
NEXT_PUBLIC_GAME_REGISTRY_ADDRESS=0xDbBA4f5A4b1D9aE51E533E3C212898169df69EAc

# Marketplace & Treasury
NEXT_PUBLIC_TOKEN_MARKETPLACE_ADDRESS=0xed401473e938714927392182ea5c8F65593946d8
NEXT_PUBLIC_TREASURY_ADDRESS=0x1aB7d5eCBe2c551eBfFdfA06661B77cc60dbd425
```

#### 🟢 Optional Environment Variables

```env
# WalletConnect (Recommended)
# Get from: https://cloud.walletconnect.com
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id

# Backend URL (if using separate backend)
NEXT_PUBLIC_BACKEND_URL=https://your-backend.vercel.app

# API Security (Recommended for production)
API_AUTH_TOKEN=your-secure-api-token-here
ADMIN_SECRET=your-admin-secret-here

# 0G Storage (if using)
NEXT_PUBLIC_0G_STORAGE_ENABLED=true
NEXT_PUBLIC_0G_RPC_URL=https://evmrpc.0g.ai
NEXT_PUBLIC_0G_INDEXER_RPC=https://indexer.0g.ai

# Pinata IPFS (if using)
PINATA_API_KEY=your_pinata_api_key
PINATA_SECRET_KEY=your_pinata_secret_key
```

### Step 5: Deploy

1. Click **"Deploy"** button
2. Vercel will:
   - Install dependencies
   - Build your Next.js app
   - Deploy to production
3. Wait for deployment to complete (usually 2-5 minutes)

### Step 6: Verify Deployment

1. Once deployed, you'll get a URL like: `https://pol-pump.vercel.app`
2. Visit the URL and test:
   - ✅ Wallet connection works
   - ✅ Token creation works
   - ✅ Trading works
   - ✅ Database operations work

---

## 🔧 Advanced Configuration

### Custom Domain Setup

1. Go to **Settings** → **Domains**
2. Add your custom domain (e.g., `polpump.com`)
3. Follow DNS configuration instructions
4. Vercel will automatically provision SSL certificate

### Environment-Specific Variables

You can set different values for:
- **Production** - Live site
- **Preview** - Pull request previews
- **Development** - Local development

Set variables for each environment in **Settings** → **Environment Variables**

### Build Optimization

The `vercel.json` file already includes:
```json
{
  "installCommand": "npm install --legacy-peer-deps"
}
```

This ensures dependencies install correctly.

### Database Migration

After first deployment, initialize the database schema:

1. Go to **Storage** → **Postgres** → **SQL Editor**
2. The schema will be auto-initialized on first API call
3. Or manually run the schema from `lib/postgresManager.ts`

---

## 📊 Monitoring & Logs

### View Logs

1. Go to **Deployments** tab
2. Click on any deployment
3. Click **"Functions"** tab to see serverless function logs
4. Click **"Runtime Logs"** for real-time logs

### Performance Monitoring

- **Analytics** tab shows:
  - Page views
  - Performance metrics
  - Web Vitals
  - Real User Monitoring (RUM)

---

## 🐛 Troubleshooting

### Build Fails

**Error: "Module not found"**
- Check all dependencies are in `package.json`
- Ensure `vercel.json` has correct install command

**Error: "Environment variable not found"**
- Verify all required env vars are set in Vercel dashboard
- Check variable names match exactly (case-sensitive)

### Database Connection Issues

**Error: "POSTGRES_PRISMA_URL not found"**
- Ensure Vercel Postgres is created
- Copy the connection string from Storage tab
- Use `POSTGRES_PRISMA_URL` (pooled connection)

### RPC Connection Issues

**Error: "RPC URL not configured"**
- Verify `NEXT_PUBLIC_EVM_RPC` is set
- Check RPC endpoint is accessible
- Try a different RPC provider (Infura, Alchemy, QuickNode)

### Function Timeout

**Error: "Function execution exceeded timeout"**
- Vercel free tier: 10 seconds
- Pro tier: 60 seconds
- Optimize API routes or upgrade plan

---

## 🔐 Security Checklist

- [ ] All sensitive keys are in Environment Variables (not in code)
- [ ] `API_AUTH_TOKEN` is set for write operations
- [ ] `ADMIN_SECRET` is set for admin operations
- [ ] Database connection strings are secure
- [ ] RPC endpoints use API keys (not public endpoints)
- [ ] No private keys in `NEXT_PUBLIC_` variables

---

## 📝 Post-Deployment Checklist

- [ ] Test wallet connection
- [ ] Test token creation
- [ ] Test trading functionality
- [ ] Verify database is working
- [ ] Check API routes are accessible
- [ ] Test image uploads
- [ ] Verify contract interactions
- [ ] Check error logs for issues
- [ ] Set up custom domain (optional)
- [ ] Configure analytics (optional)

---

## 🔄 Continuous Deployment

Vercel automatically deploys:
- **Main branch** → Production
- **Other branches** → Preview deployments
- **Pull requests** → Preview deployments

To disable auto-deploy:
1. Go to **Settings** → **Git**
2. Configure deployment settings

---

## 📚 Additional Resources

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Vercel Postgres](https://vercel.com/docs/storage/vercel-postgres)
- [Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)

---

## 🆘 Support

If you encounter issues:

1. Check Vercel deployment logs
2. Check browser console for errors
3. Verify all environment variables are set
4. Check database connection
5. Verify RPC endpoint is working

---

**Deployment Status:** ✅ Ready for Production  
**Last Updated:** 2026-02-07  
**Network:** Polygon Mainnet (Chain ID: 137)

