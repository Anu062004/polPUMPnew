'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Send, Bot, User, Sparkles, Loader2 } from 'lucide-react'
import PremiumNavbar from '../components/PremiumNavbar'
import BlobBackground from '../components/BlobBackground'
import { usePumpAI } from '../providers/PumpAIContext'
import { useRouter } from 'next/navigation'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

type PumpAIToolCall =
  | { type: 'open_token_chart'; tokenSymbol: string }
  | { type: 'open_games' }
  | { type: 'buy_token'; tokenSymbol: string; amountUsd: number }
  | { type: 'sell_token'; tokenSymbol: string; amountPercent: number }

export default function AiChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm PumpAI, your POL Pump assistant. I can help you with token analysis, market insights, Polygon network questions, and more. What would you like to know?",
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { memory } = usePumpAI()
  const router = useRouter()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const openTradeModal = (
    tokenSymbol: string,
    action: 'buy' | 'sell',
    amount: number
  ) => {
    // For now, navigate to advanced page with query params.
    // Existing trading UI will handle the actual trade.
    const params = new URLSearchParams({
      token: tokenSymbol.toLowerCase(),
      action,
      amount: String(amount)
    })
    router.push(`/advanced?${params.toString()}`)
  }

  const handleToolCall = (toolCall: PumpAIToolCall) => {
    switch (toolCall.type) {
      case 'open_token_chart':
        router.push(`/advanced?token=${toolCall.tokenSymbol.toLowerCase()}`)
        break
      case 'open_games':
        router.push('/gaming')
        break
      case 'buy_token':
        openTradeModal(toolCall.tokenSymbol, 'buy', toolCall.amountUsd)
        break
      case 'sell_token':
        openTradeModal(
          toolCall.tokenSymbol,
          'sell',
          toolCall.amountPercent
        )
        break
      default:
        break
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setIsLoading(true)

    try {
      // Use Next.js API route instead of external backend
      const response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userMessage.content,
          conversation: messages.slice(-10), // Send last 10 messages for context
          memory
        })
      })

      if (!response.ok) {
        throw new Error('Failed to get AI response')
      }

      const data = await response.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.response || 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date()
      }

      setMessages(prev => [...prev, assistantMessage])

      if (data.toolCall) {
        handleToolCall(data.toolCall as PumpAIToolCall)
      }
    } catch (error) {
      console.error('AI Chat error:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'I apologize, but I\'m having trouble connecting to the AI service right now. This might be due to network issues or the AI Compute service being temporarily unavailable. Please try again in a moment, or feel free to ask me about tokens, Polygon network, or trading strategies!',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="min-h-screen relative overflow-hidden">
      <BlobBackground />
      <PremiumNavbar />
      <div className="relative z-10 container mx-auto px-4 pt-24 pb-8 max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl mb-6 shadow-lg">
            <Bot className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-4">
            Ask <span className="text-blue-400">PumpAI</span>
          </h1>
          <p className="text-xl text-[#E3E4E8] max-w-2xl mx-auto">
            Chat with our AI assistant powered by POL Pump AI. Get insights on tokens, market trends, and Polygon network.
          </p>
        </div>

        {/* Chat Container */}
        <div className="glass-card overflow-hidden border border-white/20 shadow-2xl">
          {/* Messages */}
          <div className="h-[500px] overflow-y-auto p-6 space-y-4 custom-scrollbar">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`flex max-w-[80%] ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                  {/* Avatar */}
                  <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center shadow-lg ${message.role === 'user'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 ml-3'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 mr-3'
                    }`}>
                    {message.role === 'user' ? (
                      <User className="w-5 h-5 text-white" />
                    ) : (
                      <Bot className="w-5 h-5 text-white" />
                    )}
                  </div>

                  {/* Message Content */}
                  <div className={`rounded-2xl px-5 py-3 shadow-lg backdrop-blur-sm ${message.role === 'user'
                      ? 'bg-gradient-to-r from-emerald-600/90 to-teal-600/90 text-white border border-emerald-500/30'
                      : 'bg-slate-800/60 text-white border border-slate-700/50'
                    }`}>
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                    <p className={`text-xs mt-2 ${message.role === 'user' ? 'text-white/70' : 'text-[#E3E4E8]/60'
                      }`}>
                      {formatTime(message.timestamp)}
                    </p>
                  </div>
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="flex">
                  <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-r from-blue-600 to-indigo-600 mr-3 flex items-center justify-center shadow-lg">
                    <Bot className="w-5 h-5 text-white" />
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-2xl px-5 py-3 border border-white/20">
                    <div className="flex items-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                      <span className="text-sm text-white">PumpAI is thinking...</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <div className="border-t border-white/10 p-4 bg-white/5 backdrop-blur-sm">
            <form onSubmit={handleSubmit} className="flex space-x-3">
              <div className="flex-1 relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask PumpAI anything about tokens, Polygon network, or market trends..."
                  className="w-full px-5 py-4 pr-12 bg-slate-800/60 backdrop-blur-sm border border-slate-700/50 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  disabled={isLoading}
                />
                <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                  <Sparkles className="w-5 h-5 text-blue-400" />
                </div>
              </div>
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className="px-6 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:shadow-lg hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 transition-all duration-200 flex items-center space-x-2 font-semibold"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
                <span>Send</span>
              </button>
            </form>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-8">
          <h3 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-blue-400" />
            Quick Questions
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[
              "What's the next meme coin trend?",
              "Analyze my token performance",
              "Explain Polygon benefits",
              "Suggest viral taglines for my token",
              "What are the best DeFi strategies?",
              "How does Polygon work?"
            ].map((question, index) => (
              <button
                key={index}
                onClick={() => setInput(question)}
                className="p-4 text-left glass-card border border-slate-700/50 hover:border-blue-500/50 hover:shadow-lg hover:scale-105 transition-all duration-200 text-sm text-white group"
              >
                <span className="group-hover:text-blue-400 transition-all">{question}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
