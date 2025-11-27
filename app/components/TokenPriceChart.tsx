'use client'

import React, { useEffect, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from 'recharts'

interface TokenPriceChartProps {
  tokenAddress: string
  tokenSymbol?: string
}

interface PricePoint {
  time: string
  price: number
}

export default function TokenPriceChart({
  tokenAddress,
  tokenSymbol
}: TokenPriceChartProps) {
  const [data, setData] = useState<PricePoint[]>([])
  const [comment, setComment] = useState<string>('')
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const loadData = async () => {
    if (!tokenAddress) return
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/token-price/${tokenAddress}`, {
        cache: 'no-store'
      })
      if (!res.ok) {
        throw new Error('Failed to load price data')
      }
      const json = (await res.json()) as PricePoint[]
      setData(json || [])

      // Request simple AI-style commentary
      try {
        const commentRes = await fetch('/api/pump-ai/chart-comment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tokenAddress,
            data: json
          })
        })
        if (commentRes.ok) {
          const { comment } = await commentRes.json()
          setComment(comment)
        }
      } catch (e) {
        // Commentary is optional
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load price data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    const id = setInterval(loadData, 10000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenAddress])

  const chartTitle = tokenSymbol
    ? `Live Price for ${tokenSymbol}`
    : 'Live Token Price'

  return (
    <div className="mt-6 rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{chartTitle}</h3>
        {isLoading && (
          <span className="text-xs text-gray-400">Updating…</span>
        )}
      </div>

      {error && (
        <div className="text-xs text-red-400 mb-2">{error}</div>
      )}

      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
            <XAxis
              dataKey="time"
              tickFormatter={value =>
                new Date(value).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })
              }
              stroke="#9ca3af"
              tick={{ fontSize: 10 }}
            />
            <YAxis
              dataKey="price"
              stroke="#9ca3af"
              tick={{ fontSize: 10 }}
              domain={['auto', 'auto']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#020617',
                borderColor: '#4b5563',
                fontSize: 12
              }}
              labelFormatter={label =>
                new Date(label).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit'
                })
              }
            />
            <Line
              type="monotone"
              dataKey="price"
              stroke="#f97316"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {comment && (
        <div className="mt-3 rounded-lg bg-black/40 p-3 text-xs text-gray-200">
          <span className="font-semibold text-orange-300">PumpAI:</span>{' '}
          {comment}
        </div>
      )}
    </div>
  )
}






