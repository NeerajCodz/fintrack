import React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"

import "./globals.css"

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "fin. - Smart Financial Tracking",
  description: "Track expenses, dues, and bills with an AI-powered financial copilot. Manage shared costs with friends, set bill reminders, and gain insights into your spending habits.",
  keywords: ["finance", "expense tracker", "AI", "budget", "money management", "bill tracker"],
  authors: [{ name: "fin" }],
  openGraph: {
    title: "fin. - Smart Financial Tracking",
    description: "Track expenses, dues, and bills with an AI-powered financial copilot.",
    type: "website",
  },
}

export const viewport: Viewport = {
  themeColor: "#f5f3f0",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>{children}</body>
    </html>
  )
}
