"use client"

import { useState, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  X,
  Bell,
  Check,
  Clock,
  Calendar,
  Trash2,
  AlertCircle,
  Loader2,
  Undo2,
  ChevronRight,
  Settings,
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import type { RecurringReminder, ReminderPayment } from "@/lib/types"

interface RemindersManagerProps {
  onClose: () => void
}

interface ReminderSettings {
  weekStartDay: number // 0=Sunday, 1=Monday, etc.
  monthStartDay: number // 1-31
  yearStartMonth: number // 0-11
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount)
}

function getRecurrenceText(reminder: RecurringReminder): string {
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  
  if (reminder.recurrence_type === "daily") {
    return "Every day"
  } else if (reminder.recurrence_type === "weekly") {
    const day = dayNames[reminder.recurrence_day || 0]
    return `Every ${day}`
  } else if (reminder.recurrence_type === "monthly") {
    const day = reminder.recurrence_day || 1
    const suffix = getOrdinalSuffix(day)
    return `${day}${suffix} of every month`
  } else {
    return "Yearly"
  }
}

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0] || "th"
}

function getDaysUntilDue(dueDate: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  return Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function daysSincePaid(paidDate: string | null): number {
  if (!paidDate) return -1
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const paid = new Date(paidDate)
  paid.setHours(0, 0, 0, 0)
  return Math.ceil((today.getTime() - paid.getTime()) / (1000 * 60 * 60 * 24))
}

export function RemindersManager({ onClose }: RemindersManagerProps) {
  const [reminders, setReminders] = useState<RecurringReminder[]>([])
  const [payments, setPayments] = useState<ReminderPayment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<"upcoming" | "history" | "settings">("upcoming")
  const [processingPayment, setProcessingPayment] = useState<string | null>(null)
  const [undoStack, setUndoStack] = useState<{ paymentId: string; action: string }[]>([])
  
  // Settings
  const [settings, setSettings] = useState<ReminderSettings>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("fintrack-reminder-settings")
      if (saved) return JSON.parse(saved)
    }
    return { weekStartDay: 0, monthStartDay: 1, yearStartMonth: 0 }
  })

  const saveSettings = (newSettings: ReminderSettings) => {
    setSettings(newSettings)
    localStorage.setItem("fintrack-reminder-settings", JSON.stringify(newSettings))
  }

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const [remindersRes, paymentsRes] = await Promise.all([
        fetch("/api/reminders"),
        fetch("/api/reminders/payments"),
      ])

      if (remindersRes.ok) {
        const data = await remindersRes.json()
        setReminders(data.reminders || [])
      }

      if (paymentsRes.ok) {
        const data = await paymentsRes.json()
        setPayments(data.payments || [])
      }
    } catch (error) {
      console.error("Error fetching reminders:", error)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleMarkThisOccurrencePaid = async (paymentId: string) => {
    setProcessingPayment(paymentId)
    try {
      const res = await fetch(`/api/reminders/payments/${paymentId}/paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createNext: false }),
      })

      if (res.ok) {
        setUndoStack(prev => [...prev, { paymentId, action: "mark_paid" }])
        await fetchData()
      }
    } catch (error) {
      console.error("Error marking payment as paid:", error)
    } finally {
      setProcessingPayment(null)
    }
  }

  const handleMarkNextOccurrencePaid = async (paymentId: string) => {
    setProcessingPayment(paymentId)
    try {
      const res = await fetch(`/api/reminders/payments/${paymentId}/paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createNext: true }),
      })

      if (res.ok) {
        setUndoStack(prev => [...prev, { paymentId, action: "mark_paid_next" }])
        await fetchData()
      }
    } catch (error) {
      console.error("Error marking payment as paid:", error)
    } finally {
      setProcessingPayment(null)
    }
  }

  const handleUndoPayment = async (paymentId: string) => {
    setProcessingPayment(paymentId)
    try {
      const res = await fetch(`/api/reminders/payments/${paymentId}/undo`, {
        method: "POST",
      })

      if (res.ok) {
        setUndoStack(prev => prev.filter(item => item.paymentId !== paymentId))
        await fetchData()
      }
    } catch (error) {
      console.error("Error undoing payment:", error)
    } finally {
      setProcessingPayment(null)
    }
  }

  const handleDeleteReminder = async (reminderId: string) => {
    try {
      const res = await fetch(`/api/reminders/${reminderId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        await fetchData()
      }
    } catch (error) {
      console.error("Error deleting reminder:", error)
    }
  }

  const pendingPayments = payments.filter(p => p.status === "pending")
  const paidPayments = payments.filter(p => p.status === "paid")
  const recentlyPaidPayments = paidPayments.filter(p => daysSincePaid(p.paid_date) <= 3)

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[85vh] glass-strong rounded-2xl border border-white/10 flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
              <Bell className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Reminders</h2>
              <p className="text-xs text-muted-foreground">
                Track recurring payments
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full hover:bg-white/10"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 p-3 border-b border-white/10">
          <Button
            variant={activeTab === "upcoming" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("upcoming")}
            className={activeTab === "upcoming" ? "bg-amber-500/20 text-amber-300" : ""}
          >
            <Clock className="h-4 w-4 mr-2" />
            Upcoming ({pendingPayments.length})
          </Button>
          <Button
            variant={activeTab === "history" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("history")}
            className={activeTab === "history" ? "bg-emerald-500/20 text-emerald-300" : ""}
          >
            <Check className="h-4 w-4 mr-2" />
            Paid ({paidPayments.length})
          </Button>
          <Button
            variant={activeTab === "settings" ? "default" : "ghost"}
            size="sm"
            onClick={() => setActiveTab("settings")}
            className={activeTab === "settings" ? "bg-blue-500/20 text-blue-300" : ""}
          >
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>

        {/* Content */}
        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 text-amber-400 animate-spin" />
            </div>
          ) : activeTab === "upcoming" ? (
            <div className="p-4 space-y-3">
              {pendingPayments.length === 0 ? (
                <div className="text-center py-12">
                  <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                  <p className="text-muted-foreground">No upcoming payments</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Use chat to add reminders: "Netflix 199 every 15th"
                  </p>
                </div>
              ) : (
                pendingPayments.map((payment) => {
                  const reminder = payment.reminder
                  const daysUntil = getDaysUntilDue(payment.due_date)
                  const isOverdue = daysUntil < 0
                  const isDueSoon = daysUntil <= 3 && daysUntil >= 0
                  const canUndo = undoStack.some(item => item.paymentId === payment.id)

                  return (
                    <motion.div
                      key={payment.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`glass rounded-xl p-4 border ${
                        isOverdue
                          ? "border-red-500/30 bg-red-500/5"
                          : isDueSoon
                            ? "border-amber-500/30 bg-amber-500/5"
                            : "border-white/10"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                              isOverdue
                                ? "bg-red-500/20"
                                : isDueSoon
                                  ? "bg-amber-500/20"
                                  : "bg-white/10"
                            }`}
                          >
                            {isOverdue ? (
                              <AlertCircle className="h-5 w-5 text-red-400" />
                            ) : (
                              <Calendar className="h-5 w-5 text-amber-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-medium">{reminder?.name || "Payment"}</p>
                            <p className="text-xs text-muted-foreground">
                              {reminder ? getRecurrenceText(reminder) : "One-time"}
                            </p>
                          </div>
                        </div>

                        <div className="text-right">
                          <p className="font-bold text-lg">
                            {formatCurrency(payment.amount)}
                          </p>
                          <p
                            className={`text-xs ${
                              isOverdue
                                ? "text-red-400"
                                : isDueSoon
                                  ? "text-amber-400"
                                  : "text-muted-foreground"
                            }`}
                          >
                            {isOverdue
                              ? `${Math.abs(daysUntil)} days overdue`
                              : daysUntil === 0
                                ? "Due today"
                                : daysUntil === 1
                                  ? "Due tomorrow"
                                  : `Due in ${daysUntil} days`}
                          </p>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 mt-3">
                        <Button
                          size="sm"
                          onClick={() => handleMarkThisOccurrencePaid(payment.id)}
                          disabled={processingPayment === payment.id}
                          className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300"
                        >
                          {processingPayment === payment.id ? (
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          ) : (
                            <Check className="h-4 w-4 mr-2" />
                          )}
                          Mark Paid
                        </Button>

                        {canUndo && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleUndoPayment(payment.id)}
                            disabled={processingPayment === payment.id}
                            className="text-yellow-400 hover:bg-yellow-500/20"
                          >
                            <Undo2 className="h-4 w-4" />
                          </Button>
                        )}

                        {reminder && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteReminder(reminder.id)}
                            className="text-red-400 hover:bg-red-500/20"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  )
                })
              )}

              {/* List of all recurring reminders */}
              {reminders.length > 0 && (
                <div className="mt-6 pt-4 border-t border-white/10">
                  <h3 className="text-sm font-medium text-muted-foreground mb-3">
                    All Recurring Reminders
                  </h3>
                  <div className="space-y-2">
                    {reminders.map((reminder) => (
                      <div
                        key={reminder.id}
                        className="flex items-center justify-between py-2 px-3 rounded-lg bg-white/5"
                      >
                        <div>
                          <p className="text-sm font-medium">{reminder.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {getRecurrenceText(reminder)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {reminder.amount > 0
                              ? formatCurrency(reminder.amount)
                              : "—"}
                          </span>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleDeleteReminder(reminder.id)}
                            className="h-7 w-7 text-red-400 hover:bg-red-500/20"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === "history" ? (
            <div className="p-4 space-y-3">
              {/* Recently paid section */}
              {recentlyPaidPayments.length > 0 && (
                <div className="mb-4">
                  <h3 className="text-sm font-medium text-emerald-400 mb-3 flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    Recently Paid (last 3 days)
                  </h3>
                  <div className="space-y-2">
                    {recentlyPaidPayments.map((payment) => {
                      const reminder = payment.reminder
                      const canUndo = undoStack.some(item => item.paymentId === payment.id)

                      return (
                        <motion.div
                          key={payment.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="glass rounded-xl p-4 border border-emerald-500/30 bg-emerald-500/5"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                                <Check className="h-5 w-5 text-emerald-400" />
                              </div>
                              <div>
                                <p className="font-medium">{reminder?.name || "Payment"}</p>
                                <p className="text-xs text-muted-foreground">
                                  Paid {daysSincePaid(payment.paid_date) === 0 ? "today" : `${daysSincePaid(payment.paid_date)} days ago`}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-3">
                              <p className="font-bold text-lg text-emerald-400">
                                {formatCurrency(payment.amount)}
                              </p>
                              {canUndo && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleUndoPayment(payment.id)}
                                  disabled={processingPayment === payment.id}
                                  className="text-yellow-400 hover:bg-yellow-500/20"
                                >
                                  <Undo2 className="h-4 w-4 mr-1" />
                                  Undo
                                </Button>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* All paid payments */}
              {paidPayments.length === 0 ? (
                <div className="text-center py-12">
                  <Check className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
                  <p className="text-muted-foreground">No payment history yet</p>
                </div>
              ) : (
                paidPayments.filter(p => daysSincePaid(p.paid_date) > 3).map((payment) => {
                  const reminder = payment.reminder

                  return (
                    <motion.div
                      key={payment.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="glass rounded-xl p-4 border border-white/10"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                            <Check className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="font-medium">{reminder?.name || "Payment"}</p>
                            <p className="text-xs text-muted-foreground">
                              Paid on {new Date(payment.paid_date || payment.due_date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        <p className="font-bold text-lg">
                          {formatCurrency(payment.amount)}
                        </p>
                      </div>
                    </motion.div>
                  )
                })
              )}
            </div>
          ) : (
            /* Settings Tab */
            <div className="p-4 space-y-6">
              <div>
                <h3 className="text-sm font-medium mb-3">Week Starts On</h3>
                <div className="grid grid-cols-4 gap-2">
                  {dayNames.map((day, i) => (
                    <Button
                      key={day}
                      size="sm"
                      variant={settings.weekStartDay === i ? "default" : "ghost"}
                      onClick={() => saveSettings({ ...settings, weekStartDay: i })}
                      className={settings.weekStartDay === i ? "bg-blue-500/30 text-blue-300" : ""}
                    >
                      {day.slice(0, 3)}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-3">Month Starts On Day</h3>
                <div className="grid grid-cols-7 gap-2">
                  {[1, 5, 10, 15, 20, 25, 28].map((day) => (
                    <Button
                      key={day}
                      size="sm"
                      variant={settings.monthStartDay === day ? "default" : "ghost"}
                      onClick={() => saveSettings({ ...settings, monthStartDay: day })}
                      className={settings.monthStartDay === day ? "bg-blue-500/30 text-blue-300" : ""}
                    >
                      {day}{getOrdinalSuffix(day)}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-sm font-medium mb-3">Year Starts In</h3>
                <div className="grid grid-cols-4 gap-2">
                  {monthNames.map((month, i) => (
                    <Button
                      key={month}
                      size="sm"
                      variant={settings.yearStartMonth === i ? "default" : "ghost"}
                      onClick={() => saveSettings({ ...settings, yearStartMonth: i })}
                      className={settings.yearStartMonth === i ? "bg-blue-500/30 text-blue-300" : ""}
                    >
                      {month.slice(0, 3)}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-white/10">
                <p className="text-xs text-muted-foreground">
                  These settings affect how weekly, monthly, and yearly reminders are calculated
                  for reset cycles.
                </p>
              </div>
            </div>
          )}
        </ScrollArea>

        {/* Footer hint */}
        <div className="p-3 border-t border-white/10 text-center">
          <p className="text-xs text-muted-foreground">
            💡 Add reminders via chat: "Netflix 199 every 15th" or "Rent 5000 every 1st"
          </p>
        </div>
      </motion.div>
    </motion.div>
  )
}

// Export helper for badge counts
export function useReminderBadges() {
  const [counts, setCounts] = useState({ overdue: 0, recentlyPaid: 0 })

  useEffect(() => {
    async function fetchCounts() {
      try {
        const res = await fetch("/api/reminders/payments")
        if (res.ok) {
          const data = await res.json()
          const payments = data.payments || []
          
          const today = new Date()
          today.setHours(0, 0, 0, 0)
          
          let overdue = 0
          let recentlyPaid = 0
          
          payments.forEach((p: ReminderPayment) => {
            if (p.status === "pending") {
              const dueDate = new Date(p.due_date)
              dueDate.setHours(0, 0, 0, 0)
              if (dueDate < today) overdue++
            } else if (p.status === "paid" && p.paid_date) {
              const paidDate = new Date(p.paid_date)
              paidDate.setHours(0, 0, 0, 0)
              const daysDiff = Math.ceil((today.getTime() - paidDate.getTime()) / (1000 * 60 * 60 * 24))
              if (daysDiff <= 3) recentlyPaid++
            }
          })
          
          setCounts({ overdue, recentlyPaid })
        }
      } catch {
        // Silently fail
      }
    }
    
    fetchCounts()
    const interval = setInterval(fetchCounts, 60000) // Refresh every minute
    return () => clearInterval(interval)
  }, [])

  return counts
}
