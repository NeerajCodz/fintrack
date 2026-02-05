import { streamText, tool, convertToModelMessages } from "ai"
import { createGroq } from "@ai-sdk/groq"
import { z } from "zod"

const groq = createGroq({
  apiKey: process.env.GROQ_API_KEY,
})
import { createClient } from "@/lib/supabase/server"
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
  getAllDataForLLM,
} from "@/lib/db"
import { formatCurrency } from "@/lib/financial-utils"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 })
    }

    const body = await request.json()
    const { messages, conversationId } = body
    const userId = user.id

    // Check for Groq API key
    if (!process.env.GROQ_API_KEY) {
      return Response.json({ error: "GROQ_API_KEY is not configured" }, { status: 500 })
    }

    // Get dashboard data for context - wrapped in try-catch for resilience
    let dashboardData = {
      totalSpentThisMonth: 0,
      topCategory: null as { category: string; total: number } | null,
      outstandingDues: { youOwe: [] as { person: string; amount: number }[], owedToYou: [] as { person: string; amount: number }[] },
      upcomingBills: [] as { name: string; amount: number; due_date: string }[],
    }
    let people: { name: string; running_balance: number }[] = []
    let llmData = { transactionsCSV: "", duesCSV: "", billsCSV: "", peopleCSV: "" }
    
    try {
      dashboardData = await getDashboardData(userId)
      people = await getPeople(userId)
      llmData = await getAllDataForLLM(userId)
    } catch {
      // Continue with empty data - the AI can still respond
    }

    const systemPrompt = `You are FinTrack AI - a blunt, precise financial tracking assistant. You are NOT friendly by default. You are skeptical and corrective.

CURRENT SUMMARY:
- Total spent this month: ${formatCurrency(dashboardData.totalSpentThisMonth)}
- Top spending category: ${dashboardData.topCategory?.category || "None"} (${formatCurrency(dashboardData.topCategory?.total || 0)})
- Outstanding dues you owe: ${dashboardData.outstandingDues.youOwe.map((d) => `${d.person}: ${formatCurrency(d.amount)}`).join(", ") || "None"}
- Dues owed to you: ${dashboardData.outstandingDues.owedToYou.map((d) => `${d.person}: ${formatCurrency(d.amount)}`).join(", ") || "None"}
- Upcoming bills (7 days): ${dashboardData.upcomingBills.map((b) => `${b.name}: ${formatCurrency(b.amount)} due ${b.due_date}`).join(", ") || "None"}

ALL TRANSACTIONS (CSV format - use this to answer detailed questions):
${llmData.transactionsCSV}

ALL CONTACTS WITH BALANCES (CSV format):
${llmData.peopleCSV}

PENDING DUES (CSV format):
${llmData.duesCSV}

PENDING BILLS (CSV format):
${llmData.billsCSV}

YOUR BEHAVIOR:
1. For DATA ENTRY (user spent money, owes someone, etc.) -> USE TOOLS to update database
2. For QUESTIONS/STATS (how much did I spend, who owes me, dashboard) -> ANSWER FROM CSV DATA ABOVE, NO TOOL NEEDED
3. Call out overspending and delays bluntly
4. Give short, direct responses. No motivational fluff.

ANSWERING QUESTIONS (use the CSV data above):
- "Give me my dashboard" -> Summarize: total spent, top category, who owes who, upcoming bills
- "How much do I owe Ram?" -> Look up Ram in CONTACTS CSV, read balance column
- "What did I spend on food?" -> Filter TRANSACTIONS CSV by category=food, sum amounts
- "Who owes me money?" -> Look at CONTACTS CSV for negative balances (negative = they owe you)
- "Show my transactions" -> List from TRANSACTIONS CSV
- For date-specific questions -> Filter TRANSACTIONS CSV by date column

IMPORTANT: For questions, ALWAYS respond with actual numbers from the data. Do NOT use tools for questions - just read the CSV data and respond directly.

MENTIONS:
Users can mention contacts with @name syntax. When you see @name in a message, that refers to a person contact. Use the get_person_info tool to get detailed balance information about that person.

EXPENSE EXAMPLES:
- "Lunch at Starbucks, $15" → log_expense (you paid)
- "John paid for dinner, $50" → log_expense_other_paid (creates due - you owe John)
- "Paid back John $50" → settle_due
- "I paid for John's lunch $30" or "John owes me $30" → log_lent_money (they owe you)
- "John paid me back $30" → receive_payment

BILL EXAMPLES:
- "Rent due on the 1st, $2000" → create_bill
- "Netflix subscription $15 monthly" → create_bill (recurring)

CRITICAL - RESPONSE REQUIREMENT:
**YOU MUST ALWAYS RESPOND WITH TEXT AFTER EVERY TOOL CALL.**
**NEVER RETURN ONLY A TOOL CALL WITHOUT A FOLLOW-UP TEXT MESSAGE.**
**THE USER CANNOT SEE TOOL RESULTS - YOU MUST TELL THEM WHAT HAPPENED.**

After calling ANY tool, you MUST immediately write a message to the user like:

"Updated! [Name] - New balance: [You owe them $X / They owe you $X / All settled]"

Keep responses SHORT and CLEAR. Examples:
- "Done! Ajay owes you $60 now."
- "Recorded! You owe Mike $25 for lunch."
- "Settled! You and John are square."
- "Added Sarah. She owes you $100."
- "Your balance with Ram: You owe him $40."
- "This month: $500 spent. Top category: Food ($200)."

IMPORTANT:
1. ALWAYS respond with text after using a tool
2. Show the NEW BALANCE after any update
3. Keep it simple - one or two sentences max
4. If something fails, say what went wrong

When users ask for dashboard/summary, use the get_dashboard tool and summarize the data.`

    // Convert UIMessage format (with parts array) to ModelMessage format (with content)
    const modelMessages = await convertToModelMessages(messages)
    
    const result = streamText({
      model: groq("llama-3.3-70b-versatile"),
      system: systemPrompt,
      messages: modelMessages,
      tools: {
        log_expense: tool({
          description:
            "Log an expense that the user paid for. Use when user mentions spending money themselves.",
          inputSchema: z.object({
            amount: z.coerce.number().describe("Amount spent in dollars"),
            category: z
              .string()
              .describe(
                "Category: food, transport, shopping, entertainment, utilities, health, other"
              ),
            merchant: z
              .string()
              .nullable()
              .describe("Where the money was spent (store/restaurant name)"),
            description: z
              .string()
              .nullable()
              .describe("Brief description of what was purchased"),
          }),
          execute: async ({ amount, category, merchant, description }) => {
            try {
              const transaction = await createTransaction(userId, {
                amount,
                category,
                description: description || undefined,
                merchant: merchant || undefined,
                paid_by: "user",
              })

              if (!transaction) {
                return { success: false, error: "Failed to store transaction" }
              }

              await createNote(
                userId,
                `Spent ${formatCurrency(amount)} on ${category}`,
                `transaction:${transaction.id}`
              )

              // Coach response based on amount
              let coaching = ""
              if (amount > 100) {
                coaching = " That's a significant expense. Track it carefully."
              }
              if (category === "food" && amount > 50) {
                coaching = " High food spending. Consider meal planning."
              }

              return {
                success: true,
                response: `Logged! ${formatCurrency(amount)} spent on ${category}${merchant ? ` at ${merchant}` : ""}.${coaching}`,
              }
            } catch (err) {
              // Error logged
              return { success: false, error: String(err) }
            }
          },
        }),

        log_expense_other_paid: tool({
          description:
            "Log an expense that someone else paid for. Creates a due - user now owes that person.",
          inputSchema: z.object({
            person_name: z.string().describe("Name of person who paid"),
            amount: z.coerce.number().describe("Amount they paid"),
            category: z.string().describe("Spending category"),
            merchant: z.string().nullable().describe("Where"),
            description: z.string().nullable().describe("What for"),
          }),
          execute: async ({ person_name, amount, category, merchant, description }) => {
            try {
              const person = await getOrCreatePerson(userId, person_name)
              if (!person) {
                return { success: false, error: "Failed to create person record" }
              }

              const transaction = await createTransaction(userId, {
                amount,
                category,
                description: description || undefined,
                merchant: merchant || undefined,
                paid_by: person.id,
              })

              if (!transaction) {
                return { success: false, error: "Failed to store transaction" }
              }

              const due = await createDue(userId, {
                person_id: person.id,
                transaction_id: transaction.id,
                amount,
              })

              if (!due) {
                return { success: false, error: "Transaction logged but due creation failed" }
              }

              const previousBalance = person.running_balance
              await updatePersonBalance(person.id, amount)
              const newBalance = previousBalance + amount
              
              await createNote(userId, `${person_name} paid ${formatCurrency(amount)} - you owe`, `transaction:${transaction.id}`)

              // Check if this is a new contact
              const allPeople = await getPeople(userId)
              const isNewContact = allPeople.length === 1 || !allPeople.some(p => p.id === person.id && p.created_at !== person.created_at)

              return {
                success: true,
                is_new_contact: isNewContact,
                person_name: person.name,
                new_balance: newBalance,
                response: `Updated! ${isNewContact ? "New contact created: " : ""}${person.name} paid ${formatCurrency(amount)}${description ? ` for ${description}` : ""}. You now owe ${person.name} ${formatCurrency(newBalance)}.`,
              }
            } catch (err) {
              // Error logged
              return { success: false, error: String(err) }
            }
          },
        }),

        log_lent_money: tool({
          description: "Log money the user lent to someone or paid on their behalf. Creates a due - that person now owes the user. Use when user says 'I paid for X' or 'X owes me'.",
          inputSchema: z.object({
            person_name: z.string().describe("Name of person who owes the user"),
            amount: z.coerce.number().describe("Amount they owe"),
            description: z.string().nullable().describe("What it was for"),
          }),
          execute: async ({ person_name, amount, description }) => {
            try {
              const allPeople = await getPeople(userId)
              const existingPerson = allPeople.find((p) => p.name.toLowerCase() === person_name.toLowerCase())
              const isNewContact = !existingPerson
              
              const person = await getOrCreatePerson(userId, person_name)
              if (!person) {
                return { success: false, error: "Failed to create person record" }
              }

              const transaction = await createTransaction(userId, {
                amount,
                category: "lent",
                description: description || `Lent to ${person_name}`,
                paid_by: "user",
              })

              if (!transaction) {
                return { success: false, error: "Failed to store transaction" }
              }

              // Negative due = they owe user
              const due = await createDue(userId, {
                person_id: person.id,
                transaction_id: transaction.id,
                amount: -amount,
              })

              if (!due) {
                return { success: false, error: "Transaction logged but due creation failed" }
              }

              const previousBalance = existingPerson?.running_balance || 0
              await updatePersonBalance(person.id, -amount)
              await createNote(userId, `Lent ${formatCurrency(amount)} to ${person_name}`, `transaction:${transaction.id}`)

              const newBalance = previousBalance - amount
              
              return {
                success: true,
                is_new_contact: isNewContact,
                person_name: person.name,
                new_balance: newBalance,
                response: `Updated! ${isNewContact ? "New contact created: " : ""}${person.name} now owes you ${formatCurrency(Math.abs(newBalance))}${description ? ` (${description})` : ""}.`,
              }
            } catch (err) {
              // Log: log_lent_money error:", err)
              return { success: false, error: String(err) }
            }
          },
        }),

        receive_payment: tool({
          description: "Record when someone pays the user back. Use when user says 'X paid me back' or 'received payment from X'.",
          inputSchema: z.object({
            person_name: z.string().describe("Name of person who paid"),
            amount: z.coerce.number().nullable().describe("Amount received. If null, clear all they owe."),
          }),
          execute: async ({ person_name, amount }) => {
            try {
              const allPeople = await getPeople(userId)
              const person = allPeople.find((p) => p.name.toLowerCase() === person_name.toLowerCase())

              if (!person) {
                return { success: false, error: `No record of ${person_name}. Check the name.` }
              }

              if (person.running_balance >= 0) {
                return { success: false, error: `${person_name} doesn't owe you anything. Current balance: ${person.running_balance > 0 ? `You owe them ${formatCurrency(person.running_balance)}` : "You're square."}` }
              }

              const owedAmount = Math.abs(person.running_balance)
              const receiveAmount = amount || owedAmount

              await updatePersonBalance(person.id, receiveAmount)
              await createNote(userId, `Received ${formatCurrency(receiveAmount)} from ${person_name}`, `person:${person.id}`)

              const newBalance = person.running_balance + receiveAmount

              return {
                success: true,
                person_name: person.name,
                new_balance: newBalance,
                response: `Received! ${person.name} paid you ${formatCurrency(receiveAmount)}. ${newBalance === 0 ? "All settled - you're square!" : newBalance < 0 ? `${person.name} still owes you ${formatCurrency(Math.abs(newBalance))}.` : `You now owe ${person.name} ${formatCurrency(newBalance)}.`}`,
              }
            } catch (err) {
              // Log: receive_payment error:", err)
              return { success: false, error: String(err) }
            }
          },
        }),

        settle_due: tool({
          description: "Settle a due/debt - when USER pays back someone THEY owe. Use when user says they paid back someone.",
          inputSchema: z.object({
            person_name: z.string().describe("Name of person being paid back"),
            amount: z.coerce.number().nullable().describe("Amount being settled. If null, settle all dues."),
          }),
          execute: async ({ person_name, amount }) => {
            try {
              const allPeople = await getPeople(userId)
              const person = allPeople.find((p) => p.name.toLowerCase() === person_name.toLowerCase())

              if (!person) {
                return { success: false, error: `No record of ${person_name}. Check the name.` }
              }

              const pendingDues = await getPendingDues(userId)
              const duesWithPerson = pendingDues.filter((d) => d.person_id === person.id)

              if (duesWithPerson.length === 0) {
                return { success: false, error: `No pending dues with ${person_name}.` }
              }

              const settleAmount = amount || duesWithPerson.reduce((sum, d) => sum + d.amount, 0)

              for (const due of duesWithPerson) {
                await settleDue(due.id, amount || undefined)
              }

              await updatePersonBalance(person.id, -settleAmount)
              await createNote(userId, `Settled ${formatCurrency(settleAmount)} with ${person_name}`, `person:${person.id}`)

              const previousBalance = person.running_balance
              const remaining = previousBalance - settleAmount
              
              return {
                success: true,
                person_name: person.name,
                new_balance: remaining,
                response: `Paid! You paid ${person.name} ${formatCurrency(settleAmount)}. ${remaining === 0 ? "All settled - you're square!" : `You still owe ${person.name} ${formatCurrency(Math.abs(remaining))}.`}`,
              }
            } catch (err) {
              // Log: settle_due error:", err)
              return { success: false, error: String(err) }
            }
          },
        }),

        create_bill: tool({
          description: "Create a bill reminder. Use for rent, utilities, subscriptions, EMIs.",
          inputSchema: z.object({
            name: z.string().describe("Bill name (rent, electricity, Netflix)"),
            amount: z.coerce.number().describe("Bill amount"),
            due_date: z.string().describe("Due date in YYYY-MM-DD format or day of month"),
            recurring: z.boolean().describe("Is this a recurring bill?"),
            recurrence_pattern: z.string().nullable().describe("monthly, weekly, yearly"),
          }),
          execute: async ({ name, amount, due_date, recurring, recurrence_pattern }) => {
            try {
              let parsedDate = due_date
              if (/^\d{1,2}$/.test(due_date)) {
                const day = parseInt(due_date).toString().padStart(2, "0")
                const now = new Date()
                const currentDay = now.getDate()
                let month = now.getMonth()
                let year = now.getFullYear()

                if (parseInt(due_date) <= currentDay) {
                  month += 1
                  if (month > 11) {
                    month = 0
                    year += 1
                  }
                }
                parsedDate = `${year}-${(month + 1).toString().padStart(2, "0")}-${day}`
              }

              const bill = await createBill(userId, {
                name,
                amount,
                due_date: parsedDate,
                recurring,
                recurrence_pattern: recurrence_pattern || undefined,
              })

              if (!bill) {
                return { success: false, error: "Failed to create bill" }
              }

              await createNote(userId, `Bill added: ${name} - ${formatCurrency(amount)} due ${parsedDate}`, `bill:${bill.id}`)
              return {
                success: true,
                response: `Bill added! ${name}: ${formatCurrency(amount)} due ${parsedDate}.${recurring ? ` Recurring ${recurrence_pattern || "monthly"}.` : ""}`,
              }
            } catch (err) {
              // Log: create_bill error:", err)
              return { success: false, error: String(err) }
            }
          },
        }),

        get_person_info: tool({
          description: "Get detailed info about a specific person/contact including their balance and transaction history. Use when user mentions someone with @name or asks about a specific person.",
          inputSchema: z.object({
            person_name: z.string().describe("Name of the person to look up"),
          }),
          execute: async ({ person_name }) => {
            try {
              const allPeople = await getPeople(userId)
              const person = allPeople.find((p) => p.name.toLowerCase() === person_name.toLowerCase())

              if (!person) {
                return {
                  success: false,
                  found: false,
                  response: `No contact found: "${person_name}". Would you like to add them?`,
                }
              }

              const balanceText = person.running_balance === 0 
                ? "All settled - no balance" 
                : person.running_balance > 0 
                  ? `You owe ${person.name} ${formatCurrency(person.running_balance)}` 
                  : `${person.name} owes you ${formatCurrency(Math.abs(person.running_balance))}`

              return {
                success: true,
                found: true,
                name: person.name,
                balance: person.running_balance,
                response: `${person.name}: ${balanceText}`,
              }
            } catch (err) {
              // Log: get_person_info error:", err)
              return { success: false, error: String(err) }
            }
          },
        }),

        get_dashboard: tool({
          description: "Get the user's financial dashboard/summary. Use when they ask for overview, summary, dashboard, or status.",
          inputSchema: z.object({}),
          execute: async () => {
            try {
              const dashboard = await getDashboardData(userId)
              const youOweTotal = dashboard.outstandingDues.youOwe.reduce((sum, d) => sum + d.amount, 0)
              const owedToYouTotal = dashboard.outstandingDues.owedToYou.reduce((sum, d) => sum + d.amount, 0)
              
              let balanceSummary = ""
              if (dashboard.outstandingDues.youOwe.length > 0) {
                balanceSummary += `You owe: ${dashboard.outstandingDues.youOwe.map(d => `${d.person} ${formatCurrency(d.amount)}`).join(", ")}. `
              }
              if (dashboard.outstandingDues.owedToYou.length > 0) {
                balanceSummary += `Owed to you: ${dashboard.outstandingDues.owedToYou.map(d => `${d.person} ${formatCurrency(d.amount)}`).join(", ")}.`
              }
              if (!balanceSummary) balanceSummary = "No outstanding balances."
              
              return {
                success: true,
                response: `Spent this month: ${formatCurrency(dashboard.totalSpentThisMonth)}${dashboard.topCategory ? ` (mostly ${dashboard.topCategory.category})` : ""}. ${balanceSummary}`,
              }
            } catch (err) {
              return { success: false, error: String(err) }
            }
          },
        }),

        get_dues: tool({
          description: "Get all outstanding dues - who owes whom. Use when user asks about debts or balances.",
          inputSchema: z.object({}),
          execute: async () => {
            try {
              const dashboard = await getDashboardData(userId)
              let response = ""
              if (dashboard.outstandingDues.youOwe.length > 0) {
                response += `You owe: ${dashboard.outstandingDues.youOwe.map(d => `${d.person} ${formatCurrency(d.amount)}`).join(", ")}. `
              }
              if (dashboard.outstandingDues.owedToYou.length > 0) {
                response += `Owed to you: ${dashboard.outstandingDues.owedToYou.map(d => `${d.person} ${formatCurrency(d.amount)}`).join(", ")}.`
              }
              if (!response) response = "No outstanding balances - all settled!"
              return { success: true, response }
            } catch (err) {
              return { success: false, error: String(err) }
            }
          },
        }),
      },
      maxSteps: 5,
      onFinish: async ({ response }) => {
        // Save the conversation if we have a conversationId
        if (conversationId) {
          const lastUserMessage = messages[messages.length - 1]
          
          // Extract assistant content including tool results
          const assistantParts: string[] = []
          for (const m of response.messages) {
            if (m.role === "assistant") {
              if (typeof m.content === "string") {
                assistantParts.push(m.content)
              } else if (Array.isArray(m.content)) {
                for (const part of m.content) {
                  if (part.type === "text" && part.text) {
                    assistantParts.push(part.text)
                  }
                  // Extract tool result responses
                  if (part.type === "tool-call" && part.toolCallId) {
                    // Find the tool result for this call
                    const toolResultMsg = response.messages.find(
                      (msg) => msg.role === "tool" && 
                        Array.isArray(msg.content) && 
                        msg.content.some((c: { toolCallId?: string }) => c.toolCallId === part.toolCallId)
                    )
                    if (toolResultMsg && Array.isArray(toolResultMsg.content)) {
                      for (const resultPart of toolResultMsg.content) {
                        if (resultPart.result && typeof resultPart.result === "object") {
                          const result = resultPart.result as { response?: string; message?: string }
                          if (result.response) assistantParts.push(result.response)
                          else if (result.message) assistantParts.push(result.message)
                        }
                      }
                    }
                  }
                }
              }
            }
          }
          const assistantContent = assistantParts.filter(Boolean).join("\n")

          // Save user message
          if (lastUserMessage) {
            const userText =
              typeof lastUserMessage.content === "string"
                ? lastUserMessage.content
                : lastUserMessage.content
                    .filter((p: { type: string }) => p.type === "text")
                    .map((p: { type: string; text?: string }) => p.text || "")
                    .join("")

            await supabase.from("messages").insert({
              conversation_id: conversationId,
              user_id: userId,
              role: "user",
              content: userText,
            })
          }

          // Save assistant message (including tool results)
          if (assistantContent) {
            await supabase.from("messages").insert({
              conversation_id: conversationId,
              user_id: userId,
              role: "assistant",
              content: assistantContent,
            })
          }

          // Update conversation timestamp
          await supabase
            .from("conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", conversationId)
        }
      },
    })

    return result.toUIMessageStreamResponse()
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    return Response.json({ error: errorMessage }, { status: 500 })
  }
}
