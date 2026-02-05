import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { markReminderPaid } from "@/lib/db"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id } = await params
    
    // Check if we should create next occurrence
    let createNext = false
    try {
      const body = await request.json()
      createNext = body.createNext === true
    } catch {
      // No body or invalid JSON, default to false
    }
    
    const payment = await markReminderPaid(id, user.id, createNext)
    return NextResponse.json({ payment })
  } catch (error) {
    console.error("Error marking payment as paid:", error)
    return NextResponse.json(
      { error: "Failed to mark payment as paid" },
      { status: 500 }
    )
  }
}
