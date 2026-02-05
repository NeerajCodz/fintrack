"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { AnimatedBackground } from "@/components/animated-background"
import { ChatView } from "@/components/chat-view"
import { Sidebar } from "@/components/sidebar"
import { ContactsManager } from "@/components/contacts-manager"
import type { Person } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Menu, X } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
}

interface FinancialAppProps {
  userEmail: string
  initialConversationId?: string
}

export function FinancialApp({ userEmail, initialConversationId }: FinancialAppProps) {
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConversationId, setActiveConversationId] = useState<string | null>(initialConversationId || null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [contactsOpen, setContactsOpen] = useState(false)
  const [pendingChatPerson, setPendingChatPerson] = useState<Person | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  const fetchConversations = useCallback(async () => {
    const response = await fetch("/api/conversations")
    if (response.ok) {
      const data = await response.json()
      setConversations(data.conversations || [])
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  async function handleNewChat() {
    // Just reset to home view - conversation will be created on first message
    setActiveConversationId(null)
    setSidebarOpen(false)
    router.push("/")
  }

  async function handleSelectConversation(id: string) {
    setActiveConversationId(id)
    setSidebarOpen(false)
    router.push(`/chat/${id}`)
  }

  async function handleDeleteConversation(id: string) {
    await fetch("/api/conversations", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: id }),
    })
    
    if (activeConversationId === id) {
      setActiveConversationId(null)
    }
    
    fetchConversations()
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  async function handleConversationCreated(id: string, title: string) {
    setActiveConversationId(id)
    fetchConversations()
    router.push(`/chat/${id}`)
  }

  function handleChatWithPerson(person: Person) {
    // Close contacts modal and start a new chat focused on this person
    setContactsOpen(false)
    setPendingChatPerson(person)
    setActiveConversationId(null) // Start fresh conversation
  }

  return (
    <div className="h-screen flex relative overflow-hidden">
      <AnimatedBackground />
      
      {/* Desktop Sidebar */}
      <div className="hidden md:flex">
        <Sidebar
          conversations={conversations}
          activeConversationId={activeConversationId}
          onNewChat={handleNewChat}
          onSelectConversation={handleSelectConversation}
          onDeleteConversation={handleDeleteConversation}
          onOpenContacts={() => setContactsOpen(true)}
          onSignOut={handleSignOut}
          userEmail={userEmail}
          isLoading={isLoading}
        />
      </div>

      {/* Mobile Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
              onClick={() => setSidebarOpen(false)}
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed inset-y-0 left-0 z-50 md:hidden"
            >
              <Sidebar
                conversations={conversations}
                activeConversationId={activeConversationId}
                onNewChat={handleNewChat}
                onSelectConversation={handleSelectConversation}
                onDeleteConversation={handleDeleteConversation}
                onOpenContacts={() => {
                  setContactsOpen(true)
                  setSidebarOpen(false)
                }}
                onSignOut={handleSignOut}
                userEmail={userEmail}
                isLoading={isLoading}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="md:hidden glass-strong border-b border-white/10 px-4 py-3 flex items-center gap-3 z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(true)}
            className="hover:bg-white/10"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold gradient-text">FinTrack AI</h1>
        </header>

        {/* Chat View */}
        <ChatView
          conversationId={activeConversationId}
          onConversationCreated={handleConversationCreated}
          pendingChatPerson={pendingChatPerson}
          onClearPendingPerson={() => setPendingChatPerson(null)}
        />
      </div>

      {/* Contacts Manager Modal */}
      <ContactsManager
        isOpen={contactsOpen}
        onClose={() => setContactsOpen(false)}
        onChatWithPerson={handleChatWithPerson}
      />
    </div>
  )
}
