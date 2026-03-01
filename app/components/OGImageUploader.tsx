"use client";

import { useState, useRef, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { UploadCloud, ImageIcon, Copy, Check, LinkIcon, Trash2 } from "lucide-react";
import { useAuth } from "../providers/AuthContext";

interface OGImageUploaderProps {
  onImageUploaded?: (cid: string, file: File) => void;
  className?: string;
}

export default function OGImageUploader({ onImageUploaded, className = "" }: OGImageUploaderProps) {
  const { accessToken } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [uploads, setUploads] = useState<Array<{ cid: string; name: string; type: string }>>([]);
  const [isReused, setIsReused] = useState(false);
  const [viewUrl, setViewUrl] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const API_BASE = useMemo(() => {
    const env = (typeof process !== 'undefined' && (process as any).env && (process as any).env.NEXT_PUBLIC_BACKEND_URL) as string | undefined
    if (env) return env
    if (typeof window !== 'undefined') return `${window.location.protocol}//${window.location.hostname}:4000`
    return 'http://localhost:4000'
  }, []);

  const onDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const f = e.dataTransfer.files?.[0];
    if (f) handleSelect(f);
  }, []);

  const handleSelect = (f: File) => {
    setFile(f);
    setError(null);
    setSuccess(null);
    setViewUrl(null);
    setProgress(0);
    setCopied(false);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(f));
  };

  // Check if file already exists on network
  const checkFileExists = async (file: File): Promise<string | null> => {
    try {
      // Try backend first
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 3000) // 3 second timeout
      
      try {
        const response = await fetch(`${API_BASE}/check-file`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            fileHash: `file_${file.name}_${file.size}`, // Simplified identifier
            fileName: file.name,
            fileSize: file.size
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId)

        if (response.ok) {
          const result = await response.json();
          if (result.exists && result.rootHash) {
            console.log('✅ File already exists on network:', result.rootHash);
            return result.rootHash;
          }
        }
      } catch (fetchError: any) {
        clearTimeout(timeoutId)
        if (fetchError.name !== 'AbortError') {
          console.warn('Backend check-file not available, skipping:', fetchError?.message || fetchError);
        }
      }
      
      // Fallback: Check local storage for recent uploads with same name/size
      // This is a simplified approach - in production you'd want proper content hashing
      const localUploads = localStorage.getItem('pol_image_uploads')
      if (localUploads) {
        try {
          const uploads = JSON.parse(localUploads)
          const match = uploads.find((u: any) => 
            u.name === file.name && u.size === file.size
          )
          if (match && match.cid) {
            console.log('✅ Found matching file in local cache:', match.cid)
            return match.cid
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
      
      return null;
    } catch (error) {
      console.warn('Could not check if file exists:', error);
      return null;
    }
  };

  const onUpload = async () => {
    if (!file) return;
    if (!accessToken) {
      setError('Authentication required. Please sign in as CREATOR, then try upload again.');
      return;
    }
    setUploading(true);
    setError(null);
    setSuccess(null);
    setProgress(5);

    try {
      // First check if file already exists on network
      setProgress(10);
      const existingHash = await checkFileExists(file);
      
      if (existingHash) {
        // File already exists, use existing hash
        console.log('✅ Using existing file hash:', existingHash);
        const url = `${API_BASE}/download/${existingHash}`;
        setSuccess(existingHash);
        setViewUrl(url);
        setUploads((u) => [{ cid: existingHash, name: file?.name || '', type: file?.type || '' }, ...u]);
        if (onImageUploaded && file) {
          onImageUploaded(existingHash, file);
        }
        setUploading(false);
        setProgress(100);
        return;
      }

      // File doesn't exist, proceed with upload
      setProgress(20);
      const form = new FormData();
      form.append("file", file);

      // Upload via Next.js API route (which will try backend first, then fallback to local storage)
      const response = await fetch('/api/upload', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        body: form
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => null);
        throw new Error(errorPayload?.error || `Upload failed (${response.status})`);
      }

      const result = await response.json();
      
      if (result.success && result.rootHash) {
        if (result.reused) {
          console.log('✅ File reused from network:', result.rootHash);
          setIsReused(true);
        } else {
          const source = result.source === 'pinata' ? 'IPFS (Pinata)' : result.source === 'backend' ? 'Backend Storage' : 'Local Storage'
          console.log(`✅ Upload successful (${source}):`, result.rootHash);
          if (result.pinataUrl) {
            console.log('📌 Pinata URL:', result.pinataUrl);
          }
        }
        const url =
          result.pinataUrl ||
          result.gatewayUrl ||
          `${API_BASE}/download/${result.rootHash}`;

        setSuccess(result.rootHash);
        setViewUrl(url);
        setUploads((u) => [{ cid: result.rootHash, name: file?.name || '', type: file?.type || '' }, ...u]);
        
        // Store in local cache for future checks
        try {
          const localUploads = localStorage.getItem('pol_image_uploads')
          const uploads = localUploads ? JSON.parse(localUploads) : []
          uploads.unshift({ cid: result.rootHash, name: file.name, size: file.size, timestamp: Date.now() })
          // Keep only last 50 uploads
          localStorage.setItem('pol_image_uploads', JSON.stringify(uploads.slice(0, 50)))
        } catch (e) {
          // Ignore storage errors
        }
        
        if (onImageUploaded && file) {
          onImageUploaded(result.rootHash, file);
        }
        setUploading(false);
        setProgress(100);
      } else {
        throw new Error(result.error || 'Upload failed - no root hash returned');
      }

    } catch (error: any) {
      console.error('Upload error:', error);
      const errorMessage = error.message || 'Upload failed'
      // Provide more helpful error messages
      if (errorMessage.includes('Failed to fetch') || errorMessage.includes('NetworkError')) {
        setError('Unable to connect to upload service. Please check your connection and try again.');
      } else {
        setError(errorMessage);
      }
      setUploading(false);
      setProgress(0);
    }
  };

  // Polling function removed - direct uploads only

  const reset = () => {
    setFile(null);
    setPreviewUrl((old) => {
      if (old) URL.revokeObjectURL(old);
      return null;
    });
    setError(null);
    setSuccess(null);
    setViewUrl(null);
    setCopied(false);
    setProgress(0);
    setIsReused(false);
  };

  const copyCid = async () => {
    if (!success) return;
    try {
      await navigator.clipboard.writeText(success);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  const dragProps = {
    onDragOver: (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(true);
    },
    onDragLeave: () => setIsDragging(false),
    onDrop,
  } as const;

  return (
    <div className={`w-full ${className}`}>
      {/* Upload Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="rounded-2xl p-6 bg-slate-800/90 backdrop-blur border border-slate-700/50 shadow-2xl"
      >
        <div
          {...dragProps}
          onClick={() => inputRef.current?.click()}
          className={`cursor-pointer grid place-items-center rounded-2xl border-2 border-dashed p-8 transition relative overflow-hidden ${
            isDragging ? "border-purple-400 bg-purple-500/10" : "border-slate-600/50 hover:border-purple-500/50"
          }`}
        >
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute -inset-1 bg-gradient-to-r from-purple-500/10 via-blue-500/10 to-purple-500/10 blur-2xl" />
          </div>
          <div className="flex flex-col items-center gap-3 z-10 text-center">
            <UploadCloud className="w-10 h-10 text-purple-400" />
            <div className="text-lg font-semibold text-slate-200">Drop image here or click to choose</div>
            <div className="text-sm text-slate-400">PNG, JPG, GIF, or WebP. 10MB max</div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleSelect(f);
              }}
            />
          </div>
        </div>

        {file && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Preview */}
            <div className="rounded-xl overflow-hidden bg-slate-700/40 border border-slate-600/50">
              {previewUrl ? (
                <img src={previewUrl} alt="preview" className="w-full h-64 object-contain bg-slate-800" />
              ) : (
                <div className="h-64 grid place-items-center text-slate-400">
                  <ImageIcon className="w-8 h-8" />
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm uppercase tracking-wide text-slate-400">Selected</div>
                  <div className="font-semibold break-all text-slate-200">{file.name}</div>
                  <div className="text-xs text-slate-500">{(file.size / 1024).toFixed(1)} KB · {file.type || "image"}</div>
                </div>
                <button
                  onClick={reset}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-500/20 border border-red-500/30 hover:bg-red-500/30 transition"
                >
                  <Trash2 className="w-4 h-4" /> Clear
                </button>
              </div>

              <div className="h-2 rounded-full bg-slate-700/60 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-400 via-blue-400 to-purple-400 transition-[width] duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Upload Status */}
              {uploading && (
                <div className="text-sm text-slate-300 bg-slate-700/40 border border-slate-600/50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold">Upload Status</span>
                    <span className="px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-300">
                      {progress < 20 ? 'Checking Network' : 'Uploading'}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {progress < 20 
                      ? 'Checking if file already exists on storage...' 
                      : 'Uploading directly to storage...'
                    }
                  </div>
                </div>
              )}

              {/* Reused File Status */}
              {isReused && success && (
                <div className="text-sm text-blue-300 bg-blue-500/10 border border-blue-500/30 rounded-xl p-3">
                  <div className="flex items-center gap-2">
                    <span className="text-blue-400">🔄</span>
                    <span>File already exists on storage network - reusing existing hash!</span>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <button
                  disabled={uploading}
                  onClick={onUpload}
                  className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 disabled:opacity-60 disabled:cursor-not-allowed shadow-lg text-white font-semibold"
                >
                  {uploading ? (progress < 20 ? "Checking Network…" : "Uploading…") : "Upload to Storage"}
                </button>

                {success && (
                  <>
                    <button
                      onClick={copyCid}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700/60 border border-slate-600/50 hover:bg-slate-700/80 text-slate-200"
                    >
                      {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied ? "Copied" : "Copy CID"}
                    </button>
                    <a
                      href={viewUrl || `${API_BASE}/download/${success}`}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-700/60 border border-slate-600/50 hover:bg-slate-700/80 text-slate-200"
                    >
                      <LinkIcon className="w-4 h-4" /> Open Image
                    </a>
                  </>
                )}
              </div>

              {error && (
                <div className="text-red-300 text-sm bg-red-500/10 border border-red-500/30 rounded-xl p-3">
                  {error}
                </div>
              )}

              {success && (
                <div className="text-emerald-300 text-sm bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 break-all">
                  {isReused ? 'File reused from network! ' : 'File ready! '}CID: {success}
                </div>
              )}
            </div>
          </div>
        )}
      </motion.div>

      {/* Recent Uploads */}
      {uploads.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="mt-6"
        >
          <h3 className="text-lg font-bold mb-3 text-slate-200">Recent uploads</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {uploads.map((u) => (
              <div key={u.cid} className="rounded-xl overflow-hidden bg-slate-700/40 border border-slate-600/50">
                <div className="aspect-video bg-slate-800 grid place-items-center overflow-hidden">
                  <img
                    src={`${API_BASE}/download/${u.cid}`}
                    alt={u.name}
                    className="object-contain w-full h-full"
                  />
                </div>
                <div className="p-3 text-xs">
                  <div className="font-semibold truncate text-slate-200" title={u.name}>{u.name}</div>
                  <div className="text-slate-400 truncate" title={u.cid}>{u.cid}</div>
                  <div className="mt-2 flex gap-2">
                    <a
                      href={`${API_BASE}/download/${u.cid}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-slate-600/50 hover:bg-slate-600/70 text-slate-300 text-xs"
                    >
                      <LinkIcon className="w-3 h-3" /> Open
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
