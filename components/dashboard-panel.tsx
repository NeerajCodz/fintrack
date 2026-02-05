"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { formatCurrency } from "@/lib/financial-utils"
import type { DashboardData } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  AlertCircle, 
  RefreshCw,
  Wallet,
  PieChart,
  Brain,
  Sparkles
} from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"

interface AIInsight {
  type: "warning" | "tip" | "achievement"
  message: string
}

export function DashboardPanel() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const fetchDashboard = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      setError("Not authenticated")
      setLoading(false)
      setRefreshing(false)
      return
    }

    try {
      const response = await fetch("/api/dashboard")

      const result = await response.json()
      if (result.data) {
        setData(result.data)
        generateAIInsights(result.data)
      } else if (result.error) {
        setError(result.error)
      }
    } catch {
      setError("Failed to load dashboard")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  function generateAIInsights(dashboardData: DashboardData) {
    const insights: AIInsight[] = []
    
    // Spending analysis
    if (dashboardData.totalSpentThisMonth > 5000) {
      insights.push({
        type: "warning",
        message: "High spending this month. Review your expenses."
      })
    }

    // Dues analysis
    const youOweTotal = dashboardData.outstandingDues.youOwe.reduce((s, d) => s + d.amount, 0)
    if (youOweTotal > 1000) {
      insights.push({
        type: "warning",
        message: `You owe ${formatCurrency(youOweTotal)}. Settle soon to maintain trust.`
      })
    }

    // Bills analysis
    if (dashboardData.upcomingBills.length > 0) {
      insights.push({
        type: "tip",
        message: `${dashboardData.upcomingBills.length} bill(s) due this week. Don't miss them.`
      })
    }

    // Achievement
    if (dashboardData.outstandingDues.youOwe.length === 0 && dashboardData.outstandingDues.owedToYou.length === 0) {
      insights.push({
        type: "achievement",
        message: "No outstanding dues. Clean financial slate."
      })
    }

    setAiInsights(insights)
  }

  if (error) {
    return (
      <div className="p-4 flex items-center gap-2 text-destructive text-sm glass rounded-lg m-4">
        <AlertCircle className="h-4 w-4" />
        {error}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-4 space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <Skeleton className="h-28 w-full rounded-xl bg-muted/50" />
          </motion.div>
        ))}
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

  const cardVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    visible: { opacity: 1, y: 0, scale: 1 },
  }

  return (
    <div className="p-4 space-y-4 overflow-y-auto h-full">
      {/* Header */}
      <motion.div 
        className="flex items-center justify-between"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        <h2 className="text-lg font-semibold gradient-text flex items-center gap-2">
          <PieChart className="h-5 w-5 text-primary" />
          Dashboard
        </h2>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => fetchDashboard(true)}
          disabled={refreshing}
          className="h-8 w-8"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
        </Button>
      </motion.div>

      {/* AI Insights */}
      <AnimatePresence>
        {aiInsights.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            {aiInsights.map((insight, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`flex items-start gap-2 p-3 rounded-xl text-sm ${
                  insight.type === "warning"
                    ? "bg-destructive/10 border border-destructive/20 text-destructive"
                    : insight.type === "achievement"
                    ? "bg-amber-500/10 border border-amber-500/20 text-amber-700"
                    : "bg-primary/10 border border-primary/20 text-primary"
                }`}
              >
                {insight.type === "warning" ? (
                  <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                ) : (
                  <Brain className="h-4 w-4 mt-0.5 flex-shrink-0" />
                )}
                <span>{insight.message}</span>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Monthly Spend */}
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.1 }}
      >
        <Card className="glass border-border overflow-hidden">
          <div className="absolute inset-0 bg-primary/3 pointer-events-none" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4 text-primary" />
              Spent This Month
            </CardTitle>
          </CardHeader>
          <CardContent>
            <motion.p 
              className="text-3xl font-bold gradient-text"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
            >
              {formatCurrency(data.totalSpentThisMonth)}
            </motion.p>
            {data.topCategory && (
              <div className="flex items-center gap-2 mt-2">
                <Sparkles className="h-3 w-3 text-amber-600" />
                <p className="text-xs text-muted-foreground">
                  Top: <span className="text-amber-600 font-medium">{data.topCategory.category}</span> ({formatCurrency(data.topCategory.total)})
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* You Owe */}
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.2 }}
      >
        <Card className="glass border-border overflow-hidden">
          <div className="absolute inset-0 bg-destructive/3 pointer-events-none" />
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
              <div className="space-y-2">
                {data.outstandingDues.youOwe.map((due, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.05 }}
                    className="flex justify-between text-sm items-center"
                  >
                    <span className="text-foreground capitalize">{due.person}</span>
                    <span className="font-medium text-destructive bg-destructive/10 px-2 py-0.5 rounded-full text-xs">
                      {formatCurrency(due.amount)}
                    </span>
                  </motion.div>
                ))}
                <div className="pt-2 border-t border-border flex justify-between text-sm font-bold">
                  <span>Total</span>
                  <span className="text-destructive">{formatCurrency(totalOwed)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Owed to You */}
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.3 }}
      >
        <Card className="glass border-border overflow-hidden">
          <div className="absolute inset-0 bg-amber-500/3 pointer-events-none" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-amber-600" />
              Owed to You
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.outstandingDues.owedToYou.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing pending.</p>
            ) : (
              <div className="space-y-2">
                {data.outstandingDues.owedToYou.map((due, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.4 + i * 0.05 }}
                    className="flex justify-between text-sm items-center"
                  >
                    <span className="text-foreground capitalize">{due.person}</span>
                    <span className="font-medium text-amber-700 bg-amber-500/10 px-2 py-0.5 rounded-full text-xs">
                      {formatCurrency(due.amount)}
                    </span>
                  </motion.div>
                ))}
                <div className="pt-2 border-t border-border flex justify-between text-sm font-bold">
                  <span>Total</span>
                  <span className="text-amber-700">{formatCurrency(totalOwedToYou)}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Upcoming Bills */}
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.4 }}
      >
        <Card className="glass border-border overflow-hidden">
          <div className="absolute inset-0 bg-primary/3 pointer-events-none" />
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Upcoming Bills (7 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.upcomingBills.length === 0 ? (
              <p className="text-sm text-muted-foreground">None upcoming.</p>
            ) : (
              <div className="space-y-3">
                {data.upcomingBills.map((bill, i) => (
                  <motion.div
                    key={bill.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 + i * 0.05 }}
                    className="flex justify-between items-center"
                  >
                    <div>
                      <p className="font-medium text-foreground text-sm">{bill.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Due: {bill.due_date}
                      </p>
                    </div>
                    <span className="font-medium text-primary bg-primary/10 px-2 py-1 rounded-lg text-sm">
                      {formatCurrency(bill.amount)}
                    </span>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
