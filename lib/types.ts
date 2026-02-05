export interface Person {
  id: string
  user_id: string
  name: string
  email: string | null
  phone: string | null
  relationship: string | null
  notes: string | null
  running_balance: number
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  user_id: string
  amount: number
  category: string
  description: string | null
  merchant: string | null
  date: string
  paid_by: string
  created_at: string
}

export interface Due {
  id: string
  user_id: string
  person_id: string
  transaction_id: string | null
  amount: number
  status: "pending" | "settled"
  due_date: string | null
  created_at: string
  person?: Person
}

export interface Bill {
  id: string
  user_id: string
  name: string
  amount: number
  due_date: string
  recurring: boolean
  recurrence_pattern: string | null
  status: "pending" | "paid"
  created_at: string
}

export interface Reminder {
  id: string
  user_id: string
  entity_type: "bill" | "due"
  entity_id: string
  remind_at: string
  escalated: boolean
  completed: boolean
  created_at: string
}

export interface Note {
  id: string
  user_id: string
  summary_text: string
  linked_entity: string | null
  created_at: string
}

export interface AIInsights {
  sentiment: string
  category: string
  urgency: string
  suggestion?: string
}

export interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
  aiInsights?: AIInsights
}

export interface ParsedExpense {
  amount?: number
  category?: string
  description?: string
  merchant?: string
  paid_by?: string
  date?: string
}

export interface ParsedBill {
  name?: string
  amount?: number
  due_date?: string
  recurring?: boolean
  recurrence_pattern?: string
}

export interface RecurringReminder {
  id: string
  user_id: string
  name: string
  amount: number
  recurrence_type: "daily" | "weekly" | "monthly" | "yearly"
  recurrence_day: number | null
  next_due_date: string
  category: string
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface ReminderPayment {
  id: string
  user_id: string
  reminder_id: string
  due_date: string
  paid_date: string | null
  amount: number
  status: "pending" | "paid" | "skipped" | "overdue"
  created_at: string
  reminder?: RecurringReminder
}

// JSON output types from AI
export type AIActionType = "i_owe" | "they_owe" | "create_reminder" | "mark_paid" | "question" | "greeting" | "unknown"

export interface AIJsonOutput {
  action: AIActionType
  person?: string
  amount?: number
  description?: string
  category?: string
  // For reminders
  reminder_name?: string
  recurrence_type?: "daily" | "weekly" | "monthly" | "yearly"
  recurrence_day?: number
  // Response
  message: string
}

export interface DashboardData {
  totalSpentThisMonth: number
  topCategory: { category: string; total: number } | null
  outstandingDues: {
    youOwe: { person: string; amount: number }[]
    owedToYou: { person: string; amount: number }[]
  }
  upcomingBills: Bill[]
}
