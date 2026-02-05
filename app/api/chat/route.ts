import { createGroq } from "@ai-sdk/groq"
import { generateText } from "ai"
import { createClient } from "@/lib/supabase/server"
import {
  getOrCreatePerson,
  updatePersonBalance,
  createTransaction,
  createDue,
  getPeople,
  createRecurringReminder,
} from "@/lib/db"
import { formatCurrency } from "@/lib/financial-utils"
import type { AIJsonOutput } from "@/lib/types"

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    throw new Error("GROQ_API_KEY is not configured")
  }
  return createGroq({ apiKey })
}

const SYSTEM_PROMPT = `You are FinTrack AI - a financial assistant. ONLY respond with valid JSON.

JSON SCHEMA:
{
  "action": "i_owe" | "they_owe" | "create_reminder" | "question" | "greeting",
  "person": "name",
  "amount": number,
  "description": "what for",
  "category": "food/transport/shopping/entertainment/utilities/health/subscription/other",
  "reminder_name": "Netflix/Rent/Gym",
  "recurrence_type": "daily/weekly/monthly/yearly",
  "recurrence_day": number,
  "message": "confirmation message",
  "reason": "why this action was chosen"
}

EXAMPLES:
"I owe Ajay 50 for food" → {"action":"i_owe","person":"Ajay","amount":50,"description":"food","category":"food","message":"Got it! Recording that you owe Ajay ₹50 for food.","reason":"User explicitly said they owe money"}

"Sajay needs to pay me 40" → {"action":"they_owe","person":"Sajay","amount":40,"description":"payment","category":"other","message":"Got it! Sajay owes you ₹40.","reason":"User said someone needs to pay them"}

"Netflix 199 every 15th" → {"action":"create_reminder","reminder_name":"Netflix","amount":199,"recurrence_type":"monthly","recurrence_day":15,"category":"subscription","message":"Reminder set! Netflix ₹199 due on the 15th.","reason":"User wants recurring payment reminder"}

"hi" or "hello" → {"action":"greeting","message":"Hi! I can help you track expenses. Try: 'I owe Ajay 50 for lunch' or 'Netflix 199 every 15th'","reason":"User greeting"}

"how much do I owe" → {"action":"question","message":"Let me check your balances...","reason":"User asking a question about their data"}

RULES:
1. ONLY output JSON - no markdown, no backticks
2. Always include "reason" field explaining your choice
3. "i_owe" = user owes someone
4. "they_owe" = someone owes user
5. "create_reminder" = recurring payment
6. "greeting" = hi/hello/hey
7. "question" = asking about data`

// Extract text from various message formats
function extractUserText(message: unknown): string {
  if (!message) return ""
  
  const msg = message as Record<string, unknown>
  
  // Direct string content
  if (typeof msg.content === "string") {
    return msg.content
  }
  
  // Parts array format (from useChat)
  if (Array.isArray(msg.parts)) {
    return msg.parts
      .filter((p: { type?: string }) => p.type === "text")
      .map((p: { text?: string }) => p.text || "")
      .join("")
  }
  
  // Content array format
  if (Array.isArray(msg.content)) {
    return msg.content
      .filter((p: { type?: string }) => p.type === "text")
      .map((p: { text?: string }) => p.text || "")
      .join("")
  }
  
  return ""
}

