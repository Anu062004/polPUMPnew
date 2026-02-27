/**
 * Pinata IPFS Service
 * Handles file uploads to IPFS via Pinata
 */

export interface PinataUploadResult {
  success: boolean
  ipfsHash?: string
  pinataUrl?: string
  error?: string
}

function cleanEnv(value?: string): string {
  if (!value) return ''
  const trimmed = value.trim()
  return trimmed.replace(/^['"]|['"]$/g, '').trim()
}

export class PinataService {
  private apiKey: string
  private apiSecret: string
  private jwt: string
  private baseUrl = 'https://api.pinata.cloud'

  constructor() {
    // Support common env variants to reduce deployment misconfiguration issues.
    this.apiKey = cleanEnv(
      process.env.PINATA_API_KEY ||
        process.env.NEXT_PUBLIC_PINATA_API_KEY ||
        process.env.PINATA_KEY
    )
    this.apiSecret = cleanEnv(
      process.env.PINATA_API_SECRET ||
        process.env.PINATA_SECRET_API_KEY ||
        process.env.NEXT_PUBLIC_PINATA_API_SECRET ||
        process.env.NEXT_PUBLIC_PINATA_SECRET_API_KEY
    )
    this.jwt = cleanEnv(
      process.env.PINATA_JWT ||
        process.env.PINATA_JWT_TOKEN ||
        process.env.NEXT_PUBLIC_PINATA_JWT ||
        process.env.NEXT_PUBLIC_PINATA_JWT_TOKEN
    )
  }

  /**
   * Upload a file to Pinata IPFS
   */
  async uploadFile(file: File | Blob, fileName?: string): Promise<PinataUploadResult> {
    try {
      if (!this.jwt && (!this.apiKey || !this.apiSecret)) {
        throw new Error(
          'Pinata credentials not configured. Set PINATA_JWT (or PINATA_API_KEY + PINATA_API_SECRET).'
        )
      }

      const formData = new FormData()
      formData.append('file', file, fileName || 'file')

      // Add metadata
      const metadata = JSON.stringify({
        name: fileName || 'uploaded-file',
        keyvalues: {
          app: 'pol-pump',
          timestamp: Date.now().toString()
        }
      })
      formData.append('pinataMetadata', metadata)

      // Add pinata options
      const pinataOptions = JSON.stringify({
        cidVersion: 1,
        wrapWithDirectory: false
      })
      formData.append('pinataOptions', pinataOptions)

      // Use JWT if available, otherwise use API key/secret
      const headers: HeadersInit = {}
      if (this.jwt) {
        headers['Authorization'] = `Bearer ${this.jwt}`
      } else {
        headers['pinata_api_key'] = this.apiKey
        headers['pinata_secret_api_key'] = this.apiSecret
      }

      const response = await fetch(`${this.baseUrl}/pinning/pinFileToIPFS`, {
        method: 'POST',
        headers,
        body: formData
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        const errorMessage =
          errorData?.error?.details ||
          errorData?.error ||
          errorData?.message ||
          `Pinata upload failed: ${response.status} ${response.statusText}`
        throw new Error(errorMessage)
      }

      const data = await response.json()
      
      if (data.IpfsHash) {
        return {
          success: true,
          ipfsHash: data.IpfsHash,
          pinataUrl: `https://gateway.pinata.cloud/ipfs/${data.IpfsHash}`
        }
      } else {
        throw new Error('No IPFS hash returned from Pinata')
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
   * Upload JSON data to Pinata IPFS
   */
  async uploadJSON(jsonData: any, name?: string): Promise<PinataUploadResult> {
    try {
      if (!this.jwt && (!this.apiKey || !this.apiSecret)) {
        throw new Error('Pinata credentials not configured')
      }

      const body = {
        pinataContent: jsonData,
        pinataMetadata: {
          name: name || 'metadata.json',
          keyvalues: {
            app: 'pol-pump',
            timestamp: Date.now().toString()
          }
        },
        pinataOptions: {
          cidVersion: 1
        }
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json'
      }
      
      if (this.jwt) {
        headers['Authorization'] = `Bearer ${this.jwt}`
      } else {
        headers['pinata_api_key'] = this.apiKey
        headers['pinata_secret_api_key'] = this.apiSecret
      }

      const response = await fetch(`${this.baseUrl}/pinning/pinJSONToIPFS`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        const errorMessage =
          errorData?.error?.details ||
          errorData?.error ||
          errorData?.message ||
          `Pinata upload failed: ${response.status} ${response.statusText}`
        throw new Error(errorMessage)
      }

      const pinataData = await response.json()
      
      if (pinataData.IpfsHash) {
        return {
          success: true,
          ipfsHash: pinataData.IpfsHash,
          pinataUrl: `https://gateway.pinata.cloud/ipfs/${pinataData.IpfsHash}`
        }
      } else {
        throw new Error('No IPFS hash returned from Pinata')
      }
    } catch (error: any) {
      console.error('Pinata JSON upload error:', error)
      return {
        success: false,
        error: error.message || 'Failed to upload JSON to Pinata IPFS'
      }
    }
  }

  /**
   * Get IPFS gateway URL for a hash
   */
  getGatewayUrl(ipfsHash: string): string {
    return `https://gateway.pinata.cloud/ipfs/${ipfsHash}`
  }

  /**
   * Check if Pinata is configured
   */
  isConfigured(): boolean {
    return !!(this.jwt || (this.apiKey && this.apiSecret))
  }
}

export const pinataService = new PinataService()







