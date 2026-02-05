"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { AlertTriangle, ArrowLeft } from "lucide-react"

export default function AuthErrorPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative">
      {/* Ambient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -right-[20%] w-[80%] h-[80%] rounded-full bg-gradient-to-br from-destructive/[0.03] to-transparent blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        <div className="bg-card border border-border rounded-2xl p-8 text-center shadow-sm">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto mb-6">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>

          <div className="space-y-2 mb-6">
            <h1 className="text-2xl font-bold">Authentication Error</h1>
            <p className="text-sm text-muted-foreground">
              Something went wrong during authentication. Please try again.
            </p>
          </div>

          <Button
            asChild
            className="w-full h-11 bg-foreground text-background hover:bg-foreground/90"
          >
            <Link href="/auth/login" className="flex items-center justify-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to login
            </Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
