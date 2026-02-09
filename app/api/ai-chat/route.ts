import { NextRequest, NextResponse } from 'next/server'

type PumpAIToolCall =
  | { type: 'open_token_chart'; tokenSymbol: string }
  | { type: 'open_games' }
  | { type: 'buy_token'; tokenSymbol: string; amountUsd: number }
  | { type: 'sell_token'; tokenSymbol: string; amountPercent: number }

// Helper function to safely require modules
function safeRequire(path: string) {
  try {
    return require(path)
  } catch {
    return null
  }
}

// Simple AI chat handler - can be extended with real AI service
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, conversation, memory } = body

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Try to use compute runtime if available
    let aiResponse = null
    try {
      const runtime = safeRequire(process.cwd() + '/compute-runtime/broker.js')
      if (runtime) {
        await runtime.getBroker()
        const services = await runtime.listServices()
        if (services && services.length > 0) {
          const provider = services[0].provider
          await runtime.acknowledgeProvider(provider)
          const meta = await runtime.getServiceMetadata(provider)
          const { endpoint, model } = meta

          const messages = [
            ...(conversation || []).slice(-10).map((msg: any) => ({
              role: msg.role === 'user' ? 'user' : 'assistant',
              content: msg.content
            })),
            { role: 'user', content: message }
          ]

          const headers = await runtime.getRequestHeaders(provider, JSON.stringify(messages))

          const res = await fetch(`${endpoint}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...(headers || {}) },
            body: JSON.stringify({ messages, model })
          })

          const data = await res.json()
          aiResponse = data?.choices?.[0]?.message?.content
        }
      }
    } catch (error) {
      console.log('Compute runtime not available, using fallback:', error)
    }

    // Fallback to rule-based responses if AI service is not available
    if (!aiResponse) {
      aiResponse = generateFallbackResponse(message.toLowerCase())
    }

    // Simple rule-based tool call detection (can be enhanced later)
    const toolCall = detectToolCall(message)

    return NextResponse.json({
      response: aiResponse,
      toolCall,
      source: aiResponse ? 'compute' : 'fallback',
      memory: memory || null
    })
  } catch (error: any) {
    console.error('AI Chat error:', error)
    return NextResponse.json(
      {
        error: 'Failed to process AI request',
        message: error.message
      },
      { status: 500 }
    )
  }
}

// Simple rule-based tool detection until LLM tools are integrated
function detectToolCall(message: string): PumpAIToolCall | null {
  const lower = message.toLowerCase()

  // Open games
  if (lower.includes('open games') || lower.includes('play games')) {
    return { type: 'open_games' }
  }

  // Open chart for SYMBOL
  const openChartMatch = lower.match(/open (?:the )?chart for\s+([a-z0-9]+)/i)
  if (openChartMatch && openChartMatch[1]) {
    return {
      type: 'open_token_chart',
      tokenSymbol: openChartMatch[1].toUpperCase()
    }
  }

  // Buy SYMBOL AMOUNT  (interpreted as USD)
  const buyMatch = lower.match(/buy\s+([a-z0-9]+)\s+(\d+(?:\.\d+)?)/i)
  if (buyMatch && buyMatch[1] && buyMatch[2]) {
    const symbol = buyMatch[1].toUpperCase()
    const amount = parseFloat(buyMatch[2])
    if (!isNaN(amount) && amount > 0) {
      return {
        type: 'buy_token',
        tokenSymbol: symbol,
        amountUsd: amount
      }
    }
  }

  // Sell SYMBOL PERCENT%
  const sellMatch = lower.match(/sell\s+([a-z0-9]+)\s+(\d+(?:\.\d+)?)%/i)
  if (sellMatch && sellMatch[1] && sellMatch[2]) {
    const symbol = sellMatch[1].toUpperCase()
    const pct = parseFloat(sellMatch[2])
    if (!isNaN(pct) && pct > 0 && pct <= 100) {
      return {
        type: 'sell_token',
        tokenSymbol: symbol,
        amountPercent: pct
      }
    }
  }

  return null
}

// Fallback response generator for when AI service is unavailable
function generateFallbackResponse(message: string): string {
  const lowerMessage = message.toLowerCase()

  // Token and trading related
  if (lowerMessage.includes('token') || lowerMessage.includes('coin') || lowerMessage.includes('meme')) {
    if (lowerMessage.includes('trend') || lowerMessage.includes('next')) {
      return "Based on current market trends, meme coins with strong community engagement and unique narratives tend to perform well. Look for tokens with active social media presence, clear utility, and growing holder counts. Always DYOR (Do Your Own Research) before investing! 🚀"
    }
    if (lowerMessage.includes('analyze') || lowerMessage.includes('performance')) {
      return "To analyze token performance, consider these key metrics:\n\n• Market Cap & Liquidity\n• Trading Volume (24h)\n• Holder Distribution\n• Price Trends\n• Community Engagement\n• Development Activity\n\nWould you like me to help analyze a specific token?"
    }
    if (lowerMessage.includes('create') || lowerMessage.includes('launch')) {
      return "To create a token on POL Pump:\n\n1. Go to the main page and click 'Create Token'\n2. Upload an image (required)\n3. Enter token name, symbol, and initial supply\n4. Add description and social links\n5. The system will deploy your token on Polygon with a bonding curve\n\nYour token will be immediately tradable! 🎉"
    }
    return "I can help you with token analysis, market trends, and trading strategies on POL Pump. What would you like to know about tokens?"
  }

  // Polygon network related
  if (lowerMessage.includes('polygon') || lowerMessage.includes('matic') || lowerMessage.includes('network')) {
    if (lowerMessage.includes('benefit') || lowerMessage.includes('advantage')) {
      return "Polygon offers several advantages:\n\n✅ Low transaction fees\n✅ Fast block times\n✅ EVM compatibility\n✅ Scalability\n✅ Active developer community\n✅ Growing DeFi ecosystem\n\nPerfect for meme token trading!"
    }
    if (lowerMessage.includes('how') || lowerMessage.includes('work')) {
      return "Polygon is a Layer 2 scaling solution for Ethereum. It uses:\n\n• Proof-of-Stake consensus\n• Sidechain architecture\n• Fast and cheap transactions\n• Full EVM compatibility\n\nPOL Pump is built on Polygon for fast, low-cost trading!"
    }
    return "POL Pump runs on Polygon mainnet, providing fast transactions with low fees. What would you like to know about Polygon?"
  }

  // Trading related
  if (lowerMessage.includes('trade') || lowerMessage.includes('buy') || lowerMessage.includes('sell')) {
    return "Trading on POL Pump:\n\n• Buy tokens with MATIC\n• Sell tokens back to MATIC\n• Real-time price updates via bonding curve\n• 0.5% trading fee\n• Immediate liquidity - no waiting for DEX\n\nConnect your wallet and start trading! 💰"
  }

  // Strategy related
  if (lowerMessage.includes('strategy') || lowerMessage.includes('defi') || lowerMessage.includes('invest')) {
    return "Trading strategies on POL Pump:\n\n1. **Early Entry**: Get in early on new tokens with low market cap\n2. **Community Focus**: Look for tokens with active communities\n3. **Diversification**: Don't put all funds in one token\n4. **Risk Management**: Only invest what you can afford to lose\n5. **DYOR**: Always research before investing\n\nRemember: Trading involves risk! ⚠️"
  }

  // General greeting
  if (lowerMessage.includes('hello') || lowerMessage.includes('hi') || lowerMessage.includes('hey')) {
    return "Hello! I'm PumpAI, your POL Pump assistant. I can help you with:\n\n• Token analysis and insights\n• Trading strategies\n• Polygon network questions\n• Platform features\n• Market trends\n\nWhat would you like to know? 🤖"
  }

  // Default response
  return `I understand you're asking about "${message}". I'm PumpAI, your POL Pump assistant. I can help with:

• Token analysis and market insights
• Trading strategies and tips
• Polygon network information
• Platform features and usage
• Creating and managing tokens

Could you rephrase your question or ask about something specific I can help with? I'm here to assist with all things POL Pump! 🚀`
}

