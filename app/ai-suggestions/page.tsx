'use client'

import React, { useEffect, useState } from 'react'
import { Brain, TrendingUp, HelpCircle, Sparkles, Target, AlertTriangle, CheckCircle } from 'lucide-react'

export default function AiSuggestionsPage() {
  const [suggestions, setSuggestions] = useState<any[]>([])
  const [topics, setTopics] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const backendBase = (typeof process !== 'undefined' && (process as any).env && (process as any).env.NEXT_PUBLIC_BACKEND_URL) || 'http://localhost:4000'
        const [sugRes, topRes] = await Promise.all([
          fetch(`${backendBase}/ai-suggestions`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ suggestions: [] })),
          fetch(`${backendBase}/trending-topics`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({ topics: [] }))
        ])
        setSuggestions(sugRes?.suggestions || [])
        setTopics(topRes?.topics || [])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Loading AI insights...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl mb-6">
            <Brain className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-slate-900 mb-4">AI-Powered Token Insights</h1>
          <p className="text-xl text-slate-600 max-w-2xl mx-auto">
            Discover promising tokens and trending opportunities powered by POL Pump AI
          </p>
        </div>

        {/* AI Token Suggestions */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 mb-8">
          <div className="flex items-center mb-6">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center mr-4">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">AI Token Suggestions</h2>
          </div>

          {suggestions.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {suggestions.map((s: any, i: number) => (
                <div key={i} className="bg-gradient-to-br from-slate-50 to-white rounded-xl p-6 border border-slate-200 hover:shadow-lg transition-all duration-300">
                  <div className="flex items-start justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-900">{s.name}</h3>
                    <div className={`px-3 py-1 rounded-full text-xs font-medium ${s.risk_level === 'low' ? 'bg-green-100 text-green-700' :
                        s.risk_level === 'medium' ? 'bg-yellow-100 text-yellow-700' :
                          'bg-red-100 text-red-700'
                      }`}>
                      {s.risk_level || 'medium'} risk
                    </div>
                  </div>
                  {s.reason && (
                    <p className="text-slate-600 text-sm leading-relaxed">{s.reason}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Target className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-500">No AI suggestions available yet</p>
            </div>
          )}
        </div>

        {/* Trending Topics */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8 mb-8">
          <div className="flex items-center mb-6">
            <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center mr-4">
              <TrendingUp className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Trending Topics</h2>
          </div>

          {topics.length > 0 ? (
            <div className="flex flex-wrap gap-3">
              {topics.map((topic, i) => (
                <span
                  key={i}
                  className="px-4 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 text-slate-700 rounded-full border border-blue-200 hover:from-blue-100 hover:to-indigo-100 transition-all duration-200 cursor-pointer"
                >
                  {topic}
                </span>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <TrendingUp className="w-12 h-12 text-slate-400 mx-auto mb-4" />
              <p className="text-slate-500">No trending topics available yet</p>
            </div>
          )}
        </div>

        {/* FAQ Section */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 p-8">
          <div className="flex items-center mb-6">
            <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-xl flex items-center justify-center mr-4">
              <HelpCircle className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900">Frequently Asked Questions</h2>
          </div>

          <div className="space-y-4">
            <details className="group">
              <summary className="flex items-center justify-between p-4 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <span className="font-semibold text-slate-900">What chain and gas token does POL Pump use?</span>
                <div className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </summary>
              <div className="px-4 pb-4 text-slate-600">
                We run on the Polygon mainnet. Transactions use MATIC as gas.
              </div>
            </details>

            <details className="group">
              <summary className="flex items-center justify-between p-4 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <span className="font-semibold text-slate-900">How much gas does creating a token cost?</span>
                <div className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </summary>
              <div className="px-4 pb-4 text-slate-600">
                Typical token creation is a few hundred thousand gas. Expect cents on testnet. Trading calls add standard swap costs.
              </div>
            </details>

            <details className="group">
              <summary className="flex items-center justify-between p-4 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <span className="font-semibold text-slate-900">Where is token media stored?</span>
                <div className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </summary>
              <div className="px-4 pb-4 text-slate-600">
                Images/metadata are uploaded to decentralized storage via the official SDK. We also cache uploads for instant serving.
              </div>
            </details>

            <details className="group">
              <summary className="flex items-center justify-between p-4 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <span className="font-semibold text-slate-900">How does liquidity work?</span>
                <div className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </summary>
              <div className="px-4 pb-4 text-slate-600">
                New tokens are paired with a bonding curve contract. Prices are algorithmically set by reserves; buys add MATIC, sells remove MATIC.
              </div>
            </details>

            <details className="group">
              <summary className="flex items-center justify-between p-4 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <span className="font-semibold text-slate-900">Why do I see "no trading enabled" sometimes?</span>
                <div className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </summary>
              <div className="px-4 pb-4 text-slate-600">
                If the PairCreated event is delayed, our backend resolves it and updates the DB. Refresh in ~30s or use the Resolve Pair tool.
              </div>
            </details>

            <details className="group">
              <summary className="flex items-center justify-between p-4 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <span className="font-semibold text-slate-900">What models power AI suggestions?</span>
                <div className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </summary>
              <div className="px-4 pb-4 text-slate-600">
                AI Compute providers (e.g., deepseek-r1-70b). If a node is unavailable, we show heuristic suggestions and a static topic list.
              </div>
            </details>

            <details className="group">
              <summary className="flex items-center justify-between p-4 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <span className="font-semibold text-slate-900">How is my data cached?</span>
                <div className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </summary>
              <div className="px-4 pb-4 text-slate-600">
                Server-side in-memory caching (5 min TTL) for suggestions/topics; coins are stored in SQLite with a small cache layer.
              </div>
            </details>

            <details className="group">
              <summary className="flex items-center justify-between p-4 bg-slate-50 rounded-xl cursor-pointer hover:bg-slate-100 transition-colors">
                <span className="font-semibold text-slate-900">Where can I report issues?</span>
                <div className="w-5 h-5 text-slate-400 group-open:rotate-180 transition-transform">
                  <svg viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </div>
              </summary>
              <div className="px-4 pb-4 text-slate-600">
                Use the Support section or open an issue on the GitHub repo. Include the token symbol/tx hash and a screenshot.
              </div>
            </details>
          </div>
        </div>
      </div>
    </div>
  )
}


