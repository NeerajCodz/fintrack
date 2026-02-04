import { createClient } from "@/lib/supabase/server"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { id } = await params

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { data: messages, error } = await supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", id)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ messages })
}
