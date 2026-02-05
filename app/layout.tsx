import React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"

import "./globals.css"

const inter = Inter({ 
  subsets: ["latin"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "FinTrack AI - Smart Financial Tracking",
  description: "Track expenses, dues, and bills with an AI-powered financial coach. Manage shared costs with friends, set bill reminders, and gain insights into your spending habits.",
  keywords: ["finance", "expense tracker", "AI", "budget", "money management", "bill tracker"],
  authors: [{ name: "FinTrack" }],
  openGraph: {
    title: "FinTrack AI - Smart Financial Tracking",
    description: "Track expenses, dues, and bills with an AI-powered financial coach.",
    type: "website",
  },
}

export const viewport: Viewport = {
  themeColor: "#0a0f1a",
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
