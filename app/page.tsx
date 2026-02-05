import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { ChatInterface } from "@/components/chat-interface"

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return (
    <main className="h-dvh">
      <ChatInterface />
    </main>
  )
}
