"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { ChatInterface } from "@/components/chat-interface"
import { DashboardPanel } from "@/components/dashboard-panel"
import { AnimatedBackground } from "@/components/animated-background"
import { Button } from "@/components/ui/button"
import { LogOut, Menu, X, LayoutDashboard, MessageSquare, Wallet, Sparkles } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface FinancialAppProps {
  userEmail: string
}

export function FinancialApp({ userEmail }: FinancialAppProps) {
  const [showDashboard, setShowDashboard] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  return (
    <div className="h-screen flex flex-col relative">
      <AnimatedBackground />
      
      {/* Header */}
      <motion.header 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="glass-strong border-b border-white/10 px-4 py-3 flex items-center justify-between z-10"
      >
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.05, rotate: 5 }}
            className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center"
          >
            <Wallet className="h-5 w-5 text-white" />
          </motion.div>
          <div>
            <h1 className="text-lg font-bold gradient-text flex items-center gap-2">
              FinTrack
              <Sparkles className="h-4 w-4 text-emerald-400" />
            </h1>
          </div>
          <span className="hidden sm:inline text-xs text-muted-foreground glass px-2 py-1 rounded-full">
            {userEmail}
          </span>
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-2">
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              variant={showDashboard ? "default" : "outline"}
              size="sm"
              onClick={() => setShowDashboard(true)}
              className={showDashboard 
                ? "bg-gradient-to-r from-blue-500 to-emerald-500 text-white border-0" 
                : "glass border-white/10 hover:bg-white/5"
              }
            >
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              variant={!showDashboard ? "default" : "outline"}
              size="sm"
              onClick={() => setShowDashboard(false)}
              className={!showDashboard 
                ? "bg-gradient-to-r from-blue-500 to-emerald-500 text-white border-0" 
                : "glass border-white/10 hover:bg-white/5"
              }
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
            </Button>
          </motion.div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleSignOut}
              className="text-muted-foreground hover:text-foreground hover:bg-white/5"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          </motion.div>
        </div>

        {/* Mobile menu button */}
        <motion.div whileTap={{ scale: 0.9 }}>
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden glass"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
            <span className="sr-only">Toggle menu</span>
          </Button>
        </motion.div>
      </motion.header>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden glass-strong border-b border-white/10 p-4 space-y-2 z-10"
          >
            <p className="text-xs text-muted-foreground mb-3 px-2">{userEmail}</p>
            <Button
              variant={showDashboard ? "default" : "outline"}
              size="sm"
              className={`w-full justify-start ${showDashboard 
                ? "bg-gradient-to-r from-blue-500 to-emerald-500 text-white border-0" 
                : "glass border-white/10"
              }`}
              onClick={() => {
                setShowDashboard(true)
                setMobileMenuOpen(false)
              }}
            >
              <LayoutDashboard className="h-4 w-4 mr-2" />
              Dashboard
            </Button>
            <Button
              variant={!showDashboard ? "default" : "outline"}
              size="sm"
              className={`w-full justify-start ${!showDashboard 
                ? "bg-gradient-to-r from-blue-500 to-emerald-500 text-white border-0" 
                : "glass border-white/10"
              }`}
              onClick={() => {
                setShowDashboard(false)
                setMobileMenuOpen(false)
              }}
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Chat
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start text-muted-foreground hover:text-foreground"
              onClick={handleSignOut}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign out
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Desktop: Split view */}
        <div className="hidden lg:flex flex-1">
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex-1 border-r border-white/5 glass"
          >
            <ChatInterface />
          </motion.div>
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
            className="w-80 xl:w-96 overflow-hidden glass"
          >
            <DashboardPanel />
          </motion.div>
        </div>

        {/* Mobile/Tablet: Tab view */}
        <div className="lg:hidden flex-1 overflow-hidden glass">
          <AnimatePresence mode="wait">
            {showDashboard ? (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                <DashboardPanel />
              </motion.div>
            ) : (
              <motion.div
                key="chat"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                <ChatInterface />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}
