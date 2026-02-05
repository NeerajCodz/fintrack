import { Suspense } from "react"
import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { FinancialApp } from "@/components/financial-app"
import ChatLoading from "./loading"

interface ChatPageProps {
  params: Promise<{ id: string }>
}

async function ChatContent({ id }: { id: string }) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Verify the conversation belongs to the user
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (!conversation) {
    redirect("/")
  }

  return <FinancialApp userEmail={user.email || ""} initialConversationId={id} />
}

export default async function ChatPage({ params }: ChatPageProps) {
  const { id } = await params
  
  return (
    <Suspense fallback={<ChatLoading />}>
      <ChatContent id={id} />
    </Suspense>
  )
}
