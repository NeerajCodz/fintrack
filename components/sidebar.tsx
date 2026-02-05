"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Plus,
  MessageSquare,
  Trash2,
  LogOut,
  Wallet,
  Sparkles,
  Users,
  Bell,
} from "lucide-react"
import { motion } from "framer-motion"

interface Conversation {
  id: string
  title: string
  created_at: string
  updated_at: string
}

interface SidebarProps {
  conversations: Conversation[]
  activeConversationId: string | null
  onNewChat: () => void
  onSelectConversation: (id: string) => void
  onDeleteConversation: (id: string) => void
  onOpenContacts: () => void
  onOpenReminders: () => void
  onSignOut: () => void
  userEmail: string
  isLoading: boolean
}

export function Sidebar({
  conversations,
  activeConversationId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onOpenContacts,
  onOpenReminders,
  onSignOut,
  userEmail,
  isLoading,
}: SidebarProps) {
  // Badge counts for reminders
  const [reminderBadges, setReminderBadges] = useState({ upcoming: 0, overdue: 0 })

  useEffect(() => {
    async function fetchBadges() {
      try {
        const res = await fetch("/api/reminders/payments")
        if (res.ok) {
          const data = await res.json()
          const payments = data.payments || []
          
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          
          let overdue = 0
          let upcoming = 0
          
          payments.forEach((p: { status: string; due_date: string; paid_date: string | null }) => {
            if (p.status === "pending") {
              const dueDate = new Date(p.due_date)
              dueDate.setHours(0, 0, 0, 0)
              if (dueDate < today) {
                overdue++
              } else {
                upcoming++
              }
            }
          })
          
          setReminderBadges({ upcoming, overdue })
        }
      } catch {
        // Silently fail
      }
    }
    
    fetchBadges()
    const interval = setInterval(fetchBadges, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [])
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (days === 0) return "Today"
    if (days === 1) return "Yesterday"
    if (days < 7) return `${days} days ago`
    return date.toLocaleDateString()
  }

  // Group conversations by date
  const groupedConversations = conversations.reduce(
    (groups, conv) => {
      const dateKey = formatDate(conv.updated_at)
      if (!groups[dateKey]) groups[dateKey] = []
      groups[dateKey].push(conv)
      return groups
    },
    {} as Record<string, Conversation[]>
  )

  return (
    <div className="w-[280px] h-full bg-card border-r border-border flex flex-col">
      {/* Logo */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <motion.div
            whileHover={{ scale: 1.05, rotate: 5 }}
            className="w-10 h-10 rounded-xl bg-foreground flex items-center justify-center shadow-sm"
          >
            <Wallet className="h-5 w-5 text-background" />
          </motion.div>
          <div>
            <h1 className="text-lg font-bold flex items-center gap-2">
              fin.
            </h1>
            <p className="text-xs text-muted-foreground">financial copilot</p>
          </div>
        </div>
      </div>

      {/* New Chat Button */}
      <div className="p-3 space-y-2">
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button
            onClick={onNewChat}
            className="w-full justify-start gap-2 bg-foreground text-background hover:bg-foreground/90"
          >
            <Plus className="h-4 w-4" />
            New Chat
          </Button>
        </motion.div>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button
            onClick={onOpenContacts}
            variant="ghost"
            className="w-full justify-start gap-2 hover:bg-muted text-muted-foreground hover:text-foreground"
          >
            <Users className="h-4 w-4" />
            Contacts
          </Button>
        </motion.div>
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Button
            onClick={onOpenReminders}
            variant="ghost"
            className="w-full justify-start gap-2 hover:bg-muted text-muted-foreground hover:text-foreground relative"
          >
            <Bell className="h-4 w-4" />
            Reminders
            {/* Badge for overdue (red) only */}
            {reminderBadges.overdue > 0 && (
              <span
                className="absolute right-2 top-1/2 -translate-y-1/2 min-w-5 h-5 px-1.5 rounded-full text-xs font-bold flex items-center justify-center bg-destructive text-destructive-foreground"
              >
                {reminderBadges.overdue}
              </span>
            )}
          </Button>
        </motion.div>
      </div>

      {/* Conversations List */}
      <ScrollArea className="flex-1 px-3">
        {isLoading ? (
          <div className="space-y-2 py-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-12 rounded-lg bg-muted animate-pulse"
              />
            ))}
          </div>
        ) : Object.keys(groupedConversations).length === 0 ? (
          <div className="py-8 text-center">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No conversations yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Start tracking your finances
            </p>
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {Object.entries(groupedConversations).map(([date, convs]) => (
              <div key={date}>
                <p className="text-xs text-muted-foreground/70 px-2 mb-2 font-medium">
                  {date}
                </p>
                <div className="space-y-1">
                  {convs.map((conv) => (
                    <motion.div
                      key={conv.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="group relative"
                    >
                      <Button
                        variant="ghost"
                        onClick={() => onSelectConversation(conv.id)}
                        className={`w-full justify-start text-left h-auto py-3 px-3 ${
                          activeConversationId === conv.id
                            ? "bg-muted border border-border"
                            : "hover:bg-muted/50"
                        }`}
                      >
                        <MessageSquare className="h-4 w-4 mr-2 shrink-0 text-muted-foreground" />
                        <span className="truncate text-sm">{conv.title}</span>
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation()
                          onDeleteConversation(conv.id)
                        }}
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* User Section */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-2 px-2 py-2 mb-2">
          <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center text-background text-sm font-medium">
            {userEmail.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm text-muted-foreground truncate flex-1">
            {userEmail}
          </span>
        </div>
        <Button
          variant="ghost"
          onClick={onSignOut}
          className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground hover:bg-muted"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </Button>
      </div>
    </div>
  )
}
