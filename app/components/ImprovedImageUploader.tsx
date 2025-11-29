'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, X, CheckCircle, AlertCircle, Image as ImageIcon, Loader2 } from 'lucide-react'

interface ImprovedImageUploaderProps {
  onImageUploaded?: (cid: string, file: File) => void
  maxSizeMB?: number
  acceptedFormats?: string[]
}

export default function ImprovedImageUploader({
  onImageUploaded,
  maxSizeMB = 10,
  acceptedFormats = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'],
}: ImprovedImageUploaderProps) {
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [uploadStatus, setUploadStatus] = useState<string>('')
  
  const inputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): string | null => {
    if (!acceptedFormats.includes(file.type)) {
      return `Invalid file type. Accepted: ${acceptedFormats.map(f => f.split('/')[1].toUpperCase()).join(', ')}`
    }
    
    const maxSizeBytes = maxSizeMB * 1024 * 1024
    if (file.size > maxSizeBytes) {
      return `File too large. Maximum size: ${maxSizeMB}MB`
    }
    
    return null
  }

  const handleFileSelect = useCallback((selectedFile: File) => {
    const validationError = validateFile(selectedFile)
    if (validationError) {
      setError(validationError)
      return
    }

    setFile(selectedFile)
    setError(null)
    setSuccess(null)
    setProgress(0)
    
    // Create preview
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    const url = URL.createObjectURL(selectedFile)
    setPreviewUrl(url)
  }, [previewUrl, maxSizeMB, acceptedFormats])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const droppedFile = e.dataTransfer.files?.[0]
    if (droppedFile) {
      handleFileSelect(droppedFile)
    }
  }, [handleFileSelect])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      handleFileSelect(selectedFile)
    }
  }

  const handleUpload = async () => {
    if (!file) return

    setUploading(true)
    setError(null)
    setSuccess(null)
    setProgress(5)
    setUploadStatus('Preparing upload...')

    try {
      // Check if file exists
      setProgress(15)
      setUploadStatus('Checking storage network...')
      
      const formData = new FormData()
      formData.append('file', file)

      setProgress(30)
      setUploadStatus('Uploading to decentralized storage...')

      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      setProgress(70)

      if (!response.ok) {
        throw new Error(`Upload failed (${response.status})`)
      }

      const result = await response.json()

      if (result.success && result.rootHash) {
        setProgress(100)
        const source = result.source === 'pinata' ? 'IPFS (Pinata)' : result.source === 'backend' ? 'Backend Storage' : 'Local Storage'
        setUploadStatus(`Upload complete! (${source})`)
        setSuccess(result.rootHash)
        
        if (onImageUploaded) {
          onImageUploaded(result.rootHash, file)
        }
      } else {
        throw new Error(result.error || 'Upload failed')
      }
    } catch (err: any) {
      console.error('Upload error:', err)
      setError(err.message || 'Upload failed')
      setProgress(0)
      setUploadStatus('')
    } finally {
      setUploading(false)
    }
  }

  const handleRemove = () => {
    setFile(null)
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl)
      setPreviewUrl(null)
    }
    setError(null)
    setSuccess(null)
    setProgress(0)
    setUploadStatus('')
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  return (
    <div className="w-full space-y-4">
      {/* Upload Area */}
      {!file ? (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => inputRef.current?.click()}
          className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer ${
            isDragging
              ? 'border-[#12D9C8] bg-[#12D9C8]/10 scale-105'
              : 'border-white/20 hover:border-white/40 hover:bg-white/5'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={acceptedFormats.join(',')}
            onChange={handleInputChange}
            className="hidden"
          />
          
          <motion.div
            animate={isDragging ? { scale: 1.1 } : { scale: 1 }}
            className="flex flex-col items-center gap-3"
          >
            <div className="p-4 bg-white/5 rounded-full">
              <Upload className="w-8 h-8 text-[#12D9C8]" />
            </div>
            <div>
              <div className="text-lg font-semibold text-white mb-1">
                {isDragging ? 'Drop your image here' : 'Upload Token Image'}
              </div>
              <div className="text-sm text-white/60">
                Click to browse or drag and drop
              </div>
              <div className="text-xs text-white/40 mt-2">
                {acceptedFormats.map(f => f.split('/')[1].toUpperCase()).join(', ')} • Max {maxSizeMB}MB
              </div>
            </div>
          </motion.div>
        </div>
      ) : (
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-card p-4 space-y-4"
          >
            {/* Preview */}
            <div className="flex items-start gap-4">
              <div className="relative w-24 h-24 rounded-lg overflow-hidden bg-white/5 flex-shrink-0">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-white/40" />
                  </div>
                )}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white truncate">{file.name}</div>
                <div className="text-sm text-white/60">
                  {(file.size / 1024 / 1024).toFixed(2)} MB • {file.type.split('/')[1].toUpperCase()}
                </div>
                
                {/* Progress Bar */}
                {uploading && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center justify-between text-xs text-white/60">
                      <span>{uploadStatus}</span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.3 }}
                        className="h-full bg-gradient-to-r from-[#FF4F84] to-[#12D9C8]"
                      />
                    </div>
                  </div>
                )}
              </div>
              
              <button
                onClick={handleRemove}
                disabled={uploading}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5 text-white" />
              </button>
            </div>

            {/* Actions */}
            {!success && (
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="btn-primary w-full justify-center disabled:opacity-50"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-5 h-5 mr-2" />
                    Upload to Storage
                  </>
                )}
              </button>
            )}
          </motion.div>
        </AnimatePresence>
      )}

      {/* Status Messages */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-3 p-4 bg-red-500/20 border border-red-500/50 rounded-xl"
          >
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-300">{error}</div>
          </motion.div>
        )}

        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex items-start gap-3 p-4 bg-green-500/20 border border-green-500/50 rounded-xl"
          >
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-green-300 mb-1">Upload Successful!</div>
              <div className="text-xs text-green-300/80 font-mono break-all">{success}</div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
