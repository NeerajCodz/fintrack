"use client"

import { motion } from "framer-motion"
import { Loader2 } from "lucide-react"

export default function Loading() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="w-16 h-16 rounded-2xl bg-foreground flex items-center justify-center shadow-sm">
          <Loader2 className="h-8 w-8 text-background animate-spin" />
        </div>
        <p className="text-sm text-muted-foreground">Loading fin...</p>
      </motion.div>
    </div>
  )
}
