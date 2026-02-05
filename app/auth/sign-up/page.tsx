"use client"

import React, { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, Sparkles } from "lucide-react"

export default function SignUpPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const supabase = createClient()

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          created_at: new Date().toISOString(),
        },
      },
    })

    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    if (data.user) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        router.push("/auth/login?message=Account created. Please sign in.")
        return
      }

      router.push("/")
      router.refresh()
    }
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
              <h1 className="text-2xl font-bold">Create Account</h1>
              <p className="text-muted-foreground text-sm mt-1">
                Start tracking your finances with AI
              </p>
            </div>
          </div>

          <form onSubmit={handleSignUp} className="space-y-5">
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
                minLength={6}
                autoComplete="new-password"
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
                  Creating account...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-foreground hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
