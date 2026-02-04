import { createClient } from "@/lib/supabase/server"
import { getDashboardData } from "@/lib/db"

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }

  try {
    const dashboard = await getDashboardData(user.id)
    return Response.json({ data: dashboard })
  } catch (error) {
    console.error("[v0] Dashboard error:", error)
    return Response.json({ error: "Failed to load dashboard" }, { status: 500 })
  }
}
