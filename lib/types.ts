export interface Person {
  id: string
  user_id: string
  name: string
  relationship: string | null
  running_balance: number
  created_at: string
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

export interface DashboardData {
  totalSpentThisMonth: number
  topCategory: { category: string; total: number } | null
  outstandingDues: {
    youOwe: { person: string; amount: number }[]
    owedToYou: { person: string; amount: number }[]
  }
  upcomingBills: Bill[]
}
