'use client'
import { useEffect, useMemo, useState } from 'react'
import { CoinData } from '../../lib/0gStorageSDK'

interface CoinImageProps {
  coin?: CoinData & { imageHash?: string; imageRootHash?: string; imageUrl?: string }
  imageHash?: string
  imageRootHash?: string
  imageUrl?: string
  tokenName?: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export default function CoinImage({ 
  coin, 
  imageHash, 
  imageRootHash, 
  imageUrl, 
  tokenName,
  size = 'md', 
  className = '' 
}: CoinImageProps) {
  // Support both old API (coin object) and new API (individual props)
  const coinData = coin || {
    name: tokenName || 'Token',
    symbol: tokenName?.charAt(0) || '?',
    imageUrl: imageUrl,
    imageHash: imageHash,
    imageRootHash: imageRootHash || imageHash,
  } as any
  const [imageSrc, setImageSrc] = useState<string | null>(null)

  const sizeClasses = {
    sm: 'w-10 h-10',
    md: 'w-14 h-14',
    lg: 'w-16 h-16'
  }

  const backendBase = useMemo(() => {
    const envUrl = (typeof process !== 'undefined' && (process as any).env && (process as any).env.NEXT_PUBLIC_BACKEND_URL) as string | undefined
    if (envUrl && typeof envUrl === 'string') return envUrl
    return 'http://localhost:4000'
  }, [])

  useEffect(() => {
    if (!coinData) {
      setImageSrc(null)
      return
    }

    // Preferred: explicit URL
    if (coinData.imageUrl && (coinData.imageUrl.startsWith('http') || coinData.imageUrl.startsWith('/'))) {
      // If it's a backend URL, route through Next proxy
      if (coinData.imageUrl.startsWith('http://localhost:4000') || coinData.imageUrl.includes('/download/')) {
        // Extract hash from URL and use proxy
        const hashMatch = coinData.imageUrl.match(/\/download\/([^/?]+)/)
        if (hashMatch && hashMatch[1]) {
          setImageSrc(`/api/image/${hashMatch[1]}`)
        } else {
          setImageSrc(coinData.imageUrl)
        }
      } else if (coinData.imageUrl.startsWith('http')) {
        // External URL - use directly
        setImageSrc(coinData.imageUrl)
      } else {
        // Relative URL
        setImageSrc(coinData.imageUrl.startsWith('/') ? coinData.imageUrl : `/${coinData.imageUrl}`)
      }
      return
    }

    // Fallback: root hash present
    const root = coinData.imageRootHash || coinData.imageHash
    if (typeof root === 'string' && root.length > 0) {
      // Use proxy path to avoid mixed content/CORS
      setImageSrc(`/api/image/${encodeURIComponent(root)}`)
      return
    }

    // No image data - show placeholder
    setImageSrc(null)
  }, [coinData, imageHash, imageRootHash, imageUrl, tokenName, backendBase])

  if (imageSrc) {
    return (
      <div className={`${sizeClasses[size]} rounded-2xl border-2 border-purple-500/50 overflow-hidden shadow-lg ${className}`}>
        <img 
          src={imageSrc} 
          alt={coinData.name || tokenName || 'Token'} 
          className="w-full h-full object-cover" 
          onError={(e) => {
            // Silently fall back to placeholder without console spam
            setImageSrc(null);
          }}
        />
      </div>
    )
  }

  return (
    <div className={`${sizeClasses[size]} rounded-2xl border-2 border-purple-500/50 bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center ${className}`}>
      <span className={`font-bold text-purple-400 ${
        size === 'sm' ? 'text-lg' : size === 'md' ? 'text-xl' : 'text-2xl'
      }`}>
        {(coinData?.symbol || tokenName)?.charAt(0)?.toUpperCase() || '?'}
      </span>
    </div>
  )
}
