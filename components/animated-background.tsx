"use client"

import { motion } from "framer-motion"

export function AnimatedBackground() {
  return (
    <div className="fixed inset-0 -z-10 overflow-hidden bg-background">
      {/* Large warm amber orb */}
      <motion.div
        className="absolute w-[600px] h-[600px] rounded-full bg-amber-500/10 blur-[120px]"
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

      {/* Medium warm stone orb */}
      <motion.div
        className="absolute w-[500px] h-[500px] rounded-full bg-orange-400/8 blur-[100px]"
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

      {/* Small warm accent */}
      <motion.div
        className="absolute w-[300px] h-[300px] rounded-full bg-yellow-500/6 blur-[80px]"
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

      {/* Additional warm stone accent */}
      <motion.div
        className="absolute w-[400px] h-[400px] rounded-full bg-stone-400/6 blur-[90px]"
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
          backgroundImage: `linear-gradient(hsl(30 30% 50% / 0.3) 1px, transparent 1px),
            linear-gradient(90deg, hsl(30 30% 50% / 0.3) 1px, transparent 1px)`,
          backgroundSize: '60px 60px',
        }}
      />
    </div>
  )
}
