import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function SignUpSuccessPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Check Your Email
          </h1>
          <p className="text-sm text-muted-foreground">
            We sent you a confirmation link. Click it to activate your account.
          </p>
        </div>

        <Button asChild variant="outline" className="w-full bg-transparent">
          <Link href="/auth/login">Back to login</Link>
        </Button>
      </div>
    </div>
  )
}
