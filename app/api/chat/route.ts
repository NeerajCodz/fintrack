import { createClient } from "@/lib/supabase/server"
import {
  parseExpenseFromText,
  parseBillFromText,
  isSettlementMessage,
  isDashboardRequest,
  formatCurrency,
} from "@/lib/financial-utils"
import {
  getOrCreatePerson,
  updatePersonBalance,
  createTransaction,
  createDue,
  createBill,
  settleDue,
  getPendingDues,
  getPeople,
  getDashboardData,
  createNote,
} from "@/lib/db"
import type { AIInsights } from "@/lib/types"

// AI-powered insight generation
function generateAIInsights(
  type: string,
  amount?: number,
  category?: string,
  context?: Record<string, unknown>
): AIInsights {
  const insights: AIInsights = {
    sentiment: "neutral",
    category: category || "general",
    urgency: "low",
  }

  // Determine sentiment and urgency based on transaction type and amount
  if (type === "expense_logged") {
    insights.sentiment = amount && amount > 1000 ? "concerned" : "positive"
    insights.urgency = amount && amount > 5000 ? "high" : "low"
    
    if (amount && amount > 2000) {
      insights.suggestion = "Large expense. Track carefully."
    }
    
    if (category === "food" && amount && amount > 500) {
      insights.suggestion = "High food spending. Consider meal planning."
    }
  }

  if (type === "due_created" || context?.due) {
    insights.sentiment = "neutral"
    insights.urgency = "medium"
    insights.suggestion = "Remember to settle this soon."
  }

  if (type === "bill_created") {
    insights.sentiment = "informative"
    insights.urgency = "medium"
    insights.suggestion = "Bill tracked. Don't miss the due date."
  }

  if (type === "settlement") {
    insights.sentiment = "positive"
    insights.urgency = "low"
    insights.suggestion = "Good job clearing dues!"
  }

  return insights
}

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { message, context } = await request.json()

  if (!message || typeof message !== "string") {
    return Response.json({ error: "Message required" }, { status: 400 })
  }

  const userId = user.id
  const lowerMessage = message.toLowerCase().trim()

  try {
    // Check if this is a dashboard request
    if (isDashboardRequest(message)) {
      const dashboard = await getDashboardData(userId)
      return Response.json({
        type: "dashboard",
        data: dashboard,
        response: formatDashboardResponse(dashboard),
      })
    }

    // Check if this is a settlement message
    const settlement = isSettlementMessage(message)
    if (settlement.isPaid && settlement.person) {
      return await handleSettlement(userId, settlement.person, settlement.amount)
    }

    // Check if this is a bill
    const billData = parseBillFromText(message)
    if (billData && billData.name) {
      return await handleBill(userId, billData, message, context)
    }

    // Parse as expense
    const expenseData = parseExpenseFromText(message)

    // Handle follow-up amount
    if (context?.pendingExpense && /^\d+(?:\.\d+)?$/.test(lowerMessage)) {
      const amount = parseFloat(lowerMessage)
      return await handlePendingExpenseAmount(userId, context.pendingExpense, amount)
    }

    // Check what's missing
    if (expenseData.paid_by && expenseData.paid_by !== "user") {
      // Someone else paid - need to track due
      if (!expenseData.amount) {
        return Response.json({
          type: "clarification",
          field: "amount",
          response: `How much did ${expenseData.paid_by} pay?`,
          context: {
            pendingExpense: {
              ...expenseData,
              raw: message,
            },
          },
        })
      }

      return await handleOtherPersonPaid(userId, expenseData)
    }

    // User paid or unclear who paid
    if (expenseData.amount) {
      return await handleUserPaid(userId, expenseData)
    }

    // Check if it's a general financial question
    if (/how\s+much|balance|owe|spent/i.test(lowerMessage)) {
      return await handleFinancialQuery(userId, message)
    }

    // Not financial or unclear
    return Response.json({
      type: "unclear",
      response:
        "I didn't catch any financial data in that. Tell me about an expense, bill, or ask for your dashboard.",
    })
  } catch (error) {
    console.error("[v0] Chat processing error:", error)
    return Response.json(
      {
        type: "error",
        response:
          "Database write failed. Try again. If this persists, check your connection.",
      },
      { status: 500 }
    )
  }
}

