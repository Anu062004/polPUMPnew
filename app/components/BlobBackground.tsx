'use client'

import React, { useState, useEffect } from 'react'

export default function BlobBackground() {
  const [particles, setParticles] = useState<Array<{ left: string; delay: string; duration: string }>>([])

  useEffect(() => {
    // Generate particles only on client side to avoid hydration mismatch
    const generatedParticles = Array.from({ length: 30 }).map(() => ({
      left: `${Math.random() * 100}%`,
      delay: `${Math.random() * 15}s`,
      duration: `${15 + Math.random() * 10}s`,
    }))
    setParticles(generatedParticles)
  }, [])

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




















