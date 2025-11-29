import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { pinataService } from '../../../lib/pinataService'

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

    // Try Pinata IPFS upload first
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
          console.warn('⚠️ Pinata upload failed, falling back to local storage:', pinataResult.error)
        }
      } catch (pinataError: any) {
        console.warn('⚠️ Pinata upload error, falling back to local storage:', pinataError.message)
      }
    } else {
      console.log('⚠️ Pinata not configured, using local storage fallback')
    }

    // Try backend first if available (fallback)
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
      console.log('Backend upload not available, using local storage:', backendError?.message || backendError)
    }

    // Final fallback: Store locally and generate a hash
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    // Generate a simple hash from file content
    const crypto = await import('crypto')
    const hash = crypto.createHash('sha256').update(buffer).digest('hex')
    
    // Store in public/uploads directory
    const uploadsDir = join(process.cwd(), 'public', 'uploads')
    if (!existsSync(uploadsDir)) {
      await mkdir(uploadsDir, { recursive: true })
    }
    
    const fileExt = file.name.split('.').pop() || 'png'
    const fileName = `${hash}.${fileExt}`
    const filePath = join(uploadsDir, fileName)
    
    // Only write if file doesn't exist
    let reused = false
    if (!existsSync(filePath)) {
      await writeFile(filePath, buffer)
    } else {
      reused = true
      console.log('File already exists, reusing:', fileName)
    }

    // Return hash that can be used to access the image
    return NextResponse.json({
      success: true,
      rootHash: hash,
      reused: reused,
      url: `/uploads/${fileName}`,
      source: 'local'
    })

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

