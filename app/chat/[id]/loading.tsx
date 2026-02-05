"use client"

import { motion } from "framer-motion"
import { Loader2, MessageSquare } from "lucide-react"

export default function ChatLoading() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-background">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="w-16 h-16 rounded-2xl bg-primary flex items-center justify-center shadow-2xl">
          <MessageSquare className="h-8 w-8 text-primary-foreground" />
        </div>
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading conversation...</p>
        </div>
      </motion.div>
    </div>
  )
}
