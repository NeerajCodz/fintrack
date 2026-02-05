import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import dynamic from "next/dynamic"

const FinancialApp = dynamic(
  () => import("@/components/financial-app").then((mod) => mod.FinancialApp),
  { ssr: false }
)

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
