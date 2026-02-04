import type { ParsedExpense, ParsedBill } from "./types"

const EXPENSE_CATEGORIES = [
  "food",
  "transport",
  "entertainment",
  "shopping",
  "utilities",
  "rent",
  "subscription",
  "health",
  "education",
  "other",
]

const BILL_KEYWORDS = [
  "rent",
  "electricity",
  "water",
  "internet",
  "phone",
  "subscription",
  "emi",
  "loan",
  "insurance",
  "netflix",
  "spotify",
  "gym",
]

export function parseExpenseFromText(text: string): ParsedExpense {
  const result: ParsedExpense = {}
  const lowerText = text.toLowerCase()

  // Extract amount (supports ₹, $, Rs, numbers)
  const amountMatch = text.match(/[₹$]?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)|(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:rs|rupees|dollars|bucks)?/i)
  if (amountMatch) {
    const numStr = (amountMatch[1] || amountMatch[2]).replace(/,/g, "")
    result.amount = parseFloat(numStr)
  }

  // Extract category
  for (const cat of EXPENSE_CATEGORIES) {
    if (lowerText.includes(cat)) {
      result.category = cat
      break
    }
  }

  // Infer category from keywords
  if (!result.category) {
    if (/lunch|dinner|breakfast|food|eat|restaurant|cafe|coffee|meal/i.test(lowerText)) {
      result.category = "food"
    } else if (/uber|ola|taxi|cab|metro|bus|fuel|petrol|gas/i.test(lowerText)) {
      result.category = "transport"
    } else if (/movie|netflix|spotify|game|concert/i.test(lowerText)) {
      result.category = "entertainment"
    } else if (/bought|amazon|flipkart|shop/i.test(lowerText)) {
      result.category = "shopping"
    }
  }

  // Extract merchant (after "at" or "from")
  const merchantMatch = text.match(/(?:at|from)\s+([A-Za-z0-9\s']+?)(?:\s*[,.]|\s+for|\s+and|\s*$)/i)
  if (merchantMatch) {
    result.merchant = merchantMatch[1].trim()
  }

  // Extract who paid
  const paidByMatch = text.match(/([A-Za-z]+)\s+paid|paid\s+by\s+([A-Za-z]+)/i)
  if (paidByMatch) {
    result.paid_by = (paidByMatch[1] || paidByMatch[2]).trim()
  } else if (/i\s+paid|my\s+expense|i\s+spent/i.test(lowerText)) {
    result.paid_by = "user"
  }

  // Extract date
  if (/today/i.test(lowerText)) {
    result.date = new Date().toISOString().split("T")[0]
  } else if (/yesterday/i.test(lowerText)) {
    const d = new Date()
    d.setDate(d.getDate() - 1)
    result.date = d.toISOString().split("T")[0]
  }

  result.description = text

  return result
}

export function parseBillFromText(text: string): ParsedBill | null {
  const lowerText = text.toLowerCase()

  // Check if this is a bill-related message
  const isBill = BILL_KEYWORDS.some((kw) => lowerText.includes(kw)) ||
    /due|bill|payment\s+due|pay\s+by/i.test(lowerText)

  if (!isBill) return null

  const result: ParsedBill = {}

  // Extract bill name
  for (const kw of BILL_KEYWORDS) {
    if (lowerText.includes(kw)) {
      result.name = kw.charAt(0).toUpperCase() + kw.slice(1)
      break
    }
  }

  // Extract amount
  const amountMatch = text.match(/[₹$]?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i)
  if (amountMatch) {
    result.amount = parseFloat(amountMatch[1].replace(/,/g, ""))
  }

  // Extract due date
  const dateMatch = text.match(/(\d{1,2})[\/\-](\d{1,2})(?:[\/\-](\d{2,4}))?|(\d{1,2})(?:st|nd|rd|th)?(?:\s+of)?\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i)
  if (dateMatch) {
    if (dateMatch[1] && dateMatch[2]) {
      const day = dateMatch[1].padStart(2, "0")
      const month = dateMatch[2].padStart(2, "0")
      const year = dateMatch[3] || new Date().getFullYear().toString()
      result.due_date = `${year.length === 2 ? "20" + year : year}-${month}-${day}`
    }
  }

  // Check if recurring
  result.recurring = /monthly|every\s+month|recurring|weekly|yearly|annual/i.test(lowerText)
  if (result.recurring) {
    if (/monthly|every\s+month/i.test(lowerText)) {
      result.recurrence_pattern = "monthly"
    } else if (/weekly/i.test(lowerText)) {
      result.recurrence_pattern = "weekly"
    } else if (/yearly|annual/i.test(lowerText)) {
      result.recurrence_pattern = "yearly"
    }
  }

  return result
}

export function isSettlementMessage(text: string): { isPaid: boolean; person?: string; amount?: number } {
  const lowerText = text.toLowerCase()
  const isPaid = /paid\s+back|settled|cleared|returned|gave\s+back/i.test(lowerText)

  if (!isPaid) return { isPaid: false }

  const personMatch = text.match(/(?:paid|settled|cleared|returned)\s+(?:back\s+)?(?:to\s+)?([A-Za-z]+)/i) ||
    text.match(/([A-Za-z]+)\s+(?:paid|settled|cleared|returned)/i)

  const amountMatch = text.match(/[₹$]?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/i)

  return {
    isPaid: true,
    person: personMatch?.[1],
    amount: amountMatch ? parseFloat(amountMatch[1].replace(/,/g, "")) : undefined,
  }
}

export function isDashboardRequest(text: string): boolean {
  const lowerText = text.toLowerCase()
  return /dashboard|summary|overview|how\s+much|spent\s+this|status|show\s+me|what.*owe|who.*owe/i.test(lowerText)
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount)
}
