"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { ChatInterface } from "@/components/chat-interface"
import { DashboardPanel } from "@/components/dashboard-panel"
import { Button } from "@/components/ui/button"
import { LogOut, Menu, X, LayoutDashboard, MessageSquare } from "lucide-react"

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
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border px-4 py-3 flex items-center justify-between bg-card">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold text-foreground">
            Financial Tracker
          </h1>
          <span className="hidden sm:inline text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
            {userEmail}
          </span>
        </div>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center gap-2">
          <Button
            variant={showDashboard ? "default" : "outline"}
            size="sm"
            onClick={() => setShowDashboard(true)}
          >
            <LayoutDashboard className="h-4 w-4 mr-2" />
            Dashboard
          </Button>
          <Button
            variant={!showDashboard ? "default" : "outline"}
            size="sm"
            onClick={() => setShowDashboard(false)}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Chat
          </Button>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </Button>
        </div>

        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <Menu className="h-5 w-5" />
          )}
          <span className="sr-only">Toggle menu</span>
        </Button>
      </header>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border bg-card p-4 space-y-2">
          <p className="text-xs text-muted-foreground mb-2">{userEmail}</p>
          <Button
            variant={showDashboard ? "default" : "outline"}
            size="sm"
            className="w-full justify-start"
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
            className="w-full justify-start"
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
            className="w-full justify-start"
            onClick={handleSignOut}
          >
            <LogOut className="h-4 w-4 mr-2" />
            Sign out
          </Button>
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 flex overflow-hidden">
        {/* Desktop: Split view */}
        <div className="hidden lg:flex flex-1">
          <div className="flex-1 border-r border-border">
            <ChatInterface />
          </div>
          <div className="w-80 xl:w-96 overflow-hidden">
            <DashboardPanel />
          </div>
        </div>

        {/* Mobile/Tablet: Tab view */}
        <div className="lg:hidden flex-1 overflow-hidden">
          {showDashboard ? <DashboardPanel /> : <ChatInterface />}
        </div>
      </main>
    </div>
  )
}
