# Pinata IPFS Integration Setup

This project uses Pinata for IPFS file uploads. All images uploaded through the token creation interface will be stored on IPFS via Pinata.

## Environment Variables

Add the following environment variables to your `.env.local` file:

```env
# Pinata IPFS Configuration
PINATA_JWT=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySW5mb3JtYXRpb24iOnsiaWQiOiIxYjVkYjM1Zi00ZTVlLTQ2MDktODZkNi1hMGE0MjU2YTExOTQiLCJlbWFpbCI6ImFudWJoYXZyYWpwdXQ1NzJAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsInBpbl9wb2xpY3kiOnsicmVnaW9ucyI6W3siZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiRlJBMSJ9LHsiZGVzaXJlZFJlcGxpY2F0aW9uQ291bnQiOjEsImlkIjoiTllDMSJ9XSwidmVyc2lvbiI6MX0sIm1mYV9lbmFibGVkIjpmYWxzZSwic3RhdHVzIjoiQUNUSVZFIn0sImF1dGhlbnRpY2F0aW9uVHlwZSI6InNjb3BlZEtleSIsInNjb3BlZEtleUtleSI6IjQ3OGY4ZjY1ZDI5YmQ5ZWQ4YzVhIiwic2NvcGVkS2V5U2VjcmV0IjoiNTc3MDY0OTNlOTgyNWJhYzJlZDUzYzNmNTJmY2NiZDM5OTY5Y2E2ZjY4NmNhMzg0MzJiYzg2MTYzMTY4NjM1NyIsImV4cCI6MTc5NTk1NDczMn0.jJ4xw9-DhENZakhn6IxqIqCUAViSUmb8M7rAA_rajT8

# Alternative: Use API Key and Secret (if JWT expires)
# PINATA_API_KEY=your_api_key_here
# PINATA_API_SECRET=your_api_secret_here
```

## How It Works

1. **Upload Flow**: When you upload an image through the token creation modal:
   - The file is first uploaded to Pinata IPFS
   - Pinata returns an IPFS hash (CID)
   - This hash is stored in the database and used to reference the image

2. **Image Retrieval**: Images are served through:
   - Primary: Pinata IPFS Gateway (`https://gateway.pinata.cloud/ipfs/{hash}`)
   - Fallback: Backend storage or local storage

3. **Benefits**:
   - Decentralized storage on IPFS
   - Permanent, immutable file storage
   - Fast global CDN access via Pinata gateway
   - No single point of failure

## API Routes

- `POST /api/upload` - Uploads files to Pinata IPFS (with fallbacks)
- `GET /api/image/[hash]` - Retrieves images from IPFS or other sources

## Production Deployment

**⚠️ IMPORTANT**: In serverless environments (Vercel, AWS Lambda, etc.), Pinata is **REQUIRED** because the file system is read-only. 

Make sure to add `PINATA_JWT` to your production environment variables:
- **Vercel**: Go to Project Settings → Environment Variables → Add `PINATA_JWT`
- **Other platforms**: Add `PINATA_JWT` to your deployment environment variables

## Troubleshooting

If uploads fail:
1. Check that `PINATA_JWT` is set correctly in your environment variables
2. Verify the JWT hasn't expired (check Pinata dashboard)
3. Check browser console for error messages
4. **In production**: Pinata is required - the system will NOT fall back to local storage
5. **In development**: If Pinata fails, the system will try backend storage (if available)

