import { NextRequest, NextResponse } from 'next/server'
import { pinataService } from '../../../../lib/pinataService'

// Proxy image download through Next API to avoid mixed content/CORS
// Supports IPFS hashes (Pinata) and local storage
export async function GET(
  request: NextRequest,
  { params }: { params: { hash: string } }
) {
  try {
    const hash = params.hash
    if (!hash) return new NextResponse('Missing image hash', { status: 400 })

    // Check if hash looks like an IPFS hash (starts with Qm, bafy, or is 46 chars base58)
    const isIPFSHash = /^Qm[1-9A-HJ-NP-Za-km-z]{44}$/.test(hash) || 
                       /^baf[a-z0-9]{56,}$/.test(hash) ||
                       hash.length === 46

    // Try IPFS (Pinata gateway) first if it looks like an IPFS hash
    if (isIPFSHash) {
      try {
        const ipfsUrl = pinataService.getGatewayUrl(hash)
        console.log('🌐 Fetching from IPFS:', ipfsUrl)
        
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
        
        const res = await fetch(ipfsUrl, {
          cache: 'no-store',
          signal: controller.signal,
          headers: {
            'Accept': 'image/*'
          }
        })
        
        clearTimeout(timeoutId)
        
        if (res.ok) {
          const buffer = Buffer.from(await res.arrayBuffer())
          const contentType = res.headers.get('content-type') || 'image/png'
          
          return new NextResponse(buffer, {
            headers: {
              'Content-Type': contentType,
              'Cache-Control': 'public, max-age=31536000, immutable'
            }
          })
        }
      } catch (ipfsError: any) {
        console.log('IPFS fetch failed, trying other sources:', ipfsError?.message || ipfsError)
      }
    }

    // Try backend only if not on Vercel (serverless) and backend URL is explicitly set
    // On Vercel, localhost:4000 doesn't exist, so skip this step
    const isServerless = process.env.VERCEL === '1' || 
                        process.env.AWS_LAMBDA_FUNCTION_NAME || 
                        process.env.NEXT_RUNTIME === 'nodejs'
    
    if (!isServerless) {
      const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL
      // Only try backend if URL is explicitly set (not localhost default)
      if (backendBase && !backendBase.includes('localhost') && !backendBase.includes('127.0.0.1')) {
        const url = `${backendBase}/download/${encodeURIComponent(hash)}`

        let timeoutId: NodeJS.Timeout | null = null
        try {
          // Create timeout controller for compatibility
          const controller = new AbortController()
          timeoutId = setTimeout(() => controller.abort(), 5000)
          
          const res = await fetch(url, { 
            cache: 'no-store',
            signal: controller.signal
          })
          
          if (timeoutId) clearTimeout(timeoutId)
          
          if (res.ok) {
            // Stream the body back with content-type/length if provided
            const headers: Record<string, string> = {
              'Cache-Control': 'public, max-age=31536000, immutable'
            }
            const ct = res.headers.get('content-type')
            const cl = res.headers.get('content-length')
            if (ct) headers['Content-Type'] = ct
            if (cl) headers['Content-Length'] = cl

            const buffer = Buffer.from(await res.arrayBuffer())
            return new NextResponse(buffer, { headers })
          }
        } catch (backendError: any) {
          // Clear timeout if it was set
          if (timeoutId) clearTimeout(timeoutId)
          console.log('Backend not available, trying other sources:', backendError?.message || backendError)
        }
      }
    } else {
      // Silently skip backend fetch on serverless (expected behavior)
      // No need to log this as it's normal for Vercel deployments
    }

    // Fallback: Try to check local uploads directory
    try {
      const { readFile } = await import('fs/promises')
      const { join } = await import('path')
      const { existsSync } = await import('fs')
      
      const uploadsDir = join(process.cwd(), 'public', 'uploads')
      // Try common image extensions
      const extensions = ['png', 'jpg', 'jpeg', 'gif', 'webp']
      
      for (const ext of extensions) {
        const filePath = join(uploadsDir, `${hash}.${ext}`)
        if (existsSync(filePath)) {
          const imageBuffer = await readFile(filePath)
          return new NextResponse(imageBuffer, {
            headers: {
              'Content-Type': `image/${ext === 'jpg' ? 'jpeg' : ext}`,
              'Cache-Control': 'public, max-age=31536000, immutable'
            }
          })
        }
      }
    } catch (localError) {
      console.log('Local uploads check failed:', localError)
    }

    // Fallback: Try to use Storage SDK if available (only if not serverless)
    // Storage SDK might try to connect to localhost, so skip on Vercel
    if (!isServerless) {
      try {
        const { ogStorageSDK } = await import('@/lib/0gStorageSDK')
        const imageData = await ogStorageSDK.downloadData(hash)
        
        if (imageData && typeof imageData === 'object') {
          // If it's a JSON object, try to extract image data
          if (imageData.data || imageData.image) {
            const imageBuffer = Buffer.from(imageData.data || imageData.image, 'base64')
            return new NextResponse(imageBuffer, {
              headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'public, max-age=31536000, immutable'
              }
            })
          }
        }
      } catch (storageError: any) {
        // Don't log if it's a connection refused error (expected on Vercel)
        if (!storageError?.message?.includes('ECONNREFUSED') && 
            !storageError?.message?.includes('localhost')) {
          console.log('Storage SDK not available:', storageError?.message || storageError)
        }
      }
    }

    // Final fallback: Return a transparent 1x1 pixel PNG instead of 404
    // This prevents 404 errors from cluttering logs for deleted/missing images
    // Especially useful for testnet tokens that were removed
    const transparentPixel = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    )
    
    return new NextResponse(transparentPixel, {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Cache-Control': 'public, max-age=3600' // Cache for 1 hour to reduce requests
      }
    })
  } catch (error) {
    console.error('Error proxying image:', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}
