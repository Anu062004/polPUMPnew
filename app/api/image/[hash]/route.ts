import { NextRequest, NextResponse } from 'next/server'

// Proxy image download through Next API to avoid mixed content/CORS
export async function GET(
  request: NextRequest,
  { params }: { params: { hash: string } }
) {
  try {
    const hash = params.hash
    if (!hash) return new NextResponse('Missing image hash', { status: 400 })

    // Try backend first if available
    const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'
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
      console.log('Backend not available, trying direct storage access:', backendError?.message || backendError)
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

    // Fallback: Try to use Storage SDK if available
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
    } catch (storageError) {
      console.log('Storage SDK not available:', storageError)
    }

    // Final fallback: Return 404 with helpful message
    return new NextResponse('Image not available. Backend server may not be running.', { 
      status: 404,
      headers: {
        'Content-Type': 'text/plain'
      }
    })
  } catch (error) {
    console.error('Error proxying image:', error)
    return new NextResponse('Internal server error', { status: 500 })
  }
}
