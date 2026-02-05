/**
 * Database Migration Script
 * 
 * Runs SQL migrations against Supabase PostgreSQL database.
 * Uses environment variables for credentials (never hardcode!).
 * 
 * Usage:
 *   npx tsx scripts/run-migration.ts
 * 
 * Environment:
 *   SUPABASE_DB_URL - Full PostgreSQL connection string
 *   
 * Example:
 *   $env:SUPABASE_DB_URL="postgres://postgres.xxx:password@aws-1-us-east-1.pooler.supabase.com:5432/postgres"
 *   $env:NODE_TLS_REJECT_UNAUTHORIZED="0"
 *   npx tsx scripts/run-migration.ts
 */

import { Client } from "pg"
import * as fs from "fs"
import * as path from "path"

async function runMigration() {
  // Get database URL from environment
  const dbUrl = process.env.SUPABASE_DB_URL
  
  if (!dbUrl) {
    console.error("❌ Error: SUPABASE_DB_URL environment variable is required")
    console.error("")
    console.error("Set it like this (PowerShell):")
    console.error('  $env:SUPABASE_DB_URL="postgres://postgres.xxx:password@aws-1-us-east-1.pooler.supabase.com:5432/postgres"')
    console.error('  $env:NODE_TLS_REJECT_UNAUTHORIZED="0"')
    console.error("  npx tsx scripts/run-migration.ts")
    process.exit(1)
  }

  console.log("🚀 Starting database migration...")
  console.log("")

  // Read the SQL file
  const sqlPath = path.join(__dirname, "000_full_reset.sql")
  
  if (!fs.existsSync(sqlPath)) {
    console.error(`❌ Error: SQL file not found: ${sqlPath}`)
    process.exit(1)
  }

  const sql = fs.readFileSync(sqlPath, "utf-8")
  console.log("📝 Loaded SQL migration file")

  // Connect to database
  const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false },
  })

  try {
    console.log("🔌 Connecting to database...")
    await client.connect()
    console.log("✅ Connected!")
    console.log("")

    // Execute the SQL
    console.log("⚡ Executing migration...")
    await client.query(sql)
    
    console.log("")
    console.log("✅ Migration completed successfully!")
    console.log("")

    // Verify tables were created
    const result = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `)
    
    console.log("📋 Tables in database:")
    result.rows.forEach((row, i) => {
      console.log(`   ${i + 1}. ${row.table_name}`)
    })

  } catch (error) {
    console.error("")
    console.error("❌ Migration failed:", error)
    process.exit(1)
  } finally {
    await client.end()
    console.log("")
    console.log("🔌 Disconnected from database")
  }
}

runMigration()
