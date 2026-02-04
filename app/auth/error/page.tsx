import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-sm space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Authentication Error
          </h1>
          <p className="text-sm text-muted-foreground">
            Something went wrong. Try again.
          </p>
        </div>

        <Button asChild className="w-full">
          <Link href="/auth/login">Back to login</Link>
        </Button>
      </div>
    </div>
  )
}
