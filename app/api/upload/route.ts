import { NextRequest, NextResponse } from 'next/server'
import { pinataService } from '../../../lib/pinataService'

// Check if we're in a serverless environment (Vercel, etc.)
const isServerless = process.env.VERCEL === '1' || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.NEXT_RUNTIME === 'nodejs'

// Handle image uploads to Pinata IPFS
export async function POST(request: NextRequest) {
  try {
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

    // In serverless environments, Pinata is required (file system is read-only)
    if (isServerless && !pinataService.isConfigured()) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Pinata IPFS is required for file uploads in production. Please configure PINATA_JWT environment variable.' 
        },
        { status: 500 }
      )
    }

    // Try Pinata IPFS upload first (required in production, preferred in development)
    if (pinataService.isConfigured()) {
      try {
        console.log('📤 Uploading to Pinata IPFS...')
        const pinataResult = await pinataService.uploadFile(file, file.name)
        
        if (pinataResult.success && pinataResult.ipfsHash) {
          console.log('✅ Uploaded to Pinata IPFS:', pinataResult.ipfsHash)
          return NextResponse.json({
            success: true,
            rootHash: pinataResult.ipfsHash,
            ipfsHash: pinataResult.ipfsHash,
            pinataUrl: pinataResult.pinataUrl,
            gatewayUrl: pinataService.getGatewayUrl(pinataResult.ipfsHash),
            reused: false,
            source: 'pinata'
          })
        } else {
          // In serverless, fail if Pinata fails
          if (isServerless) {
            return NextResponse.json(
              { 
                success: false, 
                error: `Pinata upload failed: ${pinataResult.error || 'Unknown error'}. Pinata is required in production environments.` 
              },
              { status: 500 }
            )
          }
          console.warn('⚠️ Pinata upload failed, trying backend fallback:', pinataResult.error)
        }
      } catch (pinataError: any) {
        // In serverless, fail if Pinata fails
        if (isServerless) {
          return NextResponse.json(
            { 
              success: false, 
              error: `Pinata upload error: ${pinataError.message || 'Unknown error'}. Pinata is required in production environments.` 
            },
            { status: 500 }
          )
        }
        console.warn('⚠️ Pinata upload error, trying backend fallback:', pinataError.message)
      }
    } else if (isServerless) {
      // This should not happen due to check above, but just in case
      return NextResponse.json(
        { 
          success: false, 
          error: 'Pinata IPFS is required for file uploads in production. Please configure PINATA_JWT environment variable.' 
        },
        { status: 500 }
      )
    }

    // Try backend if available (only in non-serverless environments)
    if (!isServerless) {
      const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'
      
      try {
        const backendFormData = new FormData()
        backendFormData.append('file', file)
        
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
        
        const backendResponse = await fetch(`${backendBase}/upload`, {
          method: 'POST',
          body: backendFormData,
          signal: controller.signal
        })
        
        clearTimeout(timeoutId)

        if (backendResponse.ok) {
          const backendResult = await backendResponse.json()
          if (backendResult.success && backendResult.rootHash) {
            return NextResponse.json({
              success: true,
              rootHash: backendResult.rootHash,
              reused: backendResult.reused || false,
              source: 'backend'
            })
          }
        }
      } catch (backendError: any) {
        console.log('Backend upload not available:', backendError?.message || backendError)
      }
    }

    // If we reach here in serverless, it means Pinata failed and we can't use local storage
    if (isServerless) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'File upload failed. Pinata IPFS is required in production environments.' 
        },
        { status: 500 }
      )
    }

    // Local storage fallback (only in development/non-serverless environments)
    // Note: This should rarely be used as Pinata is preferred
    return NextResponse.json(
      { 
        success: false, 
        error: 'File upload failed. Please configure Pinata IPFS (PINATA_JWT) for reliable file storage.' 
      },
      { status: 500 }
    )

  } catch (error: any) {
    console.error('Upload error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Upload failed' 
      },
      { status: 500 }
    )
  }
}

