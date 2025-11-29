import { NextRequest, NextResponse } from 'next/server'

// Create a new coin with metadata
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    
    const name = formData.get('name') as string
    const symbol = formData.get('symbol') as string
    const description = formData.get('description') as string
    const supply = formData.get('supply') as string
    const creator = formData.get('creator') as string
    const imageRootHash = formData.get('imageRootHash') as string

    if (!name || !symbol || !supply || !creator) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, symbol, supply, creator' },
        { status: 400 }
      )
    }

    // Try backend first if available
    const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000'
    
    try {
      const backendFormData = new FormData()
      backendFormData.append('name', name)
      backendFormData.append('symbol', symbol)
      backendFormData.append('description', description || '')
      backendFormData.append('supply', supply)
      backendFormData.append('creator', creator)
      if (imageRootHash) backendFormData.append('imageRootHash', imageRootHash)

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      
      const backendResponse = await fetch(`${backendBase}/createCoin`, {
        method: 'POST',
        body: backendFormData,
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)

      if (backendResponse.ok) {
        const backendResult = await backendResponse.json()
        if (backendResult.success) {
          return NextResponse.json(backendResult)
        }
      }
    } catch (backendError: any) {
      console.log('Backend createCoin not available, using local storage:', backendError?.message || backendError)
    }

    // Fallback: Create coin metadata and store in database
    const metadata = {
      name,
      symbol,
      description: description || `${name} (${symbol}) - A memecoin created on Polygon Amoy`,
      supply,
      creator,
      imageRootHash: imageRootHash || null,
      createdAt: new Date().toISOString(),
      metadataRootHash: null as string | null // Will be generated
    }

    // Generate metadata hash
    const crypto = await import('crypto')
    const metadataString = JSON.stringify(metadata)
    const metadataHash = crypto.createHash('sha256').update(metadataString).digest('hex')
    metadata.metadataRootHash = metadataHash

    // Store in database using the coins API
    try {
      const coinData = {
        name,
        symbol,
        supply,
        description: metadata.description,
        creator,
        imageHash: imageRootHash || null,
        tokenAddress: null,
        txHash: `pending-${Date.now()}`,
        telegramUrl: null,
        xUrl: null,
        discordUrl: null,
        websiteUrl: null
      }

      // Store in database using PostgreSQL
      const { sql } = await import('@vercel/postgres')
      const { initializeSchema } = await import('../../../lib/postgresManager')
      
      // Initialize schema if needed
      await initializeSchema()
      
      const coinId = `${symbol.toLowerCase()}-${Date.now()}`
      const createdAt = Date.now()
      
      // Insert coin into PostgreSQL
      await sql`
        INSERT INTO coins (
          id, name, symbol, supply, image_hash, token_address, tx_hash, 
          creator, created_at, description
        )
        VALUES (
          ${coinId}, ${name}, ${symbol}, ${supply}, ${imageRootHash || null}, 
          ${null}, ${coinData.txHash}, ${creator}, ${createdAt}, ${metadata.description}
        )
      `
      
      return NextResponse.json({
        success: true,
        coin: {
          id: coinId,
          name,
          symbol,
          supply,
          description: metadata.description,
          creator,
          imageRootHash: imageRootHash || null,
          metadataRootHash: metadataHash,
          txHash: coinData.txHash,
          tokenAddress: null,
          curveAddress: null,
          createdAt: new Date().toISOString()
        }
      })
    } catch (dbError: any) {
      console.error('Database storage failed:', dbError)
      
      // If database fails, return metadata anyway
      return NextResponse.json({
        success: true,
        coin: {
          id: `coin_${Date.now()}`,
          name,
          symbol,
          supply,
          description: metadata.description,
          creator,
          imageRootHash: imageRootHash || null,
          metadataRootHash: metadataHash,
          txHash: `pending-${Date.now()}`,
          tokenAddress: null,
          curveAddress: null,
          createdAt: new Date().toISOString()
        }
      })
    }

  } catch (error: any) {
    console.error('Create coin error:', error)
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'Failed to create coin' 
      },
      { status: 500 }
    )
  }
}