export async function POST(request: Request) {
  const startTime = Date.now()
  
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 })
    }

    const body = await request.json()
    const { messages, conversationId } = body
    const userId = user.id

    // Get the last user message
    const lastMessage = messages?.[messages.length - 1]
    const userText = extractUserText(lastMessage)
    
    console.log(`[chat] User message: "${userText}" (${Date.now() - startTime}ms)`)

    if (!userText.trim()) {
      return Response.json({ error: "Empty message" }, { status: 400 })
    }

    const groq = getGroqClient()

    // Generate JSON response from Groq
    const { text: aiResponse } = await generateText({
      model: groq("llama-3.3-70b-versatile"),
      system: SYSTEM_PROMPT,
      prompt: userText,
    })

    console.log(`[chat] AI response: ${aiResponse} (${Date.now() - startTime}ms)`)

    // Parse the JSON response
    let parsed: AIJsonOutput & { reason?: string }
    try {
      let cleanJson = aiResponse.trim()
      if (cleanJson.startsWith("```")) {
        cleanJson = cleanJson.replace(/```json?\n?/g, "").replace(/```$/g, "").trim()
      }
      parsed = JSON.parse(cleanJson)
    } catch {
      console.error(`[chat] JSON parse error, raw: ${aiResponse}`)
      parsed = {
        action: "greeting",
        message: "I can help track expenses! Try: 'I owe Ajay 50 for lunch' or 'Netflix 199 every 15th'",
        reason: "Failed to parse AI response"
      }
    }

    // Process the action
    let finalMessage = parsed.message || "Done!"
    let dbUpdated = false

    if (parsed.action === "i_owe" && parsed.person && parsed.amount) {
      try {
        const person = await getOrCreatePerson(userId, parsed.person)
        if (person) {
          const transaction = await createTransaction(userId, {
            amount: parsed.amount,
            category: parsed.category || "other",
            description: parsed.description || undefined,
            paid_by: person.id,
          })

          if (transaction) {
            await createDue(userId, {
              person_id: person.id,
              transaction_id: transaction.id,
              amount: parsed.amount,
            })
            
            await updatePersonBalance(person.id, parsed.amount)
            const newBalance = person.running_balance + parsed.amount
            
            finalMessage = `✓ You owe ${person.name} ${formatCurrency(newBalance)} total${parsed.description ? ` (${parsed.description})` : ""}`
            dbUpdated = true
          }
        }
      } catch (err) {
        console.error("[chat] i_owe error:", err)
        finalMessage = `Error: ${err}`
      }
    } else if (parsed.action === "they_owe" && parsed.person && parsed.amount) {
      try {
        const allPeople = await getPeople(userId)
        const existingPerson = allPeople.find(p => p.name.toLowerCase() === parsed.person!.toLowerCase())
        const person = await getOrCreatePerson(userId, parsed.person)
        
        if (person) {
          const transaction = await createTransaction(userId, {
            amount: parsed.amount,
            category: parsed.category || "lent",
            description: parsed.description || `Lent to ${parsed.person}`,
            paid_by: "user",
          })

          if (transaction) {
            await createDue(userId, {
              person_id: person.id,
              transaction_id: transaction.id,
              amount: -parsed.amount,
            })
            
            const previousBalance = existingPerson?.running_balance || 0
            await updatePersonBalance(person.id, -parsed.amount)
            const newBalance = previousBalance - parsed.amount
            
            // Correct message based on net balance
            // Positive balance = you owe them, Negative balance = they owe you
            if (newBalance > 0) {
              finalMessage = `✓ You still owe ${person.name} ${formatCurrency(newBalance)} total${parsed.description ? ` (${parsed.description})` : ""}`
            } else if (newBalance < 0) {
              finalMessage = `✓ ${person.name} owes you ${formatCurrency(Math.abs(newBalance))} total${parsed.description ? ` (${parsed.description})` : ""}`
            } else {
              finalMessage = `✓ You and ${person.name} are settled up!${parsed.description ? ` (${parsed.description})` : ""}`
            }
            dbUpdated = true
          }
        }
      } catch (err) {
        console.error("[chat] they_owe error:", err)
        finalMessage = `Error: ${err}`
      }
    } else if (parsed.action === "create_reminder" && parsed.reminder_name) {
      try {
        const reminder = await createRecurringReminder(userId, {
          name: parsed.reminder_name,
          amount: parsed.amount || 0,
          recurrence_type: parsed.recurrence_type || "monthly",
          recurrence_day: parsed.recurrence_day,
          category: parsed.category || "subscription",
        })

        if (reminder) {
          const dayText = parsed.recurrence_type === "weekly" 
            ? ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][parsed.recurrence_day || 0]
            : parsed.recurrence_day ? `${parsed.recurrence_day}${getOrdinalSuffix(parsed.recurrence_day)}` : ""
          
          finalMessage = `✓ Reminder: ${parsed.reminder_name}${parsed.amount ? ` ${formatCurrency(parsed.amount)}` : ""} ${
            parsed.recurrence_type === "weekly" ? `every ${dayText}` :
            parsed.recurrence_type === "monthly" ? `on the ${dayText}` :
            parsed.recurrence_type === "daily" ? "daily" : "yearly"
          }`
          dbUpdated = true
        }
      } catch (err) {
        console.error("[chat] create_reminder error:", err)
        finalMessage = `Error: ${err}`
      }
    }

    // Save to conversation if provided - sequential insert for correct order
    if (conversationId) {
      const now = new Date()
      
      // Insert user message first with explicit timestamp
      const userTimestamp = now.toISOString()
      const { error: userMsgError } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        user_id: userId,
        role: "user",
        content: userText,
        created_at: userTimestamp,
      })
      
      if (userMsgError) {
        console.error("[chat] Error saving user message:", userMsgError)
      }
      
      // Add 100ms to ensure assistant message is always after user message
      const assistantTimestamp = new Date(now.getTime() + 100).toISOString()
      
      // Then insert assistant message with later timestamp
      const { error: assistantMsgError } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        user_id: userId,
        role: "assistant",
        content: finalMessage,
        created_at: assistantTimestamp,
      })
      
      if (assistantMsgError) {
        console.error("[chat] Error saving assistant message:", assistantMsgError)
      }
    }

    console.log(`[chat] Done in ${Date.now() - startTime}ms, action: ${parsed.action}, reason: ${parsed.reason || "N/A"}`)

    // Return AI SDK v6 compatible data stream response
    // This format works with useChat's DefaultChatTransport
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      start(controller) {
        // Format: each character streamed as text delta
        // AI SDK v6 format: "0:string\n" for text parts
        // We split the message into words for smoother streaming effect
        const words = finalMessage.split(' ')
        words.forEach((word, i) => {
          const text = i === 0 ? word : ' ' + word
          controller.enqueue(encoder.encode(`0:"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"\n`))
        })
        // Finish reason
        controller.enqueue(encoder.encode(`e:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0},"isContinued":false}\n`))
        // Done
        controller.enqueue(encoder.encode(`d:{"finishReason":"stop","usage":{"promptTokens":0,"completionTokens":0}}\n`))
        controller.close()
      }
    })

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "X-Vercel-AI-Data-Stream": "v1",
        "X-DB-Updated": dbUpdated.toString(),
        "X-Action": parsed.action,
        "X-Reason": parsed.reason || "unknown",
      },
    })
  } catch (error) {
    console.error("[chat] ERROR:", error)
    return Response.json({ error: String(error) }, { status: 500 })
  }
}

function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"]
  const v = n % 100
  return s[(v - 20) % 10] || s[v] || s[0]
}
