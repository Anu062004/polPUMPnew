'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Rocket } from 'lucide-react'

export default function RocketLaunchAnimation() {
  const [showAnimation, setShowAnimation] = useState(false)
  const [hasPlayed, setHasPlayed] = useState(false)

  useEffect(() => {
    // Check if animation has already played in this session
    const animationPlayed = sessionStorage.getItem('rocketAnimationPlayed')
    
    if (!animationPlayed) {
      setShowAnimation(true)
      sessionStorage.setItem('rocketAnimationPlayed', 'true')
      
      // Hide animation after it completes
      setTimeout(() => {
        setShowAnimation(false)
        setHasPlayed(true)
      }, 4500) // Total animation duration
    } else {
      setHasPlayed(true)
    }
  }, [])

  if (hasPlayed && !showAnimation) return null

  return (
    <AnimatePresence>
      {showAnimation && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-gradient-to-br from-[#1a0b2e] via-[#16213e] to-[#0f3460] overflow-hidden"
        >
          {/* Animated Stars Background */}
          <div className="absolute inset-0">
            {[...Array(50)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-1 h-1 bg-white rounded-full"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                }}
                animate={{
                  opacity: [0, 1, 0],
                  scale: [0, 1, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: Math.random() * 2,
                }}
              />
            ))}
          </div>

          {/* Rocket */}
          <motion.div
            className="absolute"
            initial={{ bottom: -100, left: '50%', x: '-50%', rotate: 0 }}
            animate={{
              bottom: ['0%', '50%', '120%'],
              left: ['50%', '50%', '50%'],
              rotate: [0, 0, -15],
            }}
            transition={{
              duration: 3,
              times: [0, 0.5, 1],
              ease: 'easeInOut',
            }}
          >
            {/* Rocket Body */}
            <div className="relative">
              {/* Rocket Icon with Glow */}
              <motion.div
                className="relative z-10"
                animate={{
                  scale: [1, 1.1, 1],
                }}
                transition={{
                  duration: 0.5,
                  repeat: Infinity,
                }}
              >
                <div className="w-20 h-20 bg-gradient-to-r from-[#FF4F84] to-[#8C52FF] rounded-full flex items-center justify-center shadow-2xl">
                  <Rocket className="w-10 h-10 text-white" style={{ transform: 'rotate(45deg)' }} />
                </div>
                
                {/* Glow Effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#FF4F84] to-[#8C52FF] rounded-full blur-xl opacity-60 animate-pulse" />
              </motion.div>

              {/* Rocket Trail */}
              <motion.div
                className="absolute top-full left-1/2 -translate-x-1/2 w-2"
                initial={{ height: 0 }}
                animate={{ height: 200 }}
                transition={{ duration: 2, ease: 'easeOut' }}
              >
                <div className="w-full h-full bg-gradient-to-b from-[#FF4F84] via-[#8C52FF] to-transparent opacity-70 blur-sm" />
              </motion.div>

              {/* Particle Effects */}
              {[...Array(20)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 bg-gradient-to-r from-[#FF4F84] to-[#8C52FF] rounded-full"
                  style={{
                    left: '50%',
                    top: '100%',
                  }}
                  animate={{
                    y: [0, Math.random() * 100 + 50],
                    x: [(Math.random() - 0.5) * 20, (Math.random() - 0.5) * 100],
                    opacity: [1, 0],
                    scale: [1, 0],
                  }}
                  transition={{
                    duration: 1 + Math.random(),
                    repeat: Infinity,
                    delay: Math.random() * 0.5,
                  }}
                />
              ))}
            </div>
          </motion.div>

          {/* POL PUMP Text Animation */}
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.5, duration: 0.5 }}
          >
            <div className="text-center">
              {/* POL */}
              <motion.div
                className="text-8xl font-bold mb-2"
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.8, duration: 0.6, ease: 'easeOut' }}
              >
                <span className="text-white">POL</span>
              </motion.div>

              {/* PUMP */}
              <motion.div
                className="text-8xl font-bold"
                initial={{ opacity: 0, y: 50 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 2.2, duration: 0.6, ease: 'easeOut' }}
              >
                <span className="text-gradient-primary">PUMP</span>
              </motion.div>

              {/* Sparkle Effects */}
              {[...Array(8)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-3 h-3 bg-white rounded-full"
                  style={{
                    left: `${20 + Math.random() * 60}%`,
                    top: `${20 + Math.random() * 60}%`,
                  }}
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{
                    scale: [0, 1, 0],
                    opacity: [0, 1, 0],
                  }}
                  transition={{
                    delay: 2 + i * 0.1,
                    duration: 1,
                  }}
                />
              ))}
            </div>
          </motion.div>

          {/* Tagline */}
          <motion.div
            className="absolute bottom-20 left-1/2 -translate-x-1/2 text-center"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 3, duration: 0.5 }}
          >
            <p className="text-xl text-[#E3E4E8] font-medium">
              The Future of Token Creation 🚀
            </p>
          </motion.div>

          {/* Loading Bar */}
          <motion.div
            className="absolute bottom-10 left-1/2 -translate-x-1/2 w-64 h-1 bg-white/20 rounded-full overflow-hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 3.5 }}
          >
            <motion.div
              className="h-full bg-gradient-to-r from-[#FF4F84] to-[#8C52FF]"
              initial={{ width: '0%' }}
              animate={{ width: '100%' }}
              transition={{ delay: 3.5, duration: 0.8, ease: 'easeInOut' }}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
