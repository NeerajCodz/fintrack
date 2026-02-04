import { createClient } from "@/lib/supabase/server"
import type { Person, Transaction, Due, Bill, DashboardData } from "./types"

// ============ PEOPLE ============

export async function getOrCreatePerson(
  userId: string,
  name: string,
  relationship?: string
): Promise<Person | null> {
  const supabase = await createClient()
  const normalizedName = name.toLowerCase().trim()

  // Check if person exists
  const { data: existing } = await supabase
    .from("people")
    .select("*")
    .eq("user_id", userId)
    .ilike("name", normalizedName)
    .single()

  if (existing) return existing as Person

  // Create new person
  const { data: newPerson, error } = await supabase
    .from("people")
    .insert({
      user_id: userId,
      name: normalizedName,
      relationship: relationship || null,
      running_balance: 0,
    })
    .select()
    .single()

  if (error) {
    // Person creation failed
    return null
  }

  return newPerson as Person
}

export async function updatePersonBalance(
  personId: string,
  amountDelta: number
): Promise<boolean> {
  const supabase = await createClient()

  const { data: person } = await supabase
    .from("people")
    .select("running_balance")
    .eq("id", personId)
    .single()

  if (!person) return false

  const newBalance = (person.running_balance || 0) + amountDelta

  const { error } = await supabase
    .from("people")
    .update({ running_balance: newBalance })
    .eq("id", personId)

  return !error
}

export async function getPeople(userId: string): Promise<Person[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("people")
    .select("*")
    .eq("user_id", userId)
    .order("name")

  if (error) return []
  return data as Person[]
}

// ============ TRANSACTIONS ============

export async function createTransaction(
  userId: string,
  data: {
    amount: number
    category: string
    description?: string
    merchant?: string
    date?: string
    paid_by: string
  }
): Promise<Transaction | null> {
  const supabase = await createClient()

  const { data: transaction, error } = await supabase
    .from("transactions")
    .insert({
      user_id: userId,
      amount: data.amount,
      category: data.category,
      description: data.description || null,
      merchant: data.merchant || null,
      date: data.date || new Date().toISOString().split("T")[0],
      paid_by: data.paid_by,
    })
    .select()
    .single()

  if (error) {
    // Transaction creation failed
    return null
  }

  return transaction as Transaction
}

export async function getTransactions(
  userId: string,
  options?: { startDate?: string; endDate?: string; limit?: number }
): Promise<Transaction[]> {
  const supabase = await createClient()

  let query = supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })

  if (options?.startDate) {
    query = query.gte("date", options.startDate)
  }
  if (options?.endDate) {
    query = query.lte("date", options.endDate)
  }
  if (options?.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query

  if (error) return []
  return data as Transaction[]
}

// ============ DUES ============

export async function createDue(
  userId: string,
  data: {
    person_id: string
    transaction_id?: string
    amount: number
    due_date?: string
  }
): Promise<Due | null> {
  const supabase = await createClient()

  const { data: due, error } = await supabase
    .from("dues")
    .insert({
      user_id: userId,
      person_id: data.person_id,
      transaction_id: data.transaction_id || null,
      amount: data.amount,
      status: "pending",
      due_date: data.due_date || null,
    })
    .select()
    .single()

  if (error) {
    // Due creation failed
    return null
  }

  return due as Due
}

export async function settleDue(
  dueId: string,
  partialAmount?: number
): Promise<boolean> {
  const supabase = await createClient()

  if (partialAmount !== undefined) {
    const { data: due } = await supabase
      .from("dues")
      .select("amount")
      .eq("id", dueId)
      .single()

    if (!due) return false

    const remaining = due.amount - partialAmount
    if (remaining <= 0) {
      const { error } = await supabase
        .from("dues")
        .update({ status: "settled", amount: 0 })
        .eq("id", dueId)
      return !error
    } else {
      const { error } = await supabase
        .from("dues")
        .update({ amount: remaining })
        .eq("id", dueId)
      return !error
    }
  }

  const { error } = await supabase
    .from("dues")
    .update({ status: "settled" })
    .eq("id", dueId)

  return !error
}

