import { createClient } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Get person details
  const { data: person, error: personError } = await supabase
    .from("people")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (personError || !person) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 })
  }

  // Get all transactions involving this person
  const { data: transactions } = await supabase
    .from("transactions")
    .select("*")
    .eq("user_id", user.id)
    .or(`paid_by_person_id.eq.${id},paid_by.eq.${id}`)
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })

  // Get all dues involving this person
  const { data: dues } = await supabase
    .from("dues")
    .select("*, transaction:transactions(*)")
    .eq("user_id", user.id)
    .eq("person_id", id)
    .order("created_at", { ascending: false })

  // Get all notes related to this person
  const { data: notes } = await supabase
    .from("notes")
    .select("*")
    .eq("user_id", user.id)
    .or(`linked_entity.like.%person:${id}%,linked_entity.like.%transaction:%`)
    .order("created_at", { ascending: false })

  // Build unified activity log
  type ActivityItem = {
    id: string
    type: "transaction" | "due" | "settlement" | "note"
    date: string
    time: string
    amount: number
    description: string
    category?: string
    status?: string
    direction: "in" | "out" | "neutral"
  }

  const activities: ActivityItem[] = []

  // Add transactions
  transactions?.forEach((t) => {
    const isTheyPaid = t.paid_by === id || t.paid_by_person_id === id
    activities.push({
      id: t.id,
      type: "transaction",
      date: t.date,
      time: new Date(t.created_at).toLocaleTimeString(),
      amount: t.amount,
      description: t.description || t.merchant || t.category,
      category: t.category,
      direction: isTheyPaid ? "in" : "out",
    })
  })

  // Add dues
  dues?.forEach((d) => {
    const isOwedToYou = d.amount < 0
    activities.push({
      id: d.id,
      type: d.status === "settled" ? "settlement" : "due",
      date: d.created_at.split("T")[0],
      time: new Date(d.created_at).toLocaleTimeString(),
      amount: Math.abs(d.amount),
      description: d.status === "settled" 
        ? `Settlement${d.transaction?.description ? ` - ${d.transaction.description}` : ""}`
        : `${isOwedToYou ? "They owe you" : "You owe"}${d.transaction?.description ? ` - ${d.transaction.description}` : ""}`,
      status: d.status,
      direction: isOwedToYou ? "in" : "out",
    })
  })

  // Sort by date descending
  activities.sort((a, b) => {
    const dateA = new Date(`${a.date} ${a.time}`)
    const dateB = new Date(`${b.date} ${b.time}`)
    return dateB.getTime() - dateA.getTime()
  })

  // Calculate summary
  const totalOwed = person.running_balance
  const transactionCount = transactions?.length || 0
  const pendingDuesCount = dues?.filter((d) => d.status === "pending").length || 0

  return NextResponse.json({
    person,
    activities,
    summary: {
      totalBalance: totalOwed,
      transactionCount,
      pendingDuesCount,
      direction: totalOwed > 0 ? "you_owe" : totalOwed < 0 ? "they_owe" : "settled",
    },
  })
}
