import { createClient } from "@/lib/supabase/server"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { id } = await params

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return Response.json({ error: "Not authenticated" }, { status: 401 })
    }

    // First verify the conversation belongs to this user
    const { data: conversation, error: convError } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", id)
      .eq("user_id", user.id)
      .single()

    if (convError || !conversation) {
      return Response.json({ messages: [] })
    }

    const { data: messages, error } = await supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("conversation_id", id)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })

    if (error) {
      return Response.json({ error: error.message }, { status: 500 })
    }

    return Response.json({ messages: messages || [] })
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown error"
    return Response.json({ error: errorMessage }, { status: 500 })
  }
}
