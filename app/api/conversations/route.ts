import { createClient } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("*")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ conversations })
}

export async function POST(request: Request) {
  console.log("[v0] Creating conversation")
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  console.log("[v0] Conversation user:", user?.id)

  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { title } = await request.json()
  console.log("[v0] Conversation title:", title)

  const { data: conversation, error } = await supabase
    .from("conversations")
    .insert({
      user_id: user.id,
      title: title || "New Chat",
    })
    .select()
    .single()

  if (error) {
    console.log("[v0] Conversation create error:", error)
    return Response.json({ error: error.message }, { status: 500 })
  }

  console.log("[v0] Conversation created:", conversation?.id)
  return Response.json({ conversation })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return Response.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { conversationId } = await request.json()

  const { error } = await supabase
    .from("conversations")
    .delete()
    .eq("id", conversationId)
    .eq("user_id", user.id)

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ success: true })
}
