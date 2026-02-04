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
    
    try {
      dashboardData = await getDashboardData(userId)
      people = await getPeople(userId)
    } catch {
      // Continue with empty data - the AI can still respond
    }

    const systemPrompt = `You are FinTrack AI - a blunt, precise financial tracking assistant. You are NOT friendly by default. You are skeptical and corrective.

CURRENT USER CONTEXT:
- Total spent this month: ${formatCurrency(dashboardData.totalSpentThisMonth)}
- Top spending category: ${dashboardData.topCategory?.category || "None"} (${formatCurrency(dashboardData.topCategory?.total || 0)})
- People tracked: ${people.map((p) => `${p.name} (balance: ${formatCurrency(p.running_balance)})`).join(", ") || "None"}
- Outstanding dues you owe: ${dashboardData.outstandingDues.youOwe.map((d) => `${d.person}: ${formatCurrency(d.amount)}`).join(", ") || "None"}
- Dues owed to you: ${dashboardData.outstandingDues.owedToYou.map((d) => `${d.person}: ${formatCurrency(d.amount)}`).join(", ") || "None"}
- Upcoming bills (7 days): ${dashboardData.upcomingBills.map((b) => `${b.name}: ${formatCurrency(b.amount)} due ${b.due_date}`).join(", ") || "None"}

YOUR BEHAVIOR:
1. Track expenses, bills, and dues conversationally
2. Call out overspending and delays bluntly
3. Question choices when amounts seem high
4. Never auto-settle dues - they persist until explicitly cleared
5. If something involves money, use the tools to store it in the database
6. Give short, direct responses. No motivational fluff.

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

Keep responses SHORT and CLEAR:
- "Done! Ajay owes you $60 now."
- "Recorded! You owe Mike $25 for lunch."
- "Settled! You and John are square."
- "Added contact: Sarah. She owes you $100."

EXAMPLE 1 - "Ajay owes me 60 for dinner":
---
CONTACT: Ajay - Existing Contact
ACTION: Recorded that Ajay borrowed money from you
AMOUNT: $60.00 (Reason: dinner)
RESULT: Ajay owes you $60.00
STATUS: SUCCESS - Transaction saved to database
---

EXAMPLE 2 - "@John paid for lunch $25":
---
CONTACT: John - Existing Contact  
ACTION: Recorded that John paid for you
AMOUNT: $25.00 (Reason: lunch)
RESULT: You owe John $25.00
STATUS: SUCCESS - Transaction saved to database
---

EXAMPLE 3 - "Mike owes me 30" (new contact):
---
CONTACT: Mike - New Contact Created
ACTION: Added new contact and recorded loan
AMOUNT: $30.00
RESULT: Mike owes you $30.00
STATUS: SUCCESS - Contact created and transaction saved
---

IMPORTANT RULES:
1. ALWAYS respond with text after using a tool - never leave the user waiting
2. If contact exists, show their current balance FIRST before updating
3. When updating an existing contact's balance, confirm the change clearly
4. Use the exact format above so users can quickly scan responses
5. If something fails, explain what went wrong and suggest next steps

When users ask for dashboard/summary, use the get_dashboard tool and format the data nicely with totals and breakdowns.`

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
                message: `---\nACTION: Logged your expense\nAMOUNT: ${formatCurrency(amount)}\nCATEGORY: ${category}${merchant ? `\nMERCHANT: ${merchant}` : ""}${description ? `\nDETAILS: ${description}` : ""}\nSTATUS: SUCCESS - Saved to database${coaching ? `\n\n${coaching}` : ""}\n---`,
                transaction_id: transaction.id,
              }
            } catch (err) {
              console.log("[v0] log_expense error:", err)
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
                amount,
                previous_balance: previousBalance,
                new_balance: newBalance,
                message: `---\nCONTACT: ${person.name} - ${isNewContact ? "New Contact Created" : "Existing Contact"}\nACTION: ${person.name} paid for you\nAMOUNT: ${formatCurrency(amount)}${description ? ` (${description})` : ""}${merchant ? `\nWHERE: ${merchant}` : ""}\nPREVIOUS BALANCE: ${previousBalance === 0 ? "No previous balance" : previousBalance > 0 ? `You owed ${person.name} ${formatCurrency(previousBalance)}` : `${person.name} owed you ${formatCurrency(Math.abs(previousBalance))}`}\nNEW BALANCE: You owe ${person.name} ${formatCurrency(newBalance)}\nSTATUS: SUCCESS - Saved to database\n---`,
              }
            } catch (err) {
              console.log("[v0] log_expense_other_paid error:", err)
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
                amount,
                previous_balance: previousBalance,
                new_balance: newBalance,
                message: `---\nCONTACT: ${person.name} - ${isNewContact ? "New Contact Created" : "Existing Contact"}\nACTION: Recorded money you lent/paid for them\nAMOUNT: ${formatCurrency(amount)}${description ? ` (${description})` : ""}\nPREVIOUS BALANCE: ${previousBalance === 0 ? "No previous balance" : previousBalance > 0 ? `You owed ${person.name} ${formatCurrency(previousBalance)}` : `${person.name} owed you ${formatCurrency(Math.abs(previousBalance))}`}\nNEW BALANCE: ${person.name} owes you ${formatCurrency(Math.abs(newBalance))}\nSTATUS: SUCCESS - Saved to database\n---`,
              }
            } catch (err) {
              console.log("[v0] log_lent_money error:", err)
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
                amount_received: receiveAmount,
                previous_balance: person.running_balance,
                new_balance: newBalance,
                message: `---\nCONTACT: ${person.name} - Existing Contact\nACTION: Received payment from ${person.name}\nAMOUNT: ${formatCurrency(receiveAmount)}\nPREVIOUS BALANCE: ${person.name} owed you ${formatCurrency(Math.abs(person.running_balance))}\nNEW BALANCE: ${newBalance === 0 ? "All settled! You're square." : newBalance < 0 ? `${person.name} still owes you ${formatCurrency(Math.abs(newBalance))}` : `You now owe ${person.name} ${formatCurrency(newBalance)}`}\nSTATUS: SUCCESS - Payment recorded\n---`,
              }
            } catch (err) {
              console.log("[v0] receive_payment error:", err)
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
                amount_settled: settleAmount,
                previous_balance: previousBalance,
                new_balance: remaining,
                message: `---\nCONTACT: ${person.name} - Existing Contact\nACTION: You paid ${person.name} back\nAMOUNT: ${formatCurrency(settleAmount)}\nPREVIOUS BALANCE: You owed ${person.name} ${formatCurrency(previousBalance)}\nNEW BALANCE: ${remaining === 0 ? "All settled! You're square." : `You still owe ${person.name} ${formatCurrency(Math.abs(remaining))}`}\nSTATUS: SUCCESS - Payment recorded\n---`,
              }
            } catch (err) {
              console.log("[v0] settle_due error:", err)
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
                message: `Bill tracked: ${name} for ${formatCurrency(amount)}, due ${parsedDate}.${recurring ? ` Recurring ${recurrence_pattern || "monthly"}.` : ""} Don't miss it.`,
              }
            } catch (err) {
              console.log("[v0] create_bill error:", err)
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
                  message: `No contact found with name "${person_name}". Would you like to create a new contact?`,
                  available_contacts: allPeople.map((p) => p.name),
                }
              }

              // Get dues related to this person
              const dues = await getPendingDues(userId)
              const personDues = dues.filter((d) => d.person_id === person.id)

              return {
                success: true,
                found: true,
                person: {
                  name: person.name,
                  relationship: person.relationship,
                  email: person.email,
                  phone: person.phone,
                  running_balance: person.running_balance,
                  balance_direction: person.running_balance > 0 ? "you_owe_them" : person.running_balance < 0 ? "they_owe_you" : "settled",
                  created_at: person.created_at,
                },
                pending_dues: personDues.length,
                message: `**Contact Found: ${person.name}**\n\nRelationship: ${person.relationship || "Not set"}\nBalance: ${person.running_balance === 0 ? "All settled" : person.running_balance > 0 ? `You owe ${person.name} ${formatCurrency(person.running_balance)}` : `${person.name} owes you ${formatCurrency(Math.abs(person.running_balance))}`}\nPending transactions: ${personDues.length}\n\nWhat would you like to do with ${person.name}?`,
              }
            } catch (err) {
              console.log("[v0] get_person_info error:", err)
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
              return {
                success: true,
                data: {
                  total_spent_this_month: dashboard.totalSpentThisMonth,
                  top_category: dashboard.topCategory,
                  you_owe: dashboard.outstandingDues.youOwe,
                  owed_to_you: dashboard.outstandingDues.owedToYou,
                  upcoming_bills: dashboard.upcomingBills.map((b) => ({ name: b.name, amount: b.amount, due_date: b.due_date })),
                },
              }
            } catch (err) {
              console.log("[v0] get_dashboard error:", err)
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
              return { success: true, you_owe: dashboard.outstandingDues.youOwe, owed_to_you: dashboard.outstandingDues.owedToYou }
            } catch (err) {
              console.log("[v0] get_dues error:", err)
              return { success: false, error: String(err) }
            }
          },
        }),

        },
      maxSteps: 5,
      onStepFinish: async ({ stepType, toolResults, text }) => {
        console.log("[v0] Step finished:", stepType)
        if (toolResults && toolResults.length > 0) {
          console.log("[v0] Tool results:", JSON.stringify(toolResults).substring(0, 500))
        }
        if (text) {
          console.log("[v0] Text generated:", text.substring(0, 200))
        }
      },
      onFinish: async ({ response }) => {
        console.log("[v0] onFinish called, response messages:", response.messages?.length)
        // Save the conversation if we have a conversationId
        if (conversationId) {
          const lastUserMessage = messages[messages.length - 1]
          const assistantContent = response.messages
            .filter((m) => m.role === "assistant")
            .map((m) => {
              if (typeof m.content === "string") return m.content
              return m.content
                .filter((p) => p.type === "text")
                .map((p) => p.text)
                .join("")
            })
            .join("\n")

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

          // Save assistant message
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

    console.log("[v0] Returning stream response")
    return result.toUIMessageStreamResponse()
  } catch (error) {
    console.log("[v0] API Error:", error)
    const errorMessage = error instanceof Error ? error.message : String(error)
    return Response.json({ error: errorMessage }, { status: 500 })
  }
}
