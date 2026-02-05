import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

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

    const { id: paymentId } = await params

    // Get the payment
    const { data: payment } = await supabase
      .from("reminder_payments")
      .select("*, reminder:recurring_reminders(*)")
      .eq("id", paymentId)
      .eq("user_id", user.id)
      .single()

    if (!payment) {
      return NextResponse.json({ error: "Payment not found" }, { status: 404 })
    }

    // If it's paid, mark it back as pending
    if (payment.status === "paid") {
      const { error } = await supabase
        .from("reminder_payments")
        .update({ 
          status: "pending", 
          paid_date: null 
        })
        .eq("id", paymentId)

      if (error) {
        return NextResponse.json({ error: "Failed to undo payment" }, { status: 500 })
      }

      // Also delete any future pending payment that was created
      // (when marking next occurrence paid)
      const reminder = payment.reminder
      if (reminder) {
        await supabase
          .from("reminder_payments")
          .delete()
          .eq("reminder_id", reminder.id)
          .eq("user_id", user.id)
          .eq("status", "pending")
          .gt("due_date", payment.due_date)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error undoing payment:", error)
    return NextResponse.json(
      { error: "Failed to undo payment" },
      { status: 500 }
    )
  }
}
