'use client'
import { useState, useRef } from 'react'

interface ImageUploadProps {
  onImageSelect: (file: File) => void
  selectedImage?: File | null
  className?: string
}

export default function ImageUpload({ onImageSelect, selectedImage, className = '' }: ImageUploadProps) {
  const [isDragOver, setIsDragOver] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      onImageSelect(file)
      
      // Create preview URL
      const url = URL.createObjectURL(file)
      setPreviewUrl(url)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const removeImage = () => {
    onImageSelect(null as any)
    setPreviewUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  return (
    <div className={`w-full ${className}`}>
      <label className="flex flex-col">
        <span className="text-sm opacity-80 mb-1">Token Image (Optional)</span>
        
        {!selectedImage ? (
          <div
            className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-colors cursor-pointer ${
              isDragOver 
                ? 'border-cyan-400 bg-cyan-400/10' 
                : 'border-white/20 hover:border-white/40'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={handleClick}
          >
            <div className="flex flex-col items-center justify-center space-y-2">
              <div className="text-4xl">🖼️</div>
              <div className="text-sm opacity-80">
                <span className="text-cyan-400">Click to upload</span> or drag and drop
              </div>
              <div className="text-xs opacity-60">
                PNG, JPG, GIF up to 10MB
              </div>
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileInput}
              className="hidden"
            />
          </div>
        ) : (
          <div className="relative border border-white/20 rounded-xl p-4 nb-press">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-[#8C52FF]/10">
                {previewUrl && (
                  <img 
                    src={previewUrl} 
                    alt="Preview" 
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">{selectedImage.name}</div>
                <div className="text-xs opacity-60">
                  {(selectedImage.size / 1024 / 1024).toFixed(2)} MB
                </div>
              </div>
              <button
                type="button"
                onClick={removeImage}
                className="px-3 py-1 text-xs bg-red-500/20 text-red-300 rounded-lg hover:bg-red-500/30 transition-colors"
              >
                Remove
              </button>
            </div>
          </div>
        )}
      </label>
    </div>
  )
}














