import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getRecurringReminders, createRecurringReminder } from "@/lib/db"

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const reminders = await getRecurringReminders(user.id)
    return NextResponse.json({ reminders })
  } catch (error) {
    console.error("Error fetching reminders:", error)
    return NextResponse.json(
      { error: "Failed to fetch reminders" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { name, amount, recurrence_type, recurrence_day } = body

    if (!name || !recurrence_type) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    const reminder = await createRecurringReminder(user.id, {
      name,
      amount: amount || 0,
      recurrence_type,
      recurrence_day,
    })

    return NextResponse.json({ reminder })
  } catch (error) {
    console.error("Error creating reminder:", error)
    return NextResponse.json(
      { error: "Failed to create reminder" },
      { status: 500 }
    )
  }
}
