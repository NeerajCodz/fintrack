import { createClient } from "@/lib/supabase/server"
import type { Person, Transaction, Due, Bill, DashboardData, RecurringReminder, ReminderPayment } from "./types"

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

// ============ ALL DATA FOR LLM ============

export async function getAllDataForLLM(userId: string): Promise<{
  transactionsCSV: string
  duesCSV: string
  billsCSV: string
  peopleCSV: string
}> {
  const supabase = await createClient()

  // Get all transactions
  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", userId)
    .order("date", { ascending: false })
    .limit(100)

  // Get all people with balances
  const { data: people } = await supabase
    .from("people")
    .select("*")
    .eq("user_id", userId)

  // Get pending dues
  const { data: dues } = await supabase
    .from("dues")
    .select("*, person:people(name)")
    .eq("user_id", userId)
    .eq("status", "pending")

  // Get pending bills
  const { data: bills } = await supabase
    .from("bills")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "pending")

  // Format as CSV strings
  const transactionsCSV = transactions && transactions.length > 0
    ? "date,amount,category,merchant,description,paid_by\n" +
      transactions.map(t => 
        `${t.date},${t.amount},${t.category},${t.merchant || ""},${t.description || ""},${t.paid_by}`
      ).join("\n")
    : "No transactions yet"

  const peopleCSV = people && people.length > 0
    ? "name,balance,relationship\n" +
      people.map(p => 
        `${p.name},${p.running_balance},${p.relationship || ""}`
      ).join("\n")
    : "No contacts yet"

  const duesCSV = dues && dues.length > 0
    ? "person,amount,status,due_date\n" +
      dues.map(d => {
        const personName = (d.person as { name?: string })?.name || "Unknown"
        return `${personName},${d.amount},${d.status},${d.due_date || ""}`
      }).join("\n")
    : "No pending dues"

  const billsCSV = bills && bills.length > 0
    ? "name,amount,due_date,recurring\n" +
      bills.map(b => 
        `${b.name},${b.amount},${b.due_date},${b.recurring}`
      ).join("\n")
    : "No pending bills"

  return { transactionsCSV, duesCSV, billsCSV, peopleCSV }
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

// ============ RECURRING REMINDERS ============

export async function createRecurringReminder(
  userId: string,
  data: {
    name: string
    amount: number
    recurrence_type: "daily" | "weekly" | "monthly" | "yearly"
    recurrence_day?: number
    category?: string
    notes?: string
  }
): Promise<RecurringReminder | null> {
  const supabase = await createClient()

  // Calculate next due date based on recurrence
  const now = new Date()
  let nextDueDate = new Date()

  if (data.recurrence_type === "weekly") {
    // recurrence_day is 0-6 (Sunday-Saturday)
    const dayOfWeek = data.recurrence_day ?? 1 // Default to Monday
    const currentDay = now.getDay()
    const daysUntil = (dayOfWeek - currentDay + 7) % 7 || 7
    nextDueDate.setDate(now.getDate() + daysUntil)
  } else if (data.recurrence_type === "monthly") {
    // recurrence_day is 1-31
    const dayOfMonth = data.recurrence_day ?? 1
    nextDueDate = new Date(now.getFullYear(), now.getMonth(), dayOfMonth)
    if (nextDueDate <= now) {
      nextDueDate.setMonth(nextDueDate.getMonth() + 1)
    }
  } else if (data.recurrence_type === "yearly") {
    // recurrence_day is day of year (1-365) - simplified to just add a year
    nextDueDate.setFullYear(now.getFullYear() + 1)
  } else {
    // daily - next day
    nextDueDate.setDate(now.getDate() + 1)
  }

  const { data: reminder, error } = await supabase
    .from("recurring_reminders")
    .insert({
      user_id: userId,
      name: data.name,
      amount: data.amount,
      recurrence_type: data.recurrence_type,
      recurrence_day: data.recurrence_day ?? null,
      next_due_date: nextDueDate.toISOString().split("T")[0],
      category: data.category || "subscription",
      notes: data.notes || null,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    console.error("Error creating recurring reminder:", error)
    return null
  }

  // Create the first pending payment
  await supabase.from("reminder_payments").insert({
    user_id: userId,
    reminder_id: reminder.id,
    due_date: nextDueDate.toISOString().split("T")[0],
    amount: data.amount,
    status: "pending",
  })

  return reminder as RecurringReminder
}

export async function getRecurringReminders(userId: string): Promise<RecurringReminder[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("recurring_reminders")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)
    .order("next_due_date")

  if (error) return []
  return data as RecurringReminder[]
}

