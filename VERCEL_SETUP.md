# Vercel Environment Setup Guide

## Required Environment Variables

To deploy your POL Pump application successfully on Vercel, you need to configure the following environment variables:

### 1. Database Configuration (PostgreSQL)

**Variable:** `POSTGRES_PRISMA_URL`  
**Description:** Pooled connection string for Vercel Postgres (required for @vercel/postgres)  
**Value:** Your Neon pooled connection URL with `connect_timeout` parameter

Example format:
```
postgresql://username:password@host-pooler.region.provider.tech/database?connect_timeout=15&sslmode=require
```

**Variable:** `POSTGRES_URL` (Optional but recommended)  
**Description:** Direct connection string  
**Value:** Your Neon direct connection URL

---

### 2. Image Upload Configuration (Pinata IPFS)

**Variable:** `PINATA_JWT`  
**Description:** Pinata API JWT token for IPFS image uploads  
**Value:** Your Pinata JWT token (starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)

---

### 3. Blockchain Configuration

**Variable:** `RPC_URL`  
**Value:** Your Polygon Amoy RPC URL

**Variable:** `NEXT_PUBLIC_EVM_RPC`  
**Value:** Same as RPC_URL (public-facing)

**Variable:** `NEXT_PUBLIC_INDEXER_RPC`  
**Value:** Your indexer RPC URL

---

### 4. Livestream Configuration (AWS IVS, Browser-Native)

**Variable:** `AWS_ACCESS_KEY_ID`  
**Description:** IAM access key for AWS IVS API operations

**Variable:** `AWS_SECRET_ACCESS_KEY`  
**Description:** IAM secret key for AWS IVS API operations

**Variable:** `AWS_REGION`  
**Description:** AWS region where IVS channels are created (for example `us-east-1`)

**Variable:** `AWS_IVS_CHANNEL_TYPE` (Optional)  
**Description:** IVS channel type. Recommended default: `BASIC`  
**Allowed:** `BASIC`, `STANDARD`, `ADVANCED_SD`, `ADVANCED_HD`

**Variable:** `NEXT_PUBLIC_IVS_BROADCAST_SDK_URL` (Optional)  
**Description:** Override browser SDK script URL for IVS Web Broadcast

IAM permissions required for the configured AWS credentials:
- `ivs:CreateChannel`
- `ivs:CreateStreamKey`
- `ivs:GetStream`
- `ivs:GetStreamKey`

---

## How to Add Environment Variables in Vercel

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Navigate to **Settings** → **Environment Variables**
4. For each variable:
   - Click **Add New**
   - Enter the **Key** (variable name)
   - Enter the **Value**
   - Select environments: **Production**, **Preview**, and **Development**
   - Click **Save**

5. After adding all variables, redeploy your application:
   - Go to **Deployments** tab
   - Click the **...** menu on the latest deployment
   - Select **Redeploy**

---

## Verification

After deployment, check the build logs for:
- ✅ `Using Vercel Postgres sql template tag (POSTGRES_PRISMA_URL from env)`
- ✅ `PostgreSQL schema initialized successfully`
- ✅ No errors about missing `POSTGRES_PRISMA_URL`
- ✅ No errors about Pinata configuration

---

## Troubleshooting

### Issue: "POSTGRES_PRISMA_URL not found"
**Solution:** Make sure you added the variable with the exact name `POSTGRES_PRISMA_URL` (case-sensitive)

### Issue: "Pinata upload failed"
**Solution:** Verify `PINATA_JWT` is set correctly and the token hasn't expired

### Issue: "SQLite in /tmp is not allowed"
**Solution:** This means Postgres isn't configured. Add `POSTGRES_PRISMA_URL` to fix this.

### Issue: "AWS IVS is not configured"
**Solution:** Set `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and `AWS_REGION` in Vercel project env vars.
