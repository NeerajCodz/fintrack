"use client"

import React, { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { ArrowRight, Sparkles } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const message = searchParams.get("message")

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push("/")
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background relative">
      {/* Ambient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -right-[20%] w-[80%] h-[80%] rounded-full bg-gradient-to-br from-primary/[0.03] to-transparent blur-3xl" />
        <div className="absolute -bottom-[30%] -left-[20%] w-[60%] h-[60%] rounded-full bg-gradient-to-tr from-success/[0.02] to-transparent blur-3xl" />
      </div>

      <div className="w-full max-w-md relative">
        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          <div className="text-center space-y-4 mb-8">
            <div className="w-12 h-12 rounded-xl bg-foreground flex items-center justify-center mx-auto">
              <span className="text-background font-bold text-lg">f.</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold">Welcome Back</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Sign in to track your money
              </p>
            </div>
          </div>

          {message && (
            <div className="bg-success/10 border border-success/20 text-success px-4 py-3 rounded-lg mb-6 text-sm text-center">
              {message}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="h-11"
              />
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full h-11 bg-foreground text-background hover:bg-foreground/90"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 animate-pulse" />
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Sign in
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            No account?{" "}
            <Link href="/auth/sign-up" className="text-foreground hover:underline font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
