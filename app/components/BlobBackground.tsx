'use client'

import React, { useMemo } from 'react'

export default function BlobBackground() {
  const particles = useMemo<Array<{ left: string; delay: string; duration: string }>>(
    () =>
      Array.from({ length: 30 }, (_, index) => {
        // Deterministic values avoid client re-renders from effect-driven state updates.
        const left = (index * 37.137) % 100
        const delay = (index * 1.73) % 15
        const duration = 15 + ((index * 2.11) % 10)
        return {
          left: `${left.toFixed(2)}%`,
          delay: `${delay.toFixed(2)}s`,
          duration: `${duration.toFixed(2)}s`,
        }
      }),
    []
  )

  return (
    <>
      {/* Blob Layer */}
      <div className="blob-bg">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      {/* Particle Layer */}
      <div className="particle-layer">
        {particles.map((particle, i) => (
          <div
            key={i}
            className="particle"
            style={{
              left: particle.left,
              animationDelay: particle.delay,
              animationDuration: particle.duration,
            }}
          />
        ))}
      </div>
    </>
  )
}




















