"use client"

import { motion } from "framer-motion"

export function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-background">
      {/* Large blue orb */}
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full bg-blue-500/20 blur-[120px]"
        initial={{ x: -300, y: -200 }}
        animate={{
          x: [-300, 100, -200, -300],
          y: [-200, 100, 300, -200],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Medium emerald orb */}
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full bg-emerald-500/15 blur-[100px]"
        initial={{ x: "60vw", y: "20vh" }}
        animate={{
          x: ["60vw", "30vw", "70vw", "60vw"],
          y: ["20vh", "60vh", "30vh", "20vh"],
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Small blue accent */}
      <motion.div
        className="absolute w-[300px] h-[300px] rounded-full bg-blue-400/10 blur-[80px]"
        initial={{ x: "80vw", y: "70vh" }}
        animate={{
          x: ["80vw", "50vw", "20vw", "80vw"],
          y: ["70vh", "40vh", "80vh", "70vh"],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Additional emerald accent */}
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full bg-emerald-400/10 blur-[90px]"
        initial={{ x: "10vw", y: "80vh" }}
        animate={{
          x: ["10vw", "40vw", "5vw", "10vw"],
          y: ["80vh", "50vh", "60vh", "80vh"],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Subtle grid overlay */}
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(hsl(217 91% 60% / 0.3) 1px, transparent 1px),
            linear-gradient(90deg, hsl(217 91% 60% / 0.3) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />
    </div>
  )
}
