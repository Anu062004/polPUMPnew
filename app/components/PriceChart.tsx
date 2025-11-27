'use client'

import React from 'react'
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, Area, AreaChart } from 'recharts'

export interface PricePoint {
  timestamp: number
  priceUsd: number
}

interface PriceChartProps {
  data: PricePoint[]
  compact?: boolean
}

export default function PriceChart({ data, compact = false }: PriceChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className="w-full h-32 flex items-center justify-center bg-black/20 rounded-lg">
        <p className="text-sm text-gray-400">No price data yet</p>
      </div>
    )
  }

  // Format data for chart
  const chartData = data.map(point => ({
    time: new Date(point.timestamp).toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit' 
    }),
    price: point.priceUsd,
    timestamp: point.timestamp
  }))

  // Calculate min/max for Y axis
  const prices = data.map(p => p.priceUsd)
  const minPrice = Math.min(...prices) * 0.99
  const maxPrice = Math.max(...prices) * 1.01

  const formatPrice = (value: number) => {
    if (value < 0.0001) return value.toFixed(8)
    if (value < 0.01) return value.toFixed(6)
    if (value < 1) return value.toFixed(4)
    return value.toFixed(2)
  }

  return (
    <div className={`w-full ${compact ? 'h-32' : 'h-48'} bg-black/20 rounded-lg p-2`}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <defs>
            <linearGradient id="priceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#8C52FF" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="#8C52FF" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="time" 
            tick={{ fill: '#9CA3AF', fontSize: 10 }}
            axisLine={{ stroke: '#374151' }}
            tickLine={{ stroke: '#374151' }}
          />
          <YAxis 
            domain={[minPrice, maxPrice]}
            tick={{ fill: '#9CA3AF', fontSize: 10 }}
            axisLine={{ stroke: '#374151' }}
            tickLine={{ stroke: '#374151' }}
            tickFormatter={formatPrice}
            width={60}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#1F2937',
              border: '1px solid #374151',
              borderRadius: '8px',
              color: '#F3F4F6'
            }}
            formatter={(value: number) => [`$${formatPrice(value)}`, 'Price']}
            labelStyle={{ color: '#9CA3AF' }}
          />
          <Area
            type="monotone"
            dataKey="price"
            stroke="#8C52FF"
            strokeWidth={2}
            fill="url(#priceGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

