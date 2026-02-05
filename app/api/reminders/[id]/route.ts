import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { deleteRecurringReminder } from "@/lib/db"

export async function DELETE(
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
    await deleteRecurringReminder(id, user.id)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error deleting reminder:", error)
    return NextResponse.json(
      { error: "Failed to delete reminder" },
      { status: 500 }
    )
  }
}
