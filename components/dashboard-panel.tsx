"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency } from "@/lib/financial-utils"
import type { DashboardData } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { TrendingUp, TrendingDown, Calendar, AlertCircle } from "lucide-react"

export function DashboardPanel() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDashboard() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) {
        setError("Not authenticated")
        setLoading(false)
        return
      }

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: "dashboard" }),
        })

        const result = await response.json()
        if (result.data) {
          setData(result.data)
        }
      } catch {
        setError("Failed to load dashboard")
      } finally {
        setLoading(false)
      }
    }

    fetchDashboard()
  }, [])

  if (error) {
    return (
      <div className="p-4 text-destructive text-sm">
        <AlertCircle className="h-4 w-4 inline mr-2" />
        {error}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!data) return null

  const totalOwed = data.outstandingDues.youOwe.reduce(
    (sum, d) => sum + d.amount,
    0
  )
  const totalOwedToYou = data.outstandingDues.owedToYou.reduce(
    (sum, d) => sum + d.amount,
    0
  )

  return (
    <div className="p-4 space-y-4 overflow-y-auto">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Spent This Month
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-foreground">
            {formatCurrency(data.totalSpentThisMonth)}
          </p>
          {data.topCategory && (
            <p className="text-xs text-muted-foreground mt-1">
              Top: {data.topCategory.category} ({formatCurrency(data.topCategory.total)})
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-destructive" />
            You Owe
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.outstandingDues.youOwe.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing. Good.</p>
          ) : (
            <div className="space-y-1">
              {data.outstandingDues.youOwe.map((due, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-foreground capitalize">{due.person}</span>
                  <span className="font-medium text-destructive">
                    {formatCurrency(due.amount)}
                  </span>
                </div>
              ))}
              <div className="pt-2 border-t border-border flex justify-between text-sm font-bold">
                <span>Total</span>
                <span className="text-destructive">{formatCurrency(totalOwed)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-green-600" />
            Owed to You
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.outstandingDues.owedToYou.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing pending.</p>
          ) : (
            <div className="space-y-1">
              {data.outstandingDues.owedToYou.map((due, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-foreground capitalize">{due.person}</span>
                  <span className="font-medium text-green-600">
                    {formatCurrency(due.amount)}
                  </span>
                </div>
              ))}
              <div className="pt-2 border-t border-border flex justify-between text-sm font-bold">
                <span>Total</span>
                <span className="text-green-600">{formatCurrency(totalOwedToYou)}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Upcoming Bills (7 days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {data.upcomingBills.length === 0 ? (
            <p className="text-sm text-muted-foreground">None upcoming.</p>
          ) : (
            <div className="space-y-2">
              {data.upcomingBills.map((bill) => (
                <div
                  key={bill.id}
                  className="flex justify-between items-center text-sm"
                >
                  <div>
                    <p className="font-medium text-foreground">{bill.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Due: {bill.due_date}
                    </p>
                  </div>
                  <span className="font-medium text-foreground">
                    {formatCurrency(bill.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
