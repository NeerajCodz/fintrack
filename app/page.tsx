import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { FinancialApp } from "@/components/financial-app"

export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return <FinancialApp userEmail={user.email || ""} />
}
