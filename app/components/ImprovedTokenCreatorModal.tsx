'use client'
import { useState, useEffect } from 'react'
import { ethers, BrowserProvider } from 'ethers'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Plus, CheckCircle, AlertCircle, Info } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import ImprovedImageUploader from './ImprovedImageUploader'
import { InfoTooltip } from '@/components/InfoTooltip'
import { newFactoryService } from '../../lib/newFactoryService'
import { newBondingCurveTradingService } from '../../lib/newBondingCurveTradingService'
import { CONTRACT_CONFIG } from '../../lib/contract-config'

interface ImprovedTokenCreatorModalProps {
  isOpen: boolean
  onClose: () => void
  onTokenCreated?: (tokenData: any) => void
}

export default function ImprovedTokenCreatorModal({ isOpen, onClose, onTokenCreated }: ImprovedTokenCreatorModalProps) {
  const { isConnected, address } = useAccount()

  const FACTORY_ADDRESS = CONTRACT_CONFIG.FACTORY_ADDRESS

  // Form state
  const [name, setName] = useState('')
  const [symbol, setSymbol] = useState('')
  const [supply, setSupply] = useState('')
  const [description, setDescription] = useState('')
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imageHash, setImageHash] = useState<string>('')
  
  // Social media
  const [telegramUrl, setTelegramUrl] = useState('')
  const [xUrl, setXUrl] = useState('')
  const [discordUrl, setDiscordUrl] = useState('')
  const [websiteUrl, setWebsiteUrl] = useState('')

  // UI state
  const [isCreating, setIsCreating] = useState(false)
  const [status, setStatus] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [txHash, setTxHash] = useState<string>('')
  const [creationResult, setCreationResult] = useState<any>(null)
  const [showReviewModal, setShowReviewModal] = useState(false)

  // Validation errors
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  const resetForm = () => {
    setName('')
    setSymbol('')
    setSupply('')
    setDescription('')
    setSelectedImage(null)
    setImageHash('')
    setTelegramUrl('')
    setXUrl('')
    setDiscordUrl('')
    setWebsiteUrl('')
    setIsCreating(false)
    setStatus('')
    setError(null)
    setSuccess(false)
    setTxHash('')
    setCreationResult(null)
    setValidationErrors({})
    setShowReviewModal(false)
  }

  useEffect(() => {
    if (!isOpen) {
      resetForm()
    }
  }, [isOpen])

  // Initialize services
  useEffect(() => {
    if (isOpen && isConnected) {
      try {
        const eth = (typeof window !== 'undefined') ? (window as any).ethereum : undefined
        if (!eth) return
        const provider = new BrowserProvider(eth)
        provider.send('eth_requestAccounts', []).catch(() => { })
        newFactoryService.initialize(provider, FACTORY_ADDRESS)
      } catch (error) {
        console.error('Failed to initialize factory service:', error)
      }
    }
  }, [isOpen, isConnected])

  // Validation
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {}

    if (!name.trim()) {
      errors.name = 'Token name is required'
    } else if (name.length < 2 || name.length > 50) {
      errors.name = 'Name must be 2-50 characters'
    }

    if (!symbol.trim()) {
      errors.symbol = 'Symbol is required'
    } else if (symbol.length < 2 || symbol.length > 6) {
      errors.symbol = 'Symbol must be 2-6 characters'
    } else if (!/^[A-Z0-9]+$/.test(symbol)) {
      errors.symbol = 'Symbol must be uppercase letters and numbers only'
    }

    if (!supply.trim()) {
      errors.supply = 'Supply is required'
    } else {
      const numSupply = parseFloat(supply.replace(/_/g, ''))
      if (isNaN(numSupply) || numSupply <= 0) {
        errors.supply = 'Supply must be a positive number'
      } else if (numSupply > 1000000000000) {
        errors.supply = 'Supply too large (max 1 trillion)'
      }
    }

    if (!selectedImage || !imageHash) {
      errors.image = 'Please upload a token image'
    }

    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleReview = () => {
    if (validateForm()) {
      setShowReviewModal(true)
    }
  }

  const handleCreate = async () => {
    setShowReviewModal(false)
    setIsCreating(true)
    setError(null)
    setStatus('')
    setTxHash('')

    try {
      if (!address) throw new Error('Wallet not connected')
      if (!imageHash) throw new Error('Please upload an image first')

      // Create metadata
      setStatus('Uploading metadata to storage...')
      const meta = {
        name,
        symbol,
        description: description || `${name} (${symbol}) - A memecoin created on Polygon Amoy`,
        supply: supply.replace(/_/g, ''),
        creator: address,
        imageRootHash: imageHash,
        createdAt: new Date().toISOString(),
        telegramUrl: telegramUrl || undefined,
        xUrl: xUrl || undefined,
        discordUrl: discordUrl || undefined,
        websiteUrl: websiteUrl || undefined
      }

      const form = new FormData()
      form.append('name', name)
      form.append('symbol', symbol)
      form.append('description', meta.description)
      form.append('supply', meta.supply)
      form.append('creator', meta.creator || '')
      form.append('imageRootHash', imageHash)

      const resp = await fetch('/api/createCoin', {
        method: 'POST',
        body: form
      })
      const json = await resp.json()
      if (!resp.ok || !json.success) {
        throw new Error(json?.error || 'Failed to upload metadata')
      }

      const metadataRootHash = json.coin.metadataRootHash as string

      setStatus('Creating token with bonding curve on Polygon Amoy (this may take 30-60 seconds)...')

      const result = await newFactoryService.createPair({
        name,
        symbol,
        seedTokenAmount: supply.replace(/_/g, ''),
        seedOgAmount: '0.5'
      })

      if (!result.success) {
        throw new Error(result.error || 'Failed to create token')
      }

      // Resolve token/curve addresses - MUST have both before proceeding
      let tokenAddr = result.tokenAddress
      let curveAddr = result.curveAddress
      
      // If addresses are missing, resolve them aggressively
      if (!tokenAddr || !curveAddr) {
        console.log('⏳ Resolving bonding curve addresses from transaction...')
        setStatus('⏳ Resolving bonding curve addresses (this may take 30-60 seconds)...')
        
        // Try up to 10 times with increasing delays (total ~2 minutes max)
        let resolved = false
        for (let attempt = 0; attempt < 10; attempt++) {
          if (attempt > 0) {
            const delay = Math.min(3000 * attempt, 10000) // 3s, 6s, 9s, 10s, 10s...
            setStatus(`⏳ Resolving addresses... (attempt ${attempt + 1}/10, waiting ${delay/1000}s)`)
            await new Promise(r => setTimeout(r, delay))
          }

          try {
            const respResolve = await fetch('/api/resolvePair', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                txHash: result.txHash,
                creator: address,
                factory: FACTORY_ADDRESS
              })
            })

            if (respResolve.ok) {
              const rj = await respResolve.json()
              if (rj.tokenAddress && rj.curveAddress) {
                tokenAddr = rj.tokenAddress
                curveAddr = rj.curveAddress
                console.log('✅ Successfully resolved addresses:', { tokenAddr, curveAddr })
                resolved = true
                break
              }
            }
          } catch (e) {
            console.warn(`Resolve attempt ${attempt + 1} failed:`, e)
          }
        }

        if (!resolved) {
          // Last resort: try to get from token's minter() function
          if (tokenAddr && !curveAddr) {
            try {
              setStatus('⏳ Trying alternative method to find bonding curve...')
              const curveRes = await fetch(`/api/token/curve?tokenAddress=${tokenAddr}`)
              const curveData = await curveRes.json()
              if (curveData.success && curveData.curveAddress) {
                curveAddr = curveData.curveAddress
                console.log('✅ Found curve via token lookup:', curveAddr)
                resolved = true
              }
            } catch (e) {
              console.warn('Alternative curve lookup failed:', e)
            }
          }
        }

        if (!tokenAddr || !curveAddr) {
          throw new Error(
            'Could not resolve bonding curve addresses after multiple attempts. The transaction was successful, but Polygon indexing may be delayed. Please wait 1-2 minutes and refresh the page, or check PolygonScan for the transaction.'
          )
        }
      }

      // Final validation - addresses must be valid before proceeding
      if (!tokenAddr || !curveAddr || !ethers.isAddress(tokenAddr) || !ethers.isAddress(curveAddr)) {
        throw new Error(
          'Invalid addresses after resolution. Token: ' + tokenAddr + ', Curve: ' + curveAddr + '. Please try creating the token again.'
        )
      }

      // Final validation - addresses must be valid before proceeding
      if (!tokenAddr || !curveAddr || !ethers.isAddress(tokenAddr) || !ethers.isAddress(curveAddr)) {
        throw new Error(
          'Invalid addresses after resolution. Token: ' + tokenAddr + ', Curve: ' + curveAddr + '. Please try creating the token again.'
        )
      }

      console.log('✅ Final addresses validated:', { 
        tokenAddress: tokenAddr, 
        curveAddress: curveAddr,
        txHash: result.txHash 
      })

      // Verify bonding curve is seeded and ready for trading
      setStatus('⏳ Verifying bonding curve is ready for trading...')
      try {
        const rpcUrl = process.env.NEXT_PUBLIC_EVM_RPC || 'https://polygon-amoy.infura.io/v3/b4f237515b084d4bad4e5de070b0452f'
        const readProvider = new ethers.JsonRpcProvider(rpcUrl)
        const curveInfo = await newBondingCurveTradingService.getCurveInfo(curveAddr, readProvider)
        
        if (!curveInfo) {
          throw new Error('Could not verify bonding curve. Please check the curve address.')
        }
        
        if (!curveInfo.seeded) {
          console.warn('⚠️ Bonding curve not seeded yet, but addresses are valid')
          setStatus('⚠️ Bonding curve is being initialized. Trading will be available shortly.')
        } else {
          console.log('✅ Bonding curve verified and ready for trading:', {
            ogReserve: curveInfo.ogReserve,
            tokenReserve: curveInfo.tokenReserve,
            currentPrice: curveInfo.currentPrice
          })
        }
      } catch (verifyError: any) {
        console.warn('Curve verification warning (non-fatal):', verifyError.message)
        // Don't fail creation if verification fails - addresses are valid
      }

      setCreationResult({ ...result, tokenAddress: tokenAddr, curveAddress: curveAddr })
      setTxHash(result.txHash || 'Transaction submitted')
      setStatus('✅ Token created successfully!')
      setSuccess(true)

      const tokenData = {
        name,
        symbol,
        supply: supply.replace(/_/g, ''),
        imageHash,
        tokenAddress: tokenAddr, // Already validated
        curveAddress: curveAddr, // Already validated
        txHash: result.txHash || 'Transaction submitted',
        description: meta.description,
        metadataRootHash,
        telegramUrl: telegramUrl || undefined,
        xUrl: xUrl || undefined,
        discordUrl: discordUrl || undefined,
        websiteUrl: websiteUrl || undefined
      }

      console.log('📤 Calling onTokenCreated with data:', {
        name: tokenData.name,
        symbol: tokenData.symbol,
        tokenAddress: tokenData.tokenAddress,
        curveAddress: tokenData.curveAddress,
        txHash: tokenData.txHash
      })

      if (onTokenCreated) onTokenCreated(tokenData)

    } catch (err: any) {
      setError(err.message ?? String(err))
      setStatus('')
    } finally {
      setIsCreating(false)
    }
  }

  return (
    <AnimatePresence mode="wait">
      {isOpen && (
        <motion.div
          key="token-creator-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-[#1a0b2e]/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          onClick={onClose}
          style={{ zIndex: 100 }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="w-full max-w-4xl max-h-[90vh] overflow-y-auto modal-content"
            onClick={(e) => e.stopPropagation()}
          >
            <Card className="bg-sky-100 text-slate-900 border-4 border-black shadow-[8px_8px_0_#000] rounded-2xl">
              <CardHeader className="relative">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl font-extrabold">
                    Create New Token
                  </CardTitle>
                  <Button
                    variant="secondary"
                    onClick={onClose}
                    className="border-4 border-black bg-white text-slate-900 shadow-[4px_4px_0_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
                  >
                    <X className="w-5 h-5" />
                  </Button>
                </div>
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-slate-700 text-sm">
                    Create your memecoin with instant trading via bonding curve
                  </p>
                  <ConnectButton />
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                <div className="grid md:grid-cols-2 gap-6 mobile-stack">
                  {/* Left column - Token details */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-extrabold text-slate-900 mb-2 flex items-center gap-2">
                        Token Name <span className="text-red-500">*</span>
                        <InfoTooltip content="The full name of your token (e.g., Doge Wow). This will be displayed everywhere." />
                      </label>
                      <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., Doge Wow"
                        className={`bg-white text-slate-900 border-4 border-black shadow-[4px_4px_0_#000] focus:outline-none focus:ring-0 ${
                          validationErrors.name ? 'border-red-500' : 'focus:border-black'
                        }`}
                      />
                      {validationErrors.name && (
                        <p className="text-xs text-red-600 mt-1">{validationErrors.name}</p>
                      )}
                      <p className="text-xs text-slate-600 mt-1">2-50 characters</p>
                    </div>

                    <div>
                      <label className="text-sm font-extrabold text-slate-900 mb-2 flex items-center gap-2">
                        Symbol <span className="text-red-500">*</span>
                        <InfoTooltip content="The ticker symbol for your token (e.g., WOW). Must be 2-6 uppercase letters/numbers." />
                      </label>
                      <Input
                        value={symbol}
                        onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                        placeholder="e.g., WOW"
                        className={`bg-white text-slate-900 border-4 border-black shadow-[4px_4px_0_#000] focus:outline-none focus:ring-0 ${
                          validationErrors.symbol ? 'border-red-500' : 'focus:border-black'
                        }`}
                        maxLength={6}
                      />
                      {validationErrors.symbol && (
                        <p className="text-xs text-red-600 mt-1">{validationErrors.symbol}</p>
                      )}
                      <p className="text-xs text-slate-600 mt-1">2-6 characters, uppercase only</p>
                    </div>

                    <div>
                      <label className="text-sm font-extrabold text-slate-900 mb-2 flex items-center gap-2">
                        Initial Supply <span className="text-red-500">*</span>
                        <InfoTooltip content="Total number of tokens to create. Use underscores for readability (e.g., 1_000_000)." />
                      </label>
                      <Input
                        value={supply}
                        onChange={(e) => setSupply(e.target.value)}
                        placeholder="e.g., 1_000_000"
                        className={`bg-white text-slate-900 border-4 border-black shadow-[4px_4px_0_#000] focus:outline-none focus:ring-0 ${
                          validationErrors.supply ? 'border-red-500' : 'focus:border-black'
                        }`}
                      />
                      {validationErrors.supply && (
                        <p className="text-xs text-red-600 mt-1">{validationErrors.supply}</p>
                      )}
                      <p className="text-xs text-slate-600 mt-1">Use underscores for readability</p>
                    </div>

                    <div>
                      <label className="text-sm font-extrabold text-slate-900 mb-2 flex items-center gap-2">
                        Description
                        <InfoTooltip content="A brief description of your token. This helps users understand what your token is about." />
                      </label>
                      <Input
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe your memecoin..."
                        className="bg-white text-slate-900 border-4 border-black shadow-[4px_4px_0_#000] focus:outline-none focus:ring-0 focus:border-black"
                      />
                    </div>

                    {/* Social Media URLs */}
                    <div className="space-y-3">
                      <h4 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                        Social Media (Optional)
                        <InfoTooltip content="Add social media links to build trust and community around your token." />
                      </h4>

                      <div>
                        <label className="text-xs text-slate-900 mb-1 block font-bold">Telegram</label>
                        <Input
                          value={telegramUrl}
                          onChange={(e) => setTelegramUrl(e.target.value)}
                          placeholder="https://t.me/yourgroup"
                          className="bg-white text-slate-900 border-4 border-black shadow-[4px_4px_0_#000] focus:outline-none focus:ring-0 focus:border-black text-sm"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-900 mb-1 block font-bold">X (Twitter)</label>
                        <Input
                          value={xUrl}
                          onChange={(e) => setXUrl(e.target.value)}
                          placeholder="https://x.com/yourhandle"
                          className="bg-white text-slate-900 border-4 border-black shadow-[4px_4px_0_#000] focus:outline-none focus:ring-0 focus:border-black text-sm"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-900 mb-1 block font-bold">Discord</label>
                        <Input
                          value={discordUrl}
                          onChange={(e) => setDiscordUrl(e.target.value)}
                          placeholder="https://discord.gg/invitecode"
                          className="bg-white text-slate-900 border-4 border-black shadow-[4px_4px_0_#000] focus:outline-none focus:ring-0 focus:border-black text-sm"
                        />
                      </div>

                      <div>
                        <label className="text-xs text-slate-900 mb-1 block font-bold">Website</label>
                        <Input
                          value={websiteUrl}
                          onChange={(e) => setWebsiteUrl(e.target.value)}
                          placeholder="https://yourwebsite.com"
                          className="bg-white text-slate-900 border-4 border-black shadow-[4px_4px_0_#000] focus:outline-none focus:ring-0 focus:border-black text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Right column - Image upload */}
                  <div className="space-y-4">
                    <div>
                      <label className="text-sm font-extrabold text-slate-900 mb-2 flex items-center gap-2">
                        Token Icon <span className="text-red-500">*</span>
                        <InfoTooltip content="Upload an image for your token. This will be stored on decentralized storage." />
                      </label>
                      <ImprovedImageUploader
                        onImageUploaded={(cid, file) => {
                          setSelectedImage(file)
                          setImageHash(cid)
                        }}
                        maxSizeMB={10}
                      />
                      {validationErrors.image && (
                        <p className="text-xs text-red-600 mt-2">{validationErrors.image}</p>
                      )}
                    </div>

                    {/* Bonding Curve Info */}
                    <div className="bg-white rounded-lg p-4 border-4 border-black shadow-[4px_4px_0_#000]">
                      <h4 className="text-sm font-extrabold text-slate-900 mb-3">🚀 Bonding Curve System</h4>
                      <div className="text-xs text-slate-900 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-green-400">✅</span>
                          <span>Immediate Trading Available</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-blue-400">📊</span>
                          <span>Constant-Product AMM (x * y = k)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-purple-400">💰</span>
                          <span>Fee: 0.5% (50 bps)</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-yellow-400">⚡</span>
                          <span>Automatic Liquidity Seeding</span>
                        </div>
                      </div>
                    </div>

                    {/* Fee Breakdown */}
                    <div className="bg-blue-50 rounded-lg p-4 border-2 border-blue-200">
                      <h4 className="text-sm font-extrabold text-slate-900 mb-2 flex items-center gap-2">
                        💎 Fee Breakdown
                        <InfoTooltip content="Transparent fee structure for token creation and trading." />
                      </h4>
                      <div className="text-xs text-slate-700 space-y-1">
                        <div className="flex justify-between">
                          <span>Creation Fee:</span>
                          <span className="font-bold">Free</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Trading Fee:</span>
                          <span className="font-bold">0.5%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Platform Fee:</span>
                          <span className="font-bold">0.3%</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Creator Fee:</span>
                          <span className="font-bold">0.2%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status messages */}
                {status && (
                  <div className="flex items-center gap-3 p-3 bg-blue-200 border-4 border-black rounded-2xl shadow-[4px_4px_0_#000]">
                    <CheckCircle className="w-5 h-5 text-blue-700" />
                    <span className="text-sm text-slate-900">{status}</span>
                  </div>
                )}

                {error && (
                  <div className="flex items-center gap-3 p-3 bg-red-200 border-4 border-black rounded-2xl shadow-[4px_4px_0_#000]">
                    <AlertCircle className="w-5 h-5 text-red-700" />
                    <span className="text-sm text-red-800">{error}</span>
                  </div>
                )}

                {success && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-green-500/20 border border-green-500/30 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-green-400" />
                      <span className="text-sm text-green-300">Token created successfully!</span>
                    </div>
                    {txHash && (
                      <div className="text-sm">
                        <span className="text-slate-400">Transaction: </span>
                        <a
                          target="_blank"
                          rel="noreferrer"
                          className="underline text-blue-400 hover:text-blue-300"
                          href={`https://amoy.polygonscan.com/tx/${txHash}`}
                        >
                          View on PolygonScan
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-3 pt-4 mobile-stack">
                  {!success ? (
                    <>
                      <Button
                        onClick={handleReview}
                        disabled={isCreating || !isConnected}
                        className="flex-1 bg-yellow-300 text-slate-900 border-4 border-black shadow-[6px_6px_0_#000] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-[3px_3px_0_#000]"
                      >
                        {!isConnected ? 'Connect Wallet First' : 'Review & Create Token'}
                      </Button>

                      <Button
                        variant="secondary"
                        onClick={onClose}
                        disabled={isCreating}
                        className="border-4 border-black bg-white text-slate-900 shadow-[4px_4px_0_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        onClick={() => {
                          resetForm()
                          setSuccess(false)
                        }}
                        className="flex-1 bg-green-400 text-slate-900 border-4 border-black shadow-[6px_6px_0_#000] hover:translate-x-[3px] hover:translate-y-[3px] hover:shadow-[3px_3px_0_#000]"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Create Another Token
                      </Button>

                      <Button
                        variant="secondary"
                        onClick={onClose}
                        className="border-4 border-black bg-white text-slate-900 shadow-[4px_4px_0_#000] hover:translate-x-1 hover:translate-y-1 hover:shadow-none"
                      >
                        Close
                      </Button>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Review Modal */}
          <AnimatePresence>
            {showReviewModal && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-[#1a0b2e]/90 backdrop-blur-sm flex items-center justify-center p-4"
                onClick={() => setShowReviewModal(false)}
              >
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="bg-sky-100 text-slate-900 border-4 border-black shadow-[8px_8px_0_#000] rounded-2xl p-6 max-w-md w-full"
                  onClick={(e) => e.stopPropagation()}
                >
                  <h3 className="text-xl font-extrabold mb-4">Review Your Token</h3>
                  <div className="space-y-3 mb-6">
                    <div className="flex justify-between">
                      <span className="text-slate-600">Name:</span>
                      <span className="font-bold">{name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Symbol:</span>
                      <span className="font-bold">{symbol}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-600">Supply:</span>
                      <span className="font-bold">{supply.replace(/_/g, ',')}</span>
                    </div>
                    {description && (
                      <div>
                        <span className="text-slate-600">Description:</span>
                        <p className="text-sm mt-1">{description}</p>
                      </div>
                    )}
                    {selectedImage && (
                      <div>
                        <span className="text-slate-600">Image:</span>
                        <p className="text-sm mt-1">✅ Uploaded</p>
                      </div>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <Button
                      onClick={handleCreate}
                      className="flex-1 bg-green-400 text-slate-900 border-4 border-black shadow-[6px_6px_0_#000]"
                    >
                      Confirm & Create
                    </Button>
                    <Button
                      onClick={() => setShowReviewModal(false)}
                      variant="secondary"
                      className="border-4 border-black bg-white text-slate-900 shadow-[4px_4px_0_#000]"
                    >
                      Back
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