export async function getReminderPayments(
  userId: string,
  options?: { reminderId?: string; status?: string }
): Promise<ReminderPayment[]> {
  const supabase = await createClient()

  let query = supabase
    .from("reminder_payments")
    .select("*, reminder:recurring_reminders(*)")
    .eq("user_id", userId)
    .order("due_date", { ascending: false })

  if (options?.reminderId) {
    query = query.eq("reminder_id", options.reminderId)
  }
  if (options?.status) {
    query = query.eq("status", options.status)
  }

  const { data, error } = await query.limit(50)

  if (error) return []
  return data as ReminderPayment[]
}

export async function markReminderPaid(
  paymentId: string,
  userId: string,
  createNextOccurrence: boolean = false
): Promise<{ success: boolean; nextPayment?: ReminderPayment }> {
  const supabase = await createClient()

  // Get the payment and its reminder
  const { data: payment } = await supabase
    .from("reminder_payments")
    .select("*, reminder:recurring_reminders(*)")
    .eq("id", paymentId)
    .eq("user_id", userId)
    .single()

  if (!payment) return { success: false }

  // Mark as paid
  const { error: updateError } = await supabase
    .from("reminder_payments")
    .update({ status: "paid", paid_date: new Date().toISOString().split("T")[0] })
    .eq("id", paymentId)

  if (updateError) return { success: false }

  // Only create next occurrence if explicitly requested
  if (createNextOccurrence) {
    const reminder = payment.reminder as RecurringReminder
    if (reminder && reminder.is_active) {
      const currentDue = new Date(payment.due_date)
      let nextDue = new Date(currentDue)

      if (reminder.recurrence_type === "daily") {
        nextDue.setDate(currentDue.getDate() + 1)
      } else if (reminder.recurrence_type === "weekly") {
        nextDue.setDate(currentDue.getDate() + 7)
      } else if (reminder.recurrence_type === "monthly") {
        nextDue.setMonth(currentDue.getMonth() + 1)
      } else if (reminder.recurrence_type === "yearly") {
        nextDue.setFullYear(currentDue.getFullYear() + 1)
      }

      // Update reminder's next due date
      await supabase
        .from("recurring_reminders")
        .update({ next_due_date: nextDue.toISOString().split("T")[0], updated_at: new Date().toISOString() })
        .eq("id", reminder.id)

      // Create next payment
      const { data: nextPayment } = await supabase
        .from("reminder_payments")
        .insert({
          user_id: userId,
          reminder_id: reminder.id,
          due_date: nextDue.toISOString().split("T")[0],
          amount: reminder.amount,
          status: "pending",
        })
        .select()
        .single()

      return { success: true, nextPayment: nextPayment as ReminderPayment }
    }
  }

  return { success: true }
}

export async function deleteRecurringReminder(reminderId: string, userId: string): Promise<boolean> {
  const supabase = await createClient()

  const { error } = await supabase
    .from("recurring_reminders")
    .update({ is_active: false })
    .eq("id", reminderId)
    .eq("user_id", userId)

  return !error
}

export async function getRemindersForLLM(userId: string): Promise<string> {
  const supabase = await createClient()

  const { data: reminders } = await supabase
    .from("recurring_reminders")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true)

  const { data: pendingPayments } = await supabase
    .from("reminder_payments")
    .select("*, reminder:recurring_reminders(name)")
    .eq("user_id", userId)
    .eq("status", "pending")

  if (!reminders?.length && !pendingPayments?.length) {
    return "No recurring reminders set up"
  }

  let csv = "RECURRING REMINDERS:\nname,amount,recurrence,next_due\n"
  if (reminders) {
    csv += reminders.map(r => `${r.name},${r.amount},${r.recurrence_type},${r.next_due_date}`).join("\n")
  }

  csv += "\n\nPENDING PAYMENTS:\nreminder,amount,due_date,status\n"
  if (pendingPayments) {
    csv += pendingPayments.map(p => {
      const reminderName = (p.reminder as { name?: string })?.name || "Unknown"
      return `${reminderName},${p.amount},${p.due_date},${p.status}`
    }).join("\n")
  }

  return csv
}