export async function getPendingDues(userId: string): Promise<Due[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("dues")
    .select("*, person:people(*)")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })

  if (error) return []
  return data as Due[]
}

// ============ BILLS ============

export async function createBill(
  userId: string,
  data: {
    name: string
    amount: number
    due_date: string
    recurring?: boolean
    recurrence_pattern?: string
  }
): Promise<Bill | null> {
  const supabase = await createClient()

  const { data: bill, error } = await supabase
    .from("bills")
    .insert({
      user_id: userId,
      name: data.name,
      amount: data.amount,
      due_date: data.due_date,
      recurring: data.recurring || false,
      recurrence_pattern: data.recurrence_pattern || null,
      status: "pending",
    })
    .select()
    .single()

  if (error) {
    // Bill creation failed
    return null
  }

  return bill as Bill
}

export async function markBillPaid(billId: string): Promise<boolean> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("bills")
    .update({ status: "paid" })
    .eq("id", billId)

  return !error
}

export async function getUpcomingBills(
  userId: string,
  daysAhead = 7
): Promise<Bill[]> {
  const supabase = await createClient()
  const today = new Date().toISOString().split("T")[0]
  const futureDate = new Date()
  futureDate.setDate(futureDate.getDate() + daysAhead)
  const futureDateStr = futureDate.toISOString().split("T")[0]

  const { data, error } = await supabase
    .from("bills")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .gte("due_date", today)
    .lte("due_date", futureDateStr)
    .order("due_date")

  if (error) return []
  return data as Bill[]
}

export async function getPendingBills(userId: string): Promise<Bill[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("bills")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("due_date")

  if (error) return []
  return data as Bill[]
}

// ============ NOTES ============

export async function createNote(
  userId: string,
  summaryText: string,
  linkedEntity?: string
): Promise<boolean> {
  const supabase = await createClient()

  const { error } = await supabase.from("notes").insert({
    user_id: userId,
    summary_text: summaryText,
    linked_entity: linkedEntity || null,
  })

  return !error
}

// ============ DASHBOARD ============

export async function getDashboardData(userId: string): Promise<DashboardData> {
  const supabase = await createClient()

  // Get current month boundaries
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0]
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0]

  // Total spent this month (where user paid)
  const { data: monthTransactions } = await supabase
    .from("transactions")
    .select("amount, category")
    .eq("user_id", userId)
    .eq("paid_by", "user")
    .gte("date", startOfMonth)
    .lte("date", endOfMonth)

  const totalSpentThisMonth =
    monthTransactions?.reduce((sum, t) => sum + t.amount, 0) || 0

  // Top category
  const categoryTotals: Record<string, number> = {}
  monthTransactions?.forEach((t) => {
    categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount
  })

  const topCategory = Object.entries(categoryTotals).sort(
    (a, b) => b[1] - a[1]
  )[0]

  // Outstanding dues
  const { data: people } = await supabase
    .from("people")
    .select("name, running_balance")
    .eq("user_id", userId)
    .neq("running_balance", 0)

  const youOwe: { person: string; amount: number }[] = []
  const owedToYou: { person: string; amount: number }[] = []

  people?.forEach((p) => {
    if (p.running_balance > 0) {
      // Positive balance means user owes this person
      youOwe.push({ person: p.name, amount: p.running_balance })
    } else if (p.running_balance < 0) {
      // Negative balance means this person owes user
      owedToYou.push({ person: p.name, amount: Math.abs(p.running_balance) })
    }
  })

  // Upcoming bills (7 days)
  const upcomingBills = await getUpcomingBills(userId, 7)

  return {
    totalSpentThisMonth,
    topCategory: topCategory
      ? { category: topCategory[0], total: topCategory[1] }
      : null,
    outstandingDues: { youOwe, owedToYou },
    upcomingBills,
  }
}
