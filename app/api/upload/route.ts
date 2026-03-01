import { NextRequest, NextResponse } from 'next/server'
import { pinataService } from '../../../lib/pinataService'

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX = 20
const rateBuckets = new Map<string, { count: number; reset: number }>()

function enforceRateLimit(request: NextRequest): NextResponse | null {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.ip ||
    'unknown'
  const key = `upload:${ip}`
  const now = Date.now()
  const bucket = rateBuckets.get(key) || { count: 0, reset: now + RATE_LIMIT_WINDOW_MS }
  if (bucket.reset < now) {
    bucket.count = 0
    bucket.reset = now + RATE_LIMIT_WINDOW_MS
  }
  bucket.count += 1
  rateBuckets.set(key, bucket)
  if (bucket.count > RATE_LIMIT_MAX) {
    return NextResponse.json(
      { success: false, error: 'Rate limit exceeded' },
      { status: 429 }
    )
  }
  return null
}

function isServerlessRuntime() {
  return process.env.VERCEL === '1' || !!process.env.AWS_LAMBDA_FUNCTION_NAME
}

function shouldUseRemoteBackend(backendBase: string) {
  const lowered = backendBase.toLowerCase()
  return (
    !!backendBase &&
    !lowered.includes('localhost') &&
    !lowered.includes('127.0.0.1')
  )
}

// Handle image uploads to Pinata IPFS
export const POST = async (request: NextRequest) => {
  try {
    const rateLimited = enforceRateLimit(request)
    if (rateLimited) {
      return rateLimited
    }

    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json(
        { success: false, error: 'No file provided' },
        { status: 400 }
      )
    }

    // Validate file type
    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Invalid file type. Only PNG, JPG, GIF, and WebP are allowed.' },
        { status: 400 }
      )
    }

    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024 // 10MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { success: false, error: 'File size exceeds 10MB limit' },
        { status: 400 }
      )
    }

    const isServerless = isServerlessRuntime()
    const backendBase =
      process.env.NEXT_PUBLIC_BACKEND_URL ||
      process.env.BACKEND_URL ||
      'http://localhost:4000'
    const canUseBackend = shouldUseRemoteBackend(backendBase)
    const uploadErrors: string[] = []

    // Try Pinata IPFS upload first (preferred in all environments).
    if (pinataService.isConfigured()) {
      try {
        console.log('Uploading to Pinata IPFS...')
        const pinataResult = await pinataService.uploadFile(file, file.name)

        if (pinataResult.success && pinataResult.ipfsHash) {
          console.log('Uploaded to Pinata IPFS:', pinataResult.ipfsHash)
          return NextResponse.json({
            success: true,
            rootHash: pinataResult.ipfsHash,
            ipfsHash: pinataResult.ipfsHash,
            pinataUrl: pinataResult.pinataUrl,
            gatewayUrl: pinataService.getGatewayUrl(pinataResult.ipfsHash),
            reused: false,
            source: 'pinata',
          })
        }

        uploadErrors.push(`Pinata upload failed: ${pinataResult.error || 'Unknown error'}`)
        console.warn('Pinata upload failed, trying backend fallback:', pinataResult.error)
      } catch (pinataError: any) {
        uploadErrors.push(`Pinata upload error: ${pinataError?.message || 'Unknown error'}`)
        console.warn('Pinata upload error, trying backend fallback:', pinataError?.message || pinataError)
      }
    } else {
      uploadErrors.push(
        'Pinata credentials not configured. Set PINATA_JWT or PINATA_API_KEY + PINATA_API_SECRET in Vercel env.'
      )
    }

    // Try backend when a remote backend URL is configured.
    if (canUseBackend) {
      try {
        const backendFormData = new FormData()
        backendFormData.append('file', file)

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout

        const backendResponse = await fetch(`${backendBase}/upload`, {
          method: 'POST',
          body: backendFormData,
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (backendResponse.ok) {
          const backendResult = await backendResponse.json()
          if (backendResult.success && backendResult.rootHash) {
            return NextResponse.json({
              success: true,
              rootHash: backendResult.rootHash,
              reused: backendResult.reused || false,
              source: 'backend',
            })
          }
        }

        uploadErrors.push(`Backend upload failed with status ${backendResponse.status}`)
      } catch (backendError: any) {
        uploadErrors.push(`Backend upload error: ${backendError?.message || backendError}`)
        console.log('Backend upload not available:', backendError?.message || backendError)
      }
    } else {
      uploadErrors.push(
        'Backend upload skipped because NEXT_PUBLIC_BACKEND_URL/BACKEND_URL is not set to a remote server.'
      )
    }

    // If we reach here in serverless, no persistent upload provider succeeded.
    if (isServerless) {
      return NextResponse.json(
        {
          success: false,
          error: uploadErrors.join(' | '),
        },
        { status: 500 }
      )
    }

    // Local storage fallback (only in development/non-serverless environments)
    // Note: This should rarely be used as Pinata is preferred
    return NextResponse.json(
      {
        success: false,
        error: uploadErrors.join(' | ') || 'File upload failed. Please configure Pinata IPFS (PINATA_JWT).',
      },
      { status: 500 }
    )
  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Upload failed',
      },
      { status: 500 }
    )
  }
}
