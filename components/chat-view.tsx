"use client"

import React from "react"
import { useState, useRef, useEffect, useCallback } from "react"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Send,
  Bot,
  User,
  Wallet,
  TrendingUp,
  TrendingDown,
  Receipt,
  AlertCircle,
  Loader2,
  AtSign,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import type { Person } from "@/lib/types"

interface ChatViewProps {
  conversationId: string | null
  onConversationCreated: (id: string, title: string) => void
  pendingChatPerson?: Person | null
  onClearPendingPerson?: () => void
}

interface DashboardStats {
  totalSpentThisMonth: number
  topCategory: { category: string; total: number } | null
  outstandingDues: {
    youOwe: { person: string; amount: number }[]
    owedToYou: { person: string; amount: number }[]
  }
  upcomingBills: { name: string; amount: number; due_date: string }[]
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount)
}

// Helper to extract text from UIMessage parts or content
function getMessageText(message: { 
  parts?: Array<{ type: string; text?: string; result?: unknown }>
  content?: string 
}): string {
  if (message.parts && Array.isArray(message.parts)) {
    const textParts: string[] = []
    
    for (const p of message.parts) {
      if (p.type === "text" && typeof p.text === "string") {
        textParts.push(p.text)
      }
      // Also handle tool-result parts that might contain the response message
      if (p.type === "tool-result" && p.result && typeof p.result === "object") {
        const result = p.result as { message?: string; success?: boolean }
        if (result.message) {
          textParts.push(result.message)
        }
      }
    }
    
    if (textParts.length > 0) return textParts.join("\n")
  }
  if (typeof message.content === "string") {
    return message.content
  }
  return ""
}

// Render message with @mentions highlighted
function renderMessageWithMentions(content: string): React.ReactNode {
  const mentionRegex = /@(\w+(?:\s+\w+)?)/g
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let match

  while ((match = mentionRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push(content.slice(lastIndex, match.index))
    }
    parts.push(
      <span
        key={match.index}
        className="inline-flex items-center px-1.5 py-0.5 rounded bg-purple-500/30 text-purple-300 font-medium"
      >
        @{match[1]}
      </span>
    )
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < content.length) {
    parts.push(content.slice(lastIndex))
  }

  return parts.length > 0 ? parts : content
}

