import { streamText, tool } from "ai"
import { z } from "zod"
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
  console.log("[v0] Chat API called")
  
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    console.log("[v0] User:", user?.id)

    if (!user) {
      console.log("[v0] Not authenticated")
      return Response.json({ error: "Not authenticated" }, { status: 401 })
    }

    const body = await request.json()
    const { messages, conversationId } = body
    const userId = user.id
  
    console.log("[v0] Messages count:", messages?.length, "ConversationId:", conversationId)
    console.log("[v0] Last message:", messages?.[messages?.length - 1]?.content?.substring(0, 50))

    // Get dashboard data for context
    const dashboardData = await getDashboardData(userId)
    const people = await getPeople(userId)

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

EXPENSE EXAMPLES:
- "Lunch at Starbucks, $15" → log_expense
- "John paid for dinner, $50" → log_expense_other_paid (creates due - you owe John)
- "Paid back John $50" → settle_due

BILL EXAMPLES:
- "Rent due on the 1st, $2000" → create_bill
- "Netflix subscription $15 monthly" → create_bill (recurring)

When users ask for dashboard/summary, use the get_dashboard tool and format it nicely.`

    console.log("[v0] Calling streamText with model openai/gpt-4o-mini")
  
    const result = streamText({
      model: "openai/gpt-4o-mini",
      system: systemPrompt,
      messages,
      tools: {
        log_expense: tool({
          description:
            "Log an expense that the user paid for. Use when user mentions spending money themselves.",
          inputSchema: z.object({
            amount: z.number().describe("Amount spent in dollars"),
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
              message: `Logged: ${formatCurrency(amount)} on ${category}${merchant ? ` at ${merchant}` : ""}.${coaching}`,
              transaction_id: transaction.id,
            }
          },
        }),

        log_expense_other_paid: tool({
          description:
            "Log an expense that someone else paid for. Creates a due - user now owes that person.",
          inputSchema: z.object({
            person_name: z.string().describe("Name of person who paid"),
            amount: z.number().describe("Amount they paid"),
            category: z.string().describe("Spending category"),
            merchant: z.string().nullable().describe("Where"),
            description: z.string().nullable().describe("What for"),
          }),
          execute: async ({
            person_name,
            amount,
            category,
            merchant,
            description,
          }) => {
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
              return {
                success: false,
                error: "Transaction logged but due creation failed",
              }
            }

            await updatePersonBalance(person.id, amount)

            await createNote(
              userId,
              `${person_name} paid ${formatCurrency(amount)} - you owe`,
              `transaction:${transaction.id}`
            )

            const newBalance = person.running_balance + amount

            return {
              success: true,
              message: `Logged: ${person_name} paid ${formatCurrency(amount)}${merchant ? ` at ${merchant}` : ""}. You now owe ${person_name} ${formatCurrency(newBalance)}. Don't forget to settle up.`,
            }
          },
        }),

        settle_due: tool({
          description:
            "Settle a due/debt with someone. Use when user says they paid back someone.",
          inputSchema: z.object({
            person_name: z.string().describe("Name of person being paid back"),
            amount: z
              .number()
              .nullable()
              .describe("Amount being settled. If null, settle all dues."),
          }),
          execute: async ({ person_name, amount }) => {
            const allPeople = await getPeople(userId)
            const person = allPeople.find(
              (p) => p.name.toLowerCase() === person_name.toLowerCase()
            )

            if (!person) {
              return {
                success: false,
                error: `No record of ${person_name}. Check the name.`,
              }
            }

            const pendingDues = await getPendingDues(userId)
            const duesWithPerson = pendingDues.filter(
              (d) => d.person_id === person.id
            )

            if (duesWithPerson.length === 0) {
              return {
                success: false,
                error: `No pending dues with ${person_name}.`,
              }
            }

            const settleAmount =
              amount || duesWithPerson.reduce((sum, d) => sum + d.amount, 0)

            for (const due of duesWithPerson) {
              await settleDue(due.id, amount || undefined)
            }

            await updatePersonBalance(person.id, -settleAmount)

            await createNote(
              userId,
              `Settled ${formatCurrency(settleAmount)} with ${person_name}`,
              `person:${person.id}`
            )

            const remaining = person.running_balance - settleAmount

            return {
              success: true,
              message: `Settled ${formatCurrency(settleAmount)} with ${person_name}. ${
                remaining !== 0
                  ? `Remaining balance: ${formatCurrency(Math.abs(remaining))}.`
                  : "You're square."
              } Good job clearing dues.`,
            }
          },
        }),

        create_bill: tool({
          description:
            "Create a bill reminder. Use for rent, utilities, subscriptions, EMIs.",
          inputSchema: z.object({
            name: z.string().describe("Bill name (rent, electricity, Netflix)"),
            amount: z.number().describe("Bill amount"),
            due_date: z
              .string()
              .describe("Due date in YYYY-MM-DD format or day of month"),
            recurring: z.boolean().describe("Is this a recurring bill?"),
            recurrence_pattern: z
              .string()
              .nullable()
              .describe("monthly, weekly, yearly"),
          }),
          execute: async ({
            name,
            amount,
            due_date,
            recurring,
            recurrence_pattern,
          }) => {
            // Parse due_date - could be just a day number
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

            await createNote(
              userId,
              `Bill added: ${name} - ${formatCurrency(amount)} due ${parsedDate}`,
              `bill:${bill.id}`
            )

            return {
              success: true,
              message: `Bill tracked: ${name} for ${formatCurrency(amount)}, due ${parsedDate}.${recurring ? ` Recurring ${recurrence_pattern || "monthly"}.` : ""} Don't miss it.`,
            }
          },
        }),

        get_dashboard: tool({
          description:
            "Get the user's financial dashboard/summary. Use when they ask for overview, summary, dashboard, or status.",
          inputSchema: z.object({}),
          execute: async () => {
            const dashboard = await getDashboardData(userId)

            return {
              success: true,
              data: {
                total_spent_this_month: dashboard.totalSpentThisMonth,
                top_category: dashboard.topCategory,
                you_owe: dashboard.outstandingDues.youOwe,
                owed_to_you: dashboard.outstandingDues.owedToYou,
                upcoming_bills: dashboard.upcomingBills.map((b) => ({
                  name: b.name,
                  amount: b.amount,
                  due_date: b.due_date,
                })),
              },
            }
          },
        }),

        get_dues: tool({
          description:
            "Get all outstanding dues - who owes whom. Use when user asks about debts or balances.",
          inputSchema: z.object({}),
          execute: async () => {
            const dashboard = await getDashboardData(userId)
            return {
              success: true,
              you_owe: dashboard.outstandingDues.youOwe,
              owed_to_you: dashboard.outstandingDues.owedToYou,
            }
          },
        }),
      },
      maxSteps: 5,
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

    console.log("[v0] Returning data stream response")
    return result.toDataStreamResponse()
  } catch (error) {
    console.error("[v0] Error in chat API:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}
