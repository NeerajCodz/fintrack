"use client"

import { motion } from "framer-motion"
import { Loader2 } from "lucide-react"

export default function Loading() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#0a0f1a]">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shadow-2xl shadow-blue-500/30">
          <Loader2 className="h-8 w-8 text-white animate-spin" />
        </div>
        <p className="text-sm text-muted-foreground">Loading FinTrack...</p>
      </motion.div>
    </div>
  )
}
