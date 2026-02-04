import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { data: person, error } = await supabase
    .from("people")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single()

  if (error || !person) {
    return NextResponse.json({ error: "Person not found" }, { status: 404 })
  }

  return NextResponse.json({ person })
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { name, email, phone, relationship, notes } = body

  const updateData: Record<string, unknown> = {}
  if (name !== undefined) updateData.name = name.toLowerCase().trim()
  if (email !== undefined) updateData.email = email
  if (phone !== undefined) updateData.phone = phone
  if (relationship !== undefined) updateData.relationship = relationship
  if (notes !== undefined) updateData.notes = notes

  const { data: person, error } = await supabase
    .from("people")
    .update(updateData)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ person })
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { error } = await supabase
    .from("people")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
