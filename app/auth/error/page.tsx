"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AnimatedBackground } from "@/components/animated-background"
import { motion } from "framer-motion"
import { AlertTriangle, ArrowLeft } from "lucide-react"

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <AnimatedBackground />
      
      <motion.div
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md"
      >
        <div className="glass-strong rounded-2xl p-8 text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            className="w-16 h-16 rounded-2xl bg-destructive/20 border border-destructive/30 flex items-center justify-center mx-auto mb-6"
          >
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </motion.div>
          
          <motion.div 
            className="space-y-2 mb-6"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <h1 className="text-2xl font-bold text-foreground">
              Authentication Error
            </h1>
            <p className="text-sm text-muted-foreground">
              Something went wrong during authentication. Please try again.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Button 
              asChild 
              className="w-full h-11 bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 text-white"
            >
              <Link href="/auth/login" className="flex items-center justify-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to login
              </Link>
            </Button>
          </motion.div>
        </div>
      </motion.div>
    </div>
  )
}
