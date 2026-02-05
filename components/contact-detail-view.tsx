"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Receipt,
  Clock,
  CheckCircle,
  MessageSquare,
  Edit2,
  Loader2,
  Phone,
  Mail,
  Calendar,
  ArrowUpRight,
  ArrowDownLeft,
} from "lucide-react"
import type { Person } from "@/lib/types"

interface Activity {
  id: string
  type: "transaction" | "due" | "settlement" | "note"
  date: string
  time: string
  amount: number
  description: string
  category?: string
  status?: string
  direction: "in" | "out" | "neutral"
}

interface Summary {
  totalBalance: number
  transactionCount: number
  pendingDuesCount: number
  direction: "you_owe" | "they_owe" | "settled"
}

interface ContactDetailViewProps {
  person: Person
  onBack: () => void
  onChat: (person: Person) => void
  onEdit: (person: Person) => void
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Math.abs(amount))
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function formatTime(timeStr: string): string {
  return timeStr.split(":").slice(0, 2).join(":")
}

export function ContactDetailView({ person, onBack, onChat, onEdit }: ContactDetailViewProps) {
  const [activities, setActivities] = useState<Activity[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch(`/api/people/${person.id}/history`)
        if (res.ok) {
          const data = await res.json()
          setActivities(data.activities || [])
          setSummary(data.summary)
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false)
      }
    }
    fetchHistory()
  }, [person.id])

  const getActivityIcon = (activity: Activity) => {
    switch (activity.type) {
      case "transaction":
        return activity.direction === "in" ? (
          <ArrowDownLeft className="h-4 w-4 text-amber-600" />
        ) : (
          <ArrowUpRight className="h-4 w-4 text-destructive" />
        )
      case "settlement":
        return <CheckCircle className="h-4 w-4 text-amber-600" />
      case "due":
        return activity.status === "pending" ? (
          <Clock className="h-4 w-4 text-yellow-600" />
        ) : (
          <CheckCircle className="h-4 w-4 text-amber-600" />
        )
      default:
        return <Receipt className="h-4 w-4 text-muted-foreground" />
    }
  }

  const getActivityColor = (activity: Activity) => {
    if (activity.direction === "in") return "text-amber-700"
    if (activity.direction === "out") return "text-destructive"
    return "text-muted-foreground"
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="h-full flex flex-col"
    >
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="rounded-full hover:bg-accent"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h2 className="text-xl font-bold capitalize">{person.name}</h2>
            {person.relationship && (
              <span className="text-sm text-muted-foreground capitalize">{person.relationship}</span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(person)}
            className="rounded-full hover:bg-accent"
          >
            <Edit2 className="h-4 w-4" />
          </Button>
        </div>

        {/* Contact Info */}
        <div className="flex gap-4 mb-4">
          {person.email && (
            <a href={`mailto:${person.email}`} className="flex items-center gap-1.5 text-sm text-primary hover:underline">
              <Mail className="h-3.5 w-3.5" />
              {person.email}
            </a>
          )}
          {person.phone && (
            <a href={`tel:${person.phone}`} className="flex items-center gap-1.5 text-sm text-amber-600 hover:underline">
              <Phone className="h-3.5 w-3.5" />
              {person.phone}
            </a>
          )}
        </div>

        {/* Balance Summary Card */}
        <div className={`glass rounded-xl p-4 border ${
          person.running_balance > 0 
            ? "border-destructive/30 bg-destructive/5" 
            : person.running_balance < 0 
            ? "border-amber-500/30 bg-amber-500/5" 
            : "border-border"
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Total Balance</p>
              <p className={`text-3xl font-bold ${
                person.running_balance > 0 
                  ? "text-destructive" 
                  : person.running_balance < 0 
                  ? "text-amber-700" 
                  : "text-muted-foreground"
              }`}>
                {person.running_balance === 0 ? "All Settled" : formatCurrency(person.running_balance)}
              </p>
              <p className={`text-sm mt-1 ${
                person.running_balance > 0 ? "text-destructive/80" : person.running_balance < 0 ? "text-amber-700/80" : "text-muted-foreground"
              }`}>
                {person.running_balance > 0 && `You owe ${person.name}`}
                {person.running_balance < 0 && `${person.name} owes you`}
                {person.running_balance === 0 && "No outstanding balance"}
              </p>
            </div>
            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
              person.running_balance > 0 
                ? "bg-destructive/20" 
                : person.running_balance < 0 
                ? "bg-amber-500/20" 
                : "bg-muted"
            }`}>
              {person.running_balance > 0 ? (
                <TrendingDown className="h-6 w-6 text-destructive" />
              ) : person.running_balance < 0 ? (
                <TrendingUp className="h-6 w-6 text-amber-600" />
              ) : (
                <CheckCircle className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Quick Stats */}
          {summary && (
            <div className="flex gap-4 mt-4 pt-4 border-t border-border">
              <div className="flex-1 text-center">
                <p className="text-2xl font-bold">{summary.transactionCount}</p>
                <p className="text-xs text-muted-foreground">Transactions</p>
              </div>
              <div className="flex-1 text-center border-l border-border">
                <p className="text-2xl font-bold">{summary.pendingDuesCount}</p>
                <p className="text-xs text-muted-foreground">Pending</p>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 mt-4">
          <Button
            onClick={() => onChat(person)}
            className="flex-1 bg-primary hover:bg-primary/90"
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Chat about {person.name}
          </Button>
        </div>
      </div>

      {/* Activity Log */}
      <div className="flex-1 overflow-y-auto p-4">
        <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Activity History
        </h3>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Receipt className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p>No activity yet</p>
            <p className="text-sm">Start tracking by logging an expense with {person.name}</p>
          </div>
        ) : (
          <div className="space-y-2">
            <AnimatePresence>
              {activities.map((activity, index) => (
                <motion.div
                  key={activity.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="glass rounded-xl p-3 border border-border hover:border-primary/20 transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                      activity.direction === "in" 
                        ? "bg-amber-500/20" 
                        : activity.direction === "out" 
                        ? "bg-destructive/20" 
                        : "bg-muted"
                    }`}>
                      {getActivityIcon(activity)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-sm truncate">{activity.description}</p>
                        <p className={`font-semibold text-sm whitespace-nowrap ${getActivityColor(activity)}`}>
                          {activity.direction === "in" ? "+" : activity.direction === "out" ? "-" : ""}
                          {formatCurrency(activity.amount)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(activity.date)}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatTime(activity.time)}
                        </span>
                        {activity.category && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-muted capitalize">
                            {activity.category}
                          </span>
                        )}
                        {activity.status === "pending" && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-500/20 text-yellow-700">
                            Pending
                          </span>
                        )}
                        {activity.status === "settled" && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-700">
                            Settled
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Notes */}
      {person.notes && (
        <div className="p-4 border-t border-border">
          <h3 className="text-sm font-semibold text-muted-foreground mb-2">Notes</h3>
          <p className="text-sm whitespace-pre-wrap glass rounded-lg p-3 border border-border">
            {person.notes}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="p-4 border-t border-border text-xs text-muted-foreground">
        Contact added {formatDate(person.created_at)}
      </div>
    </motion.div>
  )
}
