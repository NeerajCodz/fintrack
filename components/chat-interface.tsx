"use client"

import React, { useState, useRef, useEffect } from "react"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/financial-utils"
import { ArrowUp, Command, Sparkles, Users, Receipt, Bell, BarChart3 } from "lucide-react"
import type { DashboardData } from "@/lib/types"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
}

const quickActions = [
  { label: "Who owes me?", prompt: "Who owes me money?", icon: Users },
  { label: "What do I owe?", prompt: "How much do I owe?", icon: Receipt },
  { label: "My reminders", prompt: "Show my recurring reminders", icon: Bell },
  { label: "Full summary", prompt: "Give me a complete financial overview", icon: BarChart3 },
]

export function ChatInterface() {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [dashboard, setDashboard] = useState<DashboardData | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  useEffect(() => {
    // Fetch dashboard data on mount
    fetchDashboard()
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        inputRef.current?.focus()
      }
      if (e.key === "Escape") {
        inputRef.current?.blur()
      }
    }
    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  const fetchDashboard = async () => {
    try {
      const res = await fetch("/api/dashboard")
      if (res.ok) {
        const json = await res.json()
        setDashboard(json.data)
      }
    } catch (err) {
      console.error("Failed to fetch dashboard:", err)
    }
  }

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: text,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsLoading(true)

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...messages, { role: "user", content: text }],
        }),
      })

      if (!res.ok) {
        throw new Error("Failed to send message")
      }

      // Read streamed response
      const reader = res.body?.getReader()
      const decoder = new TextDecoder()
      let assistantContent = ""

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split("\n")

          for (const line of lines) {
            if (line.startsWith("0:")) {
              // Text content - parse the JSON string
              const jsonStr = line.slice(2)
              try {
                const text = JSON.parse(jsonStr)
                assistantContent += text
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }
      }

      const assistantMessage: Message = {
        id: `assistant-${Date.now()}`,
        role: "assistant",
        content: assistantContent || "I couldn't process that. Try something like: 'I owe Ajay 50 for lunch'",
      }

      setMessages((prev) => [...prev, assistantMessage])

      // Refresh dashboard after potential data change
      if (res.headers.get("X-DB-Updated") === "true") {
        fetchDashboard()
      }
    } catch (err) {
      console.error("Chat error:", err)
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: "assistant",
        content: "Sorry, something went wrong. Please try again.",
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleQuickAction = (prompt: string) => {
    sendMessage(prompt)
  }

  const hasMessages = messages.length > 0

  // Calculate stats from dashboard
  const totalYouOwe = dashboard?.outstandingDues.youOwe.reduce((sum, d) => sum + d.amount, 0) || 0
  const totalOwedToYou = dashboard?.outstandingDues.owedToYou.reduce((sum, d) => sum + d.amount, 0) || 0
  const netBalance = totalOwedToYou - totalYouOwe

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Ambient background effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -right-[20%] w-[80%] h-[80%] rounded-full bg-gradient-to-br from-primary/[0.03] to-transparent blur-3xl" />
        <div className="absolute -bottom-[30%] -left-[20%] w-[60%] h-[60%] rounded-full bg-gradient-to-tr from-success/[0.02] to-transparent blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative flex-shrink-0 px-6 py-4 border-b border-border/50">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-foreground flex items-center justify-center">
              <span className="text-background font-bold text-sm">f.</span>
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold tracking-tight">fin.</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">financial copilot</p>
            </div>
          </div>
          <div
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
              !isLoading ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
            )}
          >
            <span
              className={cn(
                "w-1.5 h-1.5 rounded-full",
                !isLoading ? "bg-success" : "bg-muted-foreground animate-pulse"
              )}
            />
            {!isLoading ? "Ready" : "Processing"}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto scrollbar-hide relative">
        <div className="max-w-3xl mx-auto px-6">
          {!hasMessages ? (
            <div className="pt-16 pb-8">
              {/* Hero */}
              <div className="space-y-4 mb-16">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted text-xs font-medium text-muted-foreground">
                  <Sparkles className="w-3 h-3" />
                  AI-Powered
                </div>
                <h1 className="text-5xl sm:text-6xl font-bold tracking-tight leading-[1.05]">
                  Your money,
                  <br />
                  <span className="text-muted-foreground">your command.</span>
                </h1>
                <p className="text-muted-foreground text-lg max-w-lg leading-relaxed">
                  Track who owes you, what you owe, and set payment reminders. Just tell me in plain language.
                </p>
              </div>

              {/* Quick Actions */}
              <div className="space-y-3 mb-16">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                  Try asking
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {quickActions.map((action) => {
                    const Icon = action.icon
                    return (
                      <button
                        key={action.label}
                        onClick={() => handleQuickAction(action.prompt)}
                        disabled={isLoading}
                        className="group relative flex items-center gap-3 p-4 rounded-xl bg-card border border-border hover:border-foreground/20 hover:shadow-sm transition-all text-left disabled:opacity-50"
                      >
                        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center group-hover:bg-foreground/5 transition-colors">
                          <Icon className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                        </div>
                        <span className="text-sm font-medium">{action.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* At-a-glance Stats */}
              <div className="pt-8 border-t border-border">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-4">
                  At a glance
                </p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-6">
                  <div className="space-y-1">
                    <p className="font-mono text-3xl font-bold tracking-tight">
                      {dashboard ? formatCurrency(dashboard.totalSpentThisMonth) : "---"}
                    </p>
                    <p className="text-xs text-muted-foreground">Spent this month</p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-mono text-3xl font-bold tracking-tight">
                      {dashboard?.topCategory ? dashboard.topCategory.category : "---"}
                    </p>
                    <p className="text-xs text-muted-foreground">Top category</p>
                  </div>
                  <div className="space-y-1">
                    <p className="font-mono text-3xl font-bold tracking-tight">
                      {dashboard ? formatCurrency(totalYouOwe) : "---"}
                    </p>
                    <p className="text-xs text-muted-foreground">You owe</p>
                  </div>
                  <div className="space-y-1">
                    <p
                      className={cn(
                        "font-mono text-3xl font-bold tracking-tight",
                        netBalance >= 0 ? "text-success" : "text-destructive"
                      )}
                    >
                      {dashboard
                        ? `${netBalance >= 0 ? "+" : ""}${formatCurrency(netBalance)}`
                        : "---"}
                    </p>
                    <p className="text-xs text-muted-foreground">Net balance</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="py-8 space-y-8">
              {messages.map((message) => (
                <div key={message.id} className="space-y-4">
                  {message.role === "user" ? (
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-foreground flex items-center justify-center flex-shrink-0 shadow-sm">
                        <span className="text-xs font-bold text-background">Y</span>
                      </div>
                      <div className="flex-1 pt-1">
                        <p className="text-[15px] leading-relaxed font-medium">{message.content}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-muted to-accent border border-border flex items-center justify-center flex-shrink-0 shadow-sm">
                        <Sparkles className="w-3.5 h-3.5 text-foreground" />
                      </div>
                      <div className="flex-1 pt-1 space-y-4 min-w-0">
                        <p className="text-[15px] leading-relaxed text-foreground/85 whitespace-pre-wrap">
                          {message.content}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {isLoading && (
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-muted to-accent border border-border flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-3.5 h-3.5 text-foreground animate-pulse" />
                  </div>
                  <div className="flex-1 pt-2.5">
                    <div className="flex gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full bg-foreground/20 animate-bounce"
                        style={{ animationDelay: "0ms" }}
                      />
                      <span
                        className="w-2 h-2 rounded-full bg-foreground/20 animate-bounce"
                        style={{ animationDelay: "150ms" }}
                      />
                      <span
                        className="w-2 h-2 rounded-full bg-foreground/20 animate-bounce"
                        style={{ animationDelay: "300ms" }}
                      />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="flex-shrink-0 px-6 pb-6 pt-4 relative">
        <div className="absolute inset-x-0 -top-16 h-16 bg-gradient-to-t from-background to-transparent pointer-events-none" />

        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Try: I owe Ajay 50 for lunch..."
              disabled={isLoading}
              className="w-full h-14 pl-5 pr-28 rounded-2xl bg-card border border-border text-[15px] placeholder:text-muted-foreground focus:outline-none focus:border-foreground/20 focus:ring-2 focus:ring-foreground/5 disabled:opacity-50 transition-all shadow-sm"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <kbd className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium font-mono bg-muted text-muted-foreground border border-border">
                <Command className="w-2.5 h-2.5" />K
              </kbd>
              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                  input.trim() && !isLoading
                    ? "bg-foreground text-background hover:bg-foreground/90 shadow-sm"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <ArrowUp className="w-4 h-4" />
              </button>
            </div>
          </div>
          <p className="text-[11px] text-muted-foreground text-center mt-4">
            Powered by Groq AI · Your data stays secure
          </p>
        </form>
      </div>
    </div>
  )
}
