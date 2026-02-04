"use client"

import React from "react"

import { useState, useRef, useEffect, useCallback } from "react"
import { useChat, type UseChatOptions } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Send,
  Bot,
  User,
  Sparkles,
  Wallet,
  TrendingUp,
  Receipt,
  Users,
  ArrowUpCircle,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

interface ChatViewProps {
  conversationId: string | null
  onConversationCreated: (id: string, title: string) => void
}

// Helper function to extract text from UIMessage parts
function getMessageText(message: { parts?: Array<{ type: string; text?: string }> }): string {
  if (!message.parts || !Array.isArray(message.parts)) return ""
  return message.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text)
    .join("")
}

const quickPrompts = [
  {
    icon: Receipt,
    label: "Log Expense",
    prompt: "I spent $25 on lunch at Chipotle",
    color: "from-blue-500 to-blue-600",
  },
  {
    icon: Users,
    label: "Split Bill",
    prompt: "John paid for dinner, $80 total",
    color: "from-emerald-500 to-emerald-600",
  },
  {
    icon: TrendingUp,
    label: "Dashboard",
    prompt: "Show me my financial dashboard",
    color: "from-purple-500 to-purple-600",
  },
  {
    icon: ArrowUpCircle,
    label: "Add Bill",
    prompt: "Rent is due on the 1st, $1500 monthly",
    color: "from-orange-500 to-orange-600",
  },
]

export function ChatView({ conversationId, onConversationCreated }: ChatViewProps) {
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(conversationId)
  const [input, setInput] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Update currentConversationId when prop changes
  useEffect(() => {
    setCurrentConversationId(conversationId)
  }, [conversationId])

  const chatOptions: UseChatOptions = {
    transport: new DefaultChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: ({ messages }) => ({
        body: {
          messages,
          conversationId: currentConversationId,
        },
      }),
    }),
    id: currentConversationId || "new",
  }

  const { messages, sendMessage, status, setMessages } = useChat(chatOptions)

  // Reset messages when conversation changes
  useEffect(() => {
    if (conversationId === null) {
      setMessages([])
      setCurrentConversationId(null)
    } else if (conversationId !== currentConversationId) {
      // Load messages for existing conversation
      loadConversationMessages(conversationId)
    }
  }, [conversationId])

  const loadConversationMessages = useCallback(async (convId: string) => {
    const response = await fetch(`/api/conversations/${convId}/messages`)
    if (response.ok) {
      const data = await response.json()
      const formattedMessages = data.messages.map((m: { id: string; role: string; content: string }) => ({
        id: m.id,
        role: m.role as "user" | "assistant",
        parts: [{ type: "text", text: m.content }],
      }))
      setMessages(formattedMessages)
      setCurrentConversationId(convId)
    }
  }, [setMessages])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto"
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`
    }
  }, [input])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!input.trim() || status === "streaming" || status === "submitted") return

    const messageText = input.trim()
    setInput("")

    // Create conversation if this is a new chat
    if (!currentConversationId) {
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: messageText.slice(0, 50) }),
      })

      if (response.ok) {
        const data = await response.json()
        setCurrentConversationId(data.conversation.id)
        onConversationCreated(data.conversation.id, data.conversation.title)
        
        // Send message with new conversation ID
        sendMessage(
          { text: messageText },
          { body: { conversationId: data.conversation.id } }
        )
      }
    } else {
      sendMessage({ text: messageText })
    }
  }

  function handleQuickPrompt(prompt: string) {
    setInput(prompt)
    textareaRef.current?.focus()
  }

  const isStreaming = status === "streaming" || status === "submitted"
  const showWelcome = messages.length === 0 && !conversationId

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto">
        {showWelcome ? (
          <WelcomeScreen onQuickPrompt={handleQuickPrompt} />
        ) : (
          <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
            <AnimatePresence mode="popLayout">
              {messages.map((message, index) => {
                const text = getMessageText(message)
                if (!text) return null

                return (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className={`flex gap-4 ${
                      message.role === "user" ? "flex-row-reverse" : ""
                    }`}
                  >
                    {/* Avatar */}
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

                    {/* Message Content */}
                    <div
                      className={`flex-1 max-w-[80%] ${
                        message.role === "user" ? "text-right" : ""
                      }`}
                    >
                      <div
                        className={`inline-block rounded-2xl px-4 py-3 ${
                          message.role === "user"
                            ? "bg-gradient-to-br from-blue-500/90 to-blue-600/90 text-white"
                            : "glass"
                        }`}
                      >
                        <div className="whitespace-pre-wrap text-sm leading-relaxed">
                          {text}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>

            {/* Streaming Indicator */}
            {isStreaming && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-4"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <Bot className="h-4 w-4 text-white" />
                </div>
                <div className="glass rounded-2xl px-4 py-3">
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

            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-white/5 p-4">
        <form onSubmit={handleSubmit} className="max-w-3xl mx-auto">
          <div className="relative glass rounded-2xl border border-white/10 focus-within:border-blue-500/50 transition-colors">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit(e)
                }
              }}
              placeholder="Log an expense, bill, or ask for your dashboard..."
              disabled={isStreaming}
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
                disabled={isStreaming || !input.trim()}
                className="h-10 w-10 rounded-xl bg-gradient-to-r from-blue-500 to-emerald-500 hover:from-blue-600 hover:to-emerald-600 transition-all duration-300 shadow-lg shadow-blue-500/20 disabled:opacity-50"
              >
                <Send className="h-4 w-4 text-white" />
                <span className="sr-only">Send message</span>
              </Button>
            </motion.div>
          </div>
          <p className="text-xs text-muted-foreground text-center mt-2">
            FinTrack AI stores all data in your secure database. Nothing is forgotten.
          </p>
        </form>
      </div>
    </div>
  )
}

function WelcomeScreen({ onQuickPrompt }: { onQuickPrompt: (prompt: string) => void }) {
  return (
    <div className="h-full flex flex-col items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="text-center max-w-2xl"
      >
        {/* Logo */}
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
          className="text-muted-foreground mb-2"
        >
          Your blunt, no-nonsense financial tracking assistant
        </motion.p>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="flex items-center justify-center gap-2 text-sm text-muted-foreground/70 mb-8"
        >
          <Sparkles className="h-4 w-4 text-emerald-400" />
          <span>Powered by AI, backed by Postgres</span>
        </motion.div>

        {/* Quick Prompts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl mx-auto"
        >
          {quickPrompts.map((item, index) => (
            <motion.button
              key={item.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.7 + index * 0.1 }}
              whileHover={{ scale: 1.02, y: -2 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onQuickPrompt(item.prompt)}
              className="flex items-center gap-3 p-4 rounded-xl glass border border-white/10 hover:border-white/20 text-left transition-all duration-200 group"
            >
              <div
                className={`w-10 h-10 rounded-lg bg-gradient-to-br ${item.color} flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform`}
              >
                <item.icon className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="font-medium text-sm">{item.label}</p>
                <p className="text-xs text-muted-foreground line-clamp-1">
                  {item.prompt}
                </p>
              </div>
            </motion.button>
          ))}
        </motion.div>
      </motion.div>
    </div>
  )
}