async function handleOtherPersonPaid(
  userId: string,
  expenseData: ReturnType<typeof parseExpenseFromText>
) {
  const personName = expenseData.paid_by!
  const amount = expenseData.amount!

  // Get or create person
  const person = await getOrCreatePerson(userId, personName)
  if (!person) {
    return Response.json({
      type: "error",
      response: "Failed to store person data. Database error.",
    })
  }

  // Create transaction
  const transaction = await createTransaction(userId, {
    amount,
    category: expenseData.category || "other",
    description: expenseData.description,
    merchant: expenseData.merchant,
    date: expenseData.date,
    paid_by: person.id,
  })

  if (!transaction) {
    return Response.json({
      type: "error",
      response: "Failed to store transaction. Database error.",
    })
  }

  // Create due (user owes this person)
  const due = await createDue(userId, {
    person_id: person.id,
    transaction_id: transaction.id,
    amount,
  })

  if (!due) {
    return Response.json({
      type: "error",
      response: "Transaction stored but failed to create due. Manual fix needed.",
    })
  }

  // Update person's balance (positive means user owes them)
  await updatePersonBalance(person.id, amount)

  // Log note
  await createNote(
    userId,
    `${personName} paid ${formatCurrency(amount)} - you owe`,
    `transaction:${transaction.id}`
  )

  const aiInsights = generateAIInsights("expense_logged", amount, expenseData.category, { due: true })

  return Response.json({
    type: "expense_logged",
    data: { transaction, due, person },
    response: `Logged: ${personName} paid ${formatCurrency(amount)}${
      expenseData.merchant ? ` at ${expenseData.merchant}` : ""
    }. You now owe ${personName} ${formatCurrency(person.running_balance + amount)}.`,
    aiInsights,
  })
}

async function handleUserPaid(
  userId: string,
  expenseData: ReturnType<typeof parseExpenseFromText>
) {
  const amount = expenseData.amount!

  const transaction = await createTransaction(userId, {
    amount,
    category: expenseData.category || "other",
    description: expenseData.description,
    merchant: expenseData.merchant,
    date: expenseData.date,
    paid_by: "user",
  })

  if (!transaction) {
    return Response.json({
      type: "error",
      response: "Failed to store transaction. Database error.",
    })
  }

  await createNote(
    userId,
    `Spent ${formatCurrency(amount)} on ${expenseData.category || "other"}`,
    `transaction:${transaction.id}`
  )

  const aiInsights = generateAIInsights("expense_logged", amount, expenseData.category)

  return Response.json({
    type: "expense_logged",
    data: { transaction },
    response: `Logged: ${formatCurrency(amount)} spent${
      expenseData.category ? ` on ${expenseData.category}` : ""
    }${expenseData.merchant ? ` at ${expenseData.merchant}` : ""}.`,
    aiInsights,
  })
}

async function handlePendingExpenseAmount(
  userId: string,
  pendingExpense: ReturnType<typeof parseExpenseFromText> & { raw: string },
  amount: number
) {
  const fullExpense = { ...pendingExpense, amount }

  if (fullExpense.paid_by && fullExpense.paid_by !== "user") {
    return await handleOtherPersonPaid(userId, fullExpense)
  }

  return await handleUserPaid(userId, fullExpense)
}

async function handleSettlement(
  userId: string,
  personName: string,
  amount?: number
) {
  const people = await getPeople(userId)
  const person = people.find(
    (p) => p.name.toLowerCase() === personName.toLowerCase()
  )

  if (!person) {
    return Response.json({
      type: "error",
      response: `I don't have ${personName} in my records. Check the name.`,
    })
  }

  const pendingDues = await getPendingDues(userId)
  const duesWithPerson = pendingDues.filter((d) => d.person_id === person.id)

  if (duesWithPerson.length === 0) {
    return Response.json({
      type: "info",
      response: `No pending dues with ${personName}.`,
    })
  }

  // Settle dues
  const settleAmount = amount || duesWithPerson.reduce((sum, d) => sum + d.amount, 0)

  for (const due of duesWithPerson) {
    await settleDue(due.id, amount)
  }

  // Update balance
  await updatePersonBalance(person.id, -settleAmount)

  await createNote(
    userId,
    `Settled ${formatCurrency(settleAmount)} with ${personName}`,
    `person:${person.id}`
  )

  const aiInsights = generateAIInsights("settlement", settleAmount)

  return Response.json({
    type: "settlement",
    response: `Settled ${formatCurrency(settleAmount)} with ${personName}. ${
      person.running_balance - settleAmount !== 0
        ? `Remaining balance: ${formatCurrency(Math.abs(person.running_balance - settleAmount))}`
        : "You're square."
    }`,
    aiInsights,
  })
}

