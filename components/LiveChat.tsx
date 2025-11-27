'use client'

import React, { useEffect, useRef, useState } from 'react'

const CHAT_URL = process.env.NEXT_PUBLIC_CHAT_URL || 'https://0g-pump-backend.onrender.com'

export default function LiveChat() {
  const [messages, setMessages] = useState<string[]>([])
  const [input, setInput] = useState('')
  const [isConnected, setIsConnected] = useState(false)
  const socketRef = useRef<any>(null)

  useEffect(() => {
    // Only try to connect if socket.io-client is available
    let socket: any = null
    
    try {
      // Dynamically import socket.io-client to avoid errors if not installed
      import('socket.io-client').then(({ io }) => {
        socket = io(CHAT_URL, {
          transports: ['websocket', 'polling'],
          reconnection: true,
          reconnectionAttempts: 3,
          reconnectionDelay: 1000,
          timeout: 5000,
        })
        
        socketRef.current = socket

        socket.on('connect', () => {
          setIsConnected(true)
        })

        socket.on('disconnect', () => {
          setIsConnected(false)
        })

        socket.on('connect_error', (error: Error) => {
          setIsConnected(false)
          // Silently handle connection errors - chat just won't work
          // Don't log to console to avoid spam
        })

        socket.on('chat message', (msg: string) => {
          setMessages((prev) => [...prev, msg])
        })
      }).catch((err) => {
        // Socket.io not available, chat disabled - fail silently
      })
    } catch (err) {
      // Chat initialization failed, continuing without live chat - fail silently
    }

    return () => {
      if (socket) {
        socket.disconnect()
      }
    }
  }, [])

  const sendMessage = () => {
    if (!input.trim()) return
    if (socketRef.current && isConnected) {
      socketRef.current.emit('chat message', input.trim())
    } else {
      // Fallback: add message locally if chat server is unavailable
      setMessages((prev) => [...prev, `You: ${input.trim()}`])
    }
    setInput('')
  }

  return (
    <div className="p-2 border border-gray-700 rounded-lg bg-black/30">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-medium text-white">Live Chat</h3>
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-gray-500'
            }`}
          />
          <span className="text-xs text-gray-400">
            {isConnected ? 'Connected' : 'Offline'}
          </span>
        </div>
      </div>
      <div className="h-80 overflow-y-auto bg-black/20 p-2 rounded mb-2">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 text-sm py-8">
            {isConnected
              ? 'No messages yet. Start the conversation!'
              : 'Chat server unavailable. Messages will be shown locally.'}
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} className="mb-1 text-sm text-white">{msg}</div>
          ))
        )}
      </div>
      <div className="flex gap-2">
        <input
          className="border border-gray-600 bg-black/40 text-white p-2 flex-1 rounded text-sm placeholder-gray-500"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
          placeholder="Say something..."
        />
        <button
          onClick={sendMessage}
          className="px-3 py-2 bg-yellow-500 hover:bg-yellow-600 text-black rounded font-medium text-sm transition-colors"
        >
          Send
        </button>
      </div>
    </div>
  )
}


