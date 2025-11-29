/**
 * Pinata IPFS Service
 * Handles image uploads to IPFS via Pinata API
 */

const PINATA_API_KEY = '63f66ae5d1e943baab1c'
const PINATA_SECRET_KEY = '462dd414de38c220cbffc9b5ae29667fc086726e893282e363bad837803ed4ec'
const PINATA_GATEWAY = 'https://gateway.pinata.cloud/ipfs'
const PINATA_UPLOAD_URL = 'https://api.pinata.cloud/pinning/pinFileToIPFS'

export interface PinataUploadResponse {
  success: boolean
  ipfsHash?: string
  pinataUrl?: string
  error?: string
}

/**
 * Upload a file to Pinata IPFS
 */
export async function uploadToPinata(
  file: File | Buffer,
  fileName?: string
): Promise<PinataUploadResponse> {
  try {
    // Convert File to FormData if needed
    const formData = new FormData()
    
    if (file instanceof File) {
      formData.append('file', file)
    } else {
      // If it's a Buffer, create a Blob
      const blob = new Blob([file])
      formData.append('file', blob, fileName || 'image.png')
    }

    // Add metadata
    const metadata = JSON.stringify({
      name: fileName || 'token-image',
      keyvalues: {
        app: 'pol-pump',
        timestamp: Date.now().toString()
      }
    })
    formData.append('pinataMetadata', metadata)

    // Add options
    const options = JSON.stringify({
      cidVersion: 0,
      wrapWithDirectory: false
    })
    formData.append('pinataOptions', options)

    // Upload to Pinata
    const response = await fetch(PINATA_UPLOAD_URL, {
      method: 'POST',
      headers: {
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_KEY,
      },
      body: formData
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        errorData.error?.details || 
        errorData.error?.reason || 
        `Pinata upload failed: ${response.status} ${response.statusText}`
      )
    }

    const data = await response.json()
    const ipfsHash = data.IpfsHash

    if (!ipfsHash) {
      throw new Error('No IPFS hash returned from Pinata')
    }

    return {
      success: true,
      ipfsHash,
      pinataUrl: `${PINATA_GATEWAY}/${ipfsHash}`
    }
  } catch (error: any) {
    console.error('Pinata upload error:', error)
    return {
      success: false,
      error: error.message || 'Failed to upload to Pinata IPFS'
    }
  }
}

/**
 * Get IPFS gateway URL from hash
 */
export function getIpfsUrl(ipfsHash: string): string {
  if (!ipfsHash) return ''
  
  // If it's already a full URL, return as is
  if (ipfsHash.startsWith('http://') || ipfsHash.startsWith('https://')) {
    return ipfsHash
  }
  
  // Remove 'ipfs://' prefix if present
  const hash = ipfsHash.replace(/^ipfs:\/\//, '')
  
  // Return Pinata gateway URL
  return `${PINATA_GATEWAY}/${hash}`
}

/**
 * Check if a URL is an IPFS URL
 */
export function isIpfsUrl(url: string): boolean {
  return url.includes('ipfs') || url.startsWith('ipfs://') || url.includes('gateway.pinata.cloud')
}

/**
 * Upload buffer to Pinata (for server-side use)
 */
export async function uploadBufferToPinata(
  buffer: Buffer,
  fileName: string,
  contentType: string = 'image/png'
): Promise<PinataUploadResponse> {
  try {
    // Use native FormData (available in Node.js 18+ and Edge runtime)
    const formData = new FormData()
    
    // Convert Buffer to Blob for FormData (works in Edge runtime)
    // In Node.js, we can use the buffer directly as a File-like object
    const fileBlob = new Blob([buffer], { type: contentType })
    formData.append('file', fileBlob, fileName)

    // Add metadata
    const metadata = JSON.stringify({
      name: fileName,
      keyvalues: {
        app: 'pol-pump',
        timestamp: Date.now().toString()
      }
    })
    formData.append('pinataMetadata', metadata)

    // Add options
    const options = JSON.stringify({
      cidVersion: 0,
      wrapWithDirectory: false
    })
    formData.append('pinataOptions', options)

    // Upload to Pinata
    const response = await fetch(PINATA_UPLOAD_URL, {
      method: 'POST',
      headers: {
        'pinata_api_key': PINATA_API_KEY,
        'pinata_secret_api_key': PINATA_SECRET_KEY,
      },
      body: formData
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(
        errorData.error?.details || 
        errorData.error?.reason || 
        `Pinata upload failed: ${response.status} ${response.statusText}`
      )
    }

    const data = await response.json()
    const ipfsHash = data.IpfsHash

    if (!ipfsHash) {
      throw new Error('No IPFS hash returned from Pinata')
    }

    return {
      success: true,
      ipfsHash,
      pinataUrl: `${PINATA_GATEWAY}/${ipfsHash}`
    }
  } catch (error: any) {
    console.error('Pinata buffer upload error:', error)
    return {
      success: false,
      error: error.message || 'Failed to upload buffer to Pinata IPFS'
    }
  }
}