export function ChatView({ conversationId, onConversationCreated, pendingChatPerson, onClearPendingPerson }: ChatViewProps) {
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(conversationId)
  const [input, setInput] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const conversationIdRef = useRef<string | null>(currentConversationId)
  
  // @mention state
  const [people, setPeople] = useState<Person[]>([])
  const [showMentions, setShowMentions] = useState(false)
  const [mentionSearch, setMentionSearch] = useState("")
  const [mentionIndex, setMentionIndex] = useState(0)
  const [cursorPosition, setCursorPosition] = useState(0)

  useEffect(() => {
    conversationIdRef.current = currentConversationId
  }, [currentConversationId])

  // Fetch people for @mentions
  useEffect(() => {
    async function fetchPeople() {
      try {
        const res = await fetch("/api/people")
        if (res.ok) {
          const data = await res.json()
          setPeople(data.people || [])
        }
      } catch {
        // Silently fail
      }
    }
    fetchPeople()
  }, [])

  // Use the AI SDK useChat hook with DefaultChatTransport
  const { messages, status, sendMessage, setMessages, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages: chatMessages }) => ({
        body: {
          messages: chatMessages,
          conversationId: conversationIdRef.current,
        },
      }),
    }),
    onError: (err) => {
      console.log("[v0] useChat error:", err)
    },
  })

  const isLoading = status === "streaming" || status === "submitted"

  useEffect(() => {
    setCurrentConversationId(conversationId)
    conversationIdRef.current = conversationId
  }, [conversationId])

  useEffect(() => {
    if (conversationId === null) {
      setMessages([])
      setCurrentConversationId(null)
      conversationIdRef.current = null
    } else if (conversationId !== currentConversationId) {
      loadConversationMessages(conversationId)
    }
  }, [conversationId, currentConversationId, setMessages])

  const loadConversationMessages = useCallback(async (convId: string) => {
    try {
      const response = await fetch(`/api/conversations/${convId}/messages`)
      if (response.ok) {
        const data = await response.json()
        const uiMessages = (data.messages || []).map((m: { id: string; role: string; content: string }) => ({
          id: m.id,
          role: m.role as "user" | "assistant",
          parts: [{ type: "text" as const, text: m.content }],
        }))
        setMessages(uiMessages)
        setCurrentConversationId(convId)
        conversationIdRef.current = convId
      }
    } catch {
      // Silently fail
    }
  }, [setMessages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  // Handle pending chat with person from contacts
  useEffect(() => {
    if (pendingChatPerson && !conversationId) {
      // Pre-fill input with the person's name mentioned
      setInput(`@${pendingChatPerson.name} `)
      onClearPendingPerson?.()
      // Focus the textarea
      setTimeout(() => {
        textareaRef.current?.focus()
      }, 100)
    }
  }, [pendingChatPerson, conversationId, onClearPendingPerson])

  // Handle @mention detection
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    const position = e.target.selectionStart || 0
    setInput(value)
    setCursorPosition(position)

    // Check for @ trigger
    const textBeforeCursor = value.slice(0, position)
    const atMatch = textBeforeCursor.match(/@(\w*)$/)

    if (atMatch) {
      setShowMentions(true)
      setMentionSearch(atMatch[1].toLowerCase())
      setMentionIndex(0)
    } else {
      setShowMentions(false)
      setMentionSearch("")
    }
  }

  // Filter people based on search
  const filteredPeople = people.filter((p) =>
    p.name.toLowerCase().includes(mentionSearch)
  )

  // Insert mention
  const insertMention = (person: Person) => {
    const textBeforeCursor = input.slice(0, cursorPosition)
    const textAfterCursor = input.slice(cursorPosition)
    
    // Find the @ position
    const atMatch = textBeforeCursor.match(/@(\w*)$/)
    if (atMatch) {
      const atPosition = textBeforeCursor.lastIndexOf("@")
      const newText = 
        input.slice(0, atPosition) + 
        `@${person.name} ` + 
        textAfterCursor
      
      setInput(newText)
      setShowMentions(false)
      setMentionSearch("")
      
      // Focus back on textarea
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus()
          const newPosition = atPosition + person.name.length + 2
          textareaRef.current.setSelectionRange(newPosition, newPosition)
        }
      }, 0)
    }
  }

  // Handle keyboard navigation in mentions
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions && filteredPeople.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setMentionIndex((prev) => (prev + 1) % filteredPeople.length)
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setMentionIndex((prev) => (prev - 1 + filteredPeople.length) % filteredPeople.length)
      } else if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault()
        insertMention(filteredPeople[mentionIndex])
        return
      } else if (e.key === "Escape") {
        e.preventDefault()
        setShowMentions(false)
      }
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  async function handleSubmit(e: React.FormEvent | React.KeyboardEvent) {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const messageText = input.trim()
    setInput("")
    setShowMentions(false)

    let convId = currentConversationId

    // Create conversation if needed
    if (!convId) {
      try {
        const createRes = await fetch("/api/conversations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: messageText.slice(0, 50) }),
        })
        if (createRes.ok) {
          const data = await createRes.json()
          convId = data.conversation.id
          conversationIdRef.current = convId
          setCurrentConversationId(convId)
          onConversationCreated(data.conversation.id, data.conversation.title)
        }
      } catch {
        // Continue anyway
      }
    }

    sendMessage({ text: messageText })
  }

  function handleQuickPrompt(prompt: string) {
    setInput(prompt)
    textareaRef.current?.focus()
  }

  const showWelcome = messages.length === 0 && !conversationId

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        {showWelcome ? (
          <WelcomeScreen onQuickPrompt={handleQuickPrompt} people={people} />
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
            <AnimatePresence mode="popLayout">
              {messages.map((message) => {
                const content = getMessageText(message)
                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`flex gap-4 ${message.role === "user" ? "flex-row-reverse" : ""}`}
                  >
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center shadow-lg ${
                        message.role === "user"
                          ? "bg-gradient-to-br from-blue-500 to-blue-600 shadow-blue-500/20"
                          : "bg-gradient-to-br from-emerald-500 to-emerald-600 shadow-emerald-500/20"
                      }`}
                    >
                      {message.role === "user" ? (
                        <User className="h-4 w-4 text-white" />
                      ) : (
                        <Bot className="h-4 w-4 text-white" />
                      )}
                    </div>

                    <div className={`flex-1 max-w-[80%] ${message.role === "user" ? "text-right" : ""}`}>
                      <div
                        className={`inline-block rounded-2xl px-4 py-3 ${
                          message.role === "user"
                            ? "bg-gradient-to-br from-blue-500/90 to-blue-600/90 text-white"
                            : "glass"
                        }`}
                      >
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                          {content ? renderMessageWithMentions(content) : (isLoading && message.role === "assistant" ? "Thinking..." : "")}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>

            {/* Loading indicator */}
            {isLoading && messages.length > 0 && messages[messages.length - 1].role === "user" && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-4"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="glass rounded-2xl px-4 py-3 max-w-[80%]">
                  <div className="flex items-center gap-1.5">
                    <motion.div
                      className="w-2 h-2 rounded-full bg-emerald-400"
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                    />
                    <motion.div
                      className="w-2 h-2 rounded-full bg-emerald-400"
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                    />
                    <motion.div
                      className="w-2 h-2 rounded-full bg-emerald-400"
                      animate={{ scale: [1, 1.3, 1] }}
                      transition={{ duration: 0.6, repeat: Infinity, delay: 0.4 }}
                    />
                  </div>
                </div>
              </motion.div>
            )}

            {/* Error display */}
            {error && (
              <div className="glass rounded-xl p-4 border border-red-500/30 text-red-400">
                <p className="text-sm">Error: {error.message}</p>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-white/5 p-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="relative">
            {/* @mention dropdown */}
            <AnimatePresence>
              {showMentions && filteredPeople.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="absolute bottom-full mb-2 left-0 right-0 glass rounded-xl border border-white/10 overflow-hidden max-h-48 overflow-y-auto z-20"
                >
                  <div className="p-1">
                    <div className="px-3 py-1.5 text-xs text-muted-foreground flex items-center gap-1">
                      <AtSign className="h-3 w-3" />
                      Mention a contact
                    </div>
                    {filteredPeople.slice(0, 6).map((person, index) => (
                      <button
                        key={person.id}
                        type="button"
                        onClick={() => insertMention(person)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                          index === mentionIndex
                            ? "bg-purple-500/20 text-purple-300"
                            : "hover:bg-white/5"
                        }`}
                      >
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-sm font-medium">
                          {person.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium capitalize truncate">{person.name}</p>
                          {person.relationship && (
                            <p className="text-xs text-muted-foreground capitalize">{person.relationship}</p>
                          )}
                        </div>
                        {person.running_balance !== 0 && (
                          <span
                            className={`text-xs font-medium ${
                              person.running_balance > 0 ? "text-red-400" : "text-green-400"
                            }`}
                          >
                            {person.running_balance > 0 ? "You owe" : "Owes you"}{" "}
                            {formatCurrency(Math.abs(person.running_balance))}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="glass rounded-2xl border border-white/10 focus-within:border-blue-500/50 transition-colors">
              <Textarea
                ref={textareaRef}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="Log expenses, bills, or use @name to mention contacts..."
                disabled={isLoading}
                className="min-h-[56px] max-h-[200px] resize-none bg-transparent border-0 focus-visible:ring-0 pr-14 py-4 text-sm"
                rows={1}
              />
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="absolute right-2 bottom-2"
              >
                <Button
                  type="submit"
                  size="icon"
                  disabled={isLoading || !input.trim()}
                  className="h-10 w-10 rounded-xl bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 transition-all duration-300 shadow-lg shadow-blue-500/20 disabled:opacity-50"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 text-white animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 text-white" />
                  )}
                  <span className="sr-only">Send message</span>
                </Button>
              </motion.div>
            </div>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            Use <span className="text-purple-400 font-medium">@name</span> to mention contacts. Press Enter to send.
          </p>
        </form>
      </div>
    </div>
  )
}

function WelcomeScreen({ onQuickPrompt, people }: { onQuickPrompt: (prompt: string) => void; people: Person[] }) {
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/dashboard")
        if (res.ok) {
          const data = await res.json()
          setStats(data.data)
        }
      } catch {
        // Stats fetch failed
      } finally {
        setLoading(false)
      }
    }
    fetchStats()
  }, [])

  const totalYouOwe = stats?.outstandingDues.youOwe.reduce((sum, d) => sum + d.amount, 0) || 0
  const totalOwedToYou = stats?.outstandingDues.owedToYou.reduce((sum, d) => sum + d.amount, 0) || 0

  // Generate quick prompts with people names if available
  const quickPrompts = [
    { label: "Log expense", prompt: "I spent $25 on lunch at Chipotle" },
    { label: "Split bill", prompt: people.length > 0 ? `@${people[0].name} paid for dinner, $80 total` : "John paid for dinner, $80 total" },
    { label: "Show dashboard", prompt: "Show me my financial dashboard" },
    { label: "Add bill", prompt: "Rent is due on the 1st, $1500 monthly" },
  ]

  return (
    <div className="h-full flex flex-col items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-2xl w-full"
      >
        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
          className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center shadow-2xl shadow-blue-500/30"
        >
          <Wallet className="h-10 w-10 text-white" />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-4xl font-bold mb-3"
        >
          <span className="gradient-text">FinTrack AI</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-muted-foreground mb-8"
        >
          Your blunt, no-nonsense financial tracking assistant
        </motion.p>

        {/* Stats Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8"
        >
          <div className="glass rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-blue-400" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-1">This Month</p>
            {loading ? (
              <div className="h-6 w-20 bg-white/5 rounded animate-pulse" />
            ) : (
              <p className="text-lg font-bold text-blue-400">
                {formatCurrency(stats?.totalSpentThisMonth || 0)}
              </p>
            )}
          </div>

          <div className="glass rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                <Receipt className="h-4 w-4 text-emerald-400" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-1">Top Category</p>
            {loading ? (
              <div className="h-6 w-16 bg-white/5 rounded animate-pulse" />
            ) : (
              <p className="text-lg font-bold text-emerald-400 capitalize">
                {stats?.topCategory?.category || "None"}
              </p>
            )}
          </div>

          <div className="glass rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                <TrendingDown className="h-4 w-4 text-red-400" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-1">You Owe</p>
            {loading ? (
              <div className="h-6 w-20 bg-white/5 rounded animate-pulse" />
            ) : (
              <p className="text-lg font-bold text-red-400">{formatCurrency(totalYouOwe)}</p>
            )}
          </div>

          <div className="glass rounded-xl p-4 border border-white/10">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-green-500/20 flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-green-400" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-1">Owed to You</p>
            {loading ? (
              <div className="h-6 w-20 bg-white/5 rounded animate-pulse" />
            ) : (
              <p className="text-lg font-bold text-green-400">{formatCurrency(totalOwedToYou)}</p>
            )}
          </div>
        </motion.div>

        {/* People with balances */}
        {people.filter((p) => p.running_balance !== 0).length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55 }}
            className="glass rounded-xl p-4 border border-purple-500/30 mb-6"
          >
            <div className="flex items-center gap-2 text-purple-400 mb-3">
              <AtSign className="h-4 w-4" />
              <span className="text-sm font-medium">People with balances</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {people
                .filter((p) => p.running_balance !== 0)
                .slice(0, 5)
                .map((person) => (
                  <button
                    key={person.id}
                    onClick={() => onQuickPrompt(`Show me my balance with @${person.name}`)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 hover:bg-purple-500/20 transition-colors"
                  >
                    <span className="text-sm capitalize">@{person.name}</span>
                    <span
                      className={`text-xs font-medium ${
                        person.running_balance > 0 ? "text-red-400" : "text-green-400"
                      }`}
                    >
                      {formatCurrency(Math.abs(person.running_balance))}
                    </span>
                  </button>
                ))}
            </div>
          </motion.div>
        )}

        {/* Upcoming Bills */}
        {stats && stats.upcomingBills.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="glass rounded-xl p-4 border border-orange-500/30 mb-8"
          >
            <div className="flex items-center gap-2 text-orange-400 mb-2">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Upcoming Bills</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {stats.upcomingBills.slice(0, 3).map((bill) => (
                <span
                  key={bill.name}
                  className="text-xs px-2 py-1 rounded-full bg-orange-500/10 text-orange-300"
                >
                  {bill.name}: {formatCurrency(bill.amount)} due {bill.due_date}
                </span>
              ))}
            </div>
          </motion.div>
        )}

        {/* Quick Actions */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="flex items-center justify-center gap-2 flex-wrap"
        >
          {quickPrompts.map((item) => (
            <motion.button
              key={item.label}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onQuickPrompt(item.prompt)}
              className="glass px-4 py-2 rounded-full text-sm border border-white/10 hover:border-blue-500/50 transition-colors"
            >
              {item.label}
            </motion.button>
          ))}
        </motion.div>
      </motion.div>
    </div>
  )
}