async function handleBill(
  userId: string,
  billData: ReturnType<typeof parseBillFromText>,
  originalMessage: string,
  context?: { pendingBill?: Record<string, unknown> }
) {
  // Check for pending bill context
  if (context?.pendingBill) {
    const pending = context.pendingBill as {
      name: string
      amount?: number
      due_date?: string
    }

    // Check if user provided amount
    if (!pending.amount && /^\d+/.test(originalMessage)) {
      billData = {
        ...pending,
        amount: parseFloat(originalMessage.replace(/[^\d.]/g, "")),
      }
    }

    // Check if user provided date
    if (!pending.due_date) {
      const dateMatch = originalMessage.match(/(\d{1,2})[\/\-](\d{1,2})/)
      if (dateMatch) {
        const day = dateMatch[1].padStart(2, "0")
        const month = dateMatch[2].padStart(2, "0")
        const year = new Date().getFullYear()
        billData = { ...billData, due_date: `${year}-${month}-${day}` }
      }
    }
  }

  if (!billData?.amount) {
    return Response.json({
      type: "clarification",
      field: "amount",
      response: `How much is the ${billData?.name || "bill"}?`,
      context: {
        pendingBill: billData,
      },
    })
  }

  if (!billData.due_date) {
    return Response.json({
      type: "clarification",
      field: "due_date",
      response: `When is the ${billData.name} due? (DD/MM or DD/MM/YYYY)`,
      context: {
        pendingBill: billData,
      },
    })
  }

  const bill = await createBill(userId, {
    name: billData.name!,
    amount: billData.amount,
    due_date: billData.due_date,
    recurring: billData.recurring,
    recurrence_pattern: billData.recurrence_pattern,
  })

  if (!bill) {
    return Response.json({
      type: "error",
      response: "Failed to store bill. Database error.",
    })
  }

  await createNote(
    userId,
    `Bill added: ${billData.name} - ${formatCurrency(billData.amount)} due ${billData.due_date}`,
    `bill:${bill.id}`
  )

  const aiInsights = generateAIInsights("bill_created", billData.amount, "bill")

  return Response.json({
    type: "bill_created",
    data: { bill },
    response: `Bill added: ${billData.name} for ${formatCurrency(billData.amount)}, due ${billData.due_date}.${
      billData.recurring ? ` Recurring ${billData.recurrence_pattern || "monthly"}.` : ""
    } I'll remind you.`,
    aiInsights,
  })
}

async function handleFinancialQuery(userId: string, message: string) {
  const dashboard = await getDashboardData(userId)
  const lowerMessage = message.toLowerCase()

  if (/who.*owe|what.*owe/i.test(lowerMessage)) {
    const { youOwe, owedToYou } = dashboard.outstandingDues

    let response = ""
    if (youOwe.length > 0) {
      response += "You owe:\n"
      youOwe.forEach((d) => {
        response += `- ${d.person}: ${formatCurrency(d.amount)}\n`
      })
    }
    if (owedToYou.length > 0) {
      response += "\nOwed to you:\n"
      owedToYou.forEach((d) => {
        response += `- ${d.person}: ${formatCurrency(d.amount)}\n`
      })
    }
    if (youOwe.length === 0 && owedToYou.length === 0) {
      response = "No outstanding dues. Clean slate."
    }

    return Response.json({ type: "query", response })
  }

  return Response.json({
    type: "dashboard",
    data: dashboard,
    response: formatDashboardResponse(dashboard),
  })
}

function formatDashboardResponse(dashboard: ReturnType<typeof getDashboardData> extends Promise<infer T> ? T : never): string {
  let response = "--- DASHBOARD ---\n\n"

  response += `SPENT THIS MONTH: ${formatCurrency(dashboard.totalSpentThisMonth)}\n`

  if (dashboard.topCategory) {
    response += `TOP CATEGORY: ${dashboard.topCategory.category} (${formatCurrency(dashboard.topCategory.total)})\n`
  }

  response += "\nDUES:\n"
  const { youOwe, owedToYou } = dashboard.outstandingDues

  if (youOwe.length === 0 && owedToYou.length === 0) {
    response += "  No outstanding dues.\n"
  } else {
    if (youOwe.length > 0) {
      response += "  You owe:\n"
      youOwe.forEach((d) => {
        response += `    - ${d.person}: ${formatCurrency(d.amount)}\n`
      })
    }
    if (owedToYou.length > 0) {
      response += "  Owed to you:\n"
      owedToYou.forEach((d) => {
        response += `    - ${d.person}: ${formatCurrency(d.amount)}\n`
      })
    }
  }

  response += "\nUPCOMING BILLS (7 DAYS):\n"
  if (dashboard.upcomingBills.length === 0) {
    response += "  None.\n"
  } else {
    dashboard.upcomingBills.forEach((b) => {
      response += `  - ${b.name}: ${formatCurrency(b.amount)} (due ${b.due_date})\n`
    })
  }

  return response
}
