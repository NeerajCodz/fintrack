"use client"

import React from "react"
import { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Users,
  Plus,
  Search,
  Mail,
  TrendingUp,
  TrendingDown,
  User,
  X,
  Loader2,
  ChevronRight,
} from "lucide-react"
import type { Person } from "@/lib/types"
import { ContactDetailView } from "./contact-detail-view"

interface ContactsManagerProps {
  isOpen: boolean
  onClose: () => void
  onChatWithPerson?: (person: Person) => void
  initialViewPerson?: Person | null
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(Math.abs(amount))
}

export function ContactsManager({ isOpen, onClose, onChatWithPerson, initialViewPerson }: ContactsManagerProps) {
  const [people, setPeople] = useState<Person[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [editingPerson, setEditingPerson] = useState<Person | null>(null)
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState<Person | null>(null)
  const [viewingPerson, setViewingPerson] = useState<Person | null>(null)
  const [saving, setSaving] = useState(false)

  const fetchPeople = useCallback(async () => {
    try {
      const res = await fetch("/api/people")
      if (res.ok) {
        const data = await res.json()
        setPeople(data.people || [])
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      fetchPeople()
    }
  }, [isOpen, fetchPeople])

  // Set viewing person when initialViewPerson changes
  useEffect(() => {
    if (initialViewPerson && isOpen) {
      setViewingPerson(initialViewPerson)
    }
  }, [initialViewPerson, isOpen])

  const filteredPeople = people.filter(
    (p) =>
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.email && p.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (p.relationship && p.relationship.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const handleSavePerson = async (personData: Partial<Person>) => {
    setSaving(true)
    try {
      const url = editingPerson ? `/api/people/${editingPerson.id}` : "/api/people"
      const method = editingPerson ? "PATCH" : "POST"

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(personData),
      })

      if (res.ok) {
        await fetchPeople()
        setEditingPerson(null)
        setIsAddDialogOpen(false)
      }
    } catch {
      // Handle error
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePerson = async (personId: string) => {
    if (!confirm("Are you sure you want to delete this contact? All associated transactions and dues will be preserved.")) return

    try {
      const res = await fetch(`/api/people/${personId}`, {
        method: "DELETE",
      })

      if (res.ok) {
        await fetchPeople()
        setSelectedPerson(null)
        setViewingPerson(null)
      }
    } catch {
      // Handle error
    }
  }

  const handleChatWithPerson = (person: Person) => {
    if (onChatWithPerson) {
      onChatWithPerson(person)
      onClose()
    }
  }

  // Calculate totals
  const totalYouOwe = people
    .filter((p) => p.running_balance > 0)
    .reduce((sum, p) => sum + p.running_balance, 0)

  const totalOwedToYou = people
    .filter((p) => p.running_balance < 0)
    .reduce((sum, p) => sum + Math.abs(p.running_balance), 0)

  if (!isOpen) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="w-full max-w-5xl max-h-[90vh] glass rounded-2xl border border-white/10 overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {viewingPerson ? (
          <ContactDetailView
            person={viewingPerson}
            onBack={() => setViewingPerson(null)}
            onChat={handleChatWithPerson}
            onEdit={(p) => {
              setEditingPerson(p)
              setViewingPerson(null)
            }}
          />
        ) : (
          <>
            {/* Header */}
            <div className="p-6 border-b border-white/10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Contacts</h2>
                    <p className="text-sm text-muted-foreground">
                      {people.length} people tracked
                    </p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="rounded-full hover:bg-white/10"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="glass rounded-xl p-4 border border-red-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingDown className="h-5 w-5 text-red-400" />
                    <span className="text-sm text-muted-foreground">You Owe</span>
                  </div>
                  <p className="text-2xl font-bold text-red-400">
                    {formatCurrency(totalYouOwe)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {people.filter((p) => p.running_balance > 0).length} people
                  </p>
                </div>
                <div className="glass rounded-xl p-4 border border-green-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-5 w-5 text-green-400" />
                    <span className="text-sm text-muted-foreground">Owed to You</span>
                  </div>
                  <p className="text-2xl font-bold text-green-400">
                    {formatCurrency(totalOwedToYou)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {people.filter((p) => p.running_balance < 0).length} people
                  </p>
                </div>
              </div>

              {/* Search and Add */}
              <div className="flex gap-3">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search contacts..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 bg-white/5 border-white/10"
                  />
                </div>
                <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 shadow-lg shadow-purple-500/20">
                      <Plus className="h-4 w-4 mr-2" />
                      Add Contact
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="glass border-white/10">
                    <DialogHeader>
                      <DialogTitle>Add New Contact</DialogTitle>
                    </DialogHeader>
                    <PersonForm
                      onSave={handleSavePerson}
                      onCancel={() => setIsAddDialogOpen(false)}
                      saving={saving}
                    />
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Contact List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredPeople.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <User className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  {searchTerm ? "No contacts found" : "No contacts yet. Add your first one!"}
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  <AnimatePresence>
                    {filteredPeople.map((person) => (
                      <motion.div
                        key={person.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setViewingPerson(person)}
                        className="p-4 cursor-pointer hover:bg-white/5 transition-colors flex items-center gap-4"
                      >
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-emerald-500 flex items-center justify-center text-white font-medium text-lg shadow-lg shadow-blue-500/10">
                          {person.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate capitalize text-lg">{person.name}</p>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            {person.relationship && (
                              <span className="capitalize">{person.relationship}</span>
                            )}
                            {person.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {person.email}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-3">
                          {person.running_balance !== 0 ? (
                            <div>
                              <p
                                className={`font-bold text-lg ${
                                  person.running_balance > 0 ? "text-red-400" : "text-green-400"
                                }`}
                              >
                                {formatCurrency(person.running_balance)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {person.running_balance > 0 ? "You owe" : "Owes you"}
                              </p>
                            </div>
                          ) : (
                            <p className="text-muted-foreground">Settled</p>
                          )}
                          <ChevronRight className="h-5 w-5 text-muted-foreground" />
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </div>
          </>
        )}

        {/* Edit Dialog */}
        <Dialog open={!!editingPerson} onOpenChange={(open) => !open && setEditingPerson(null)}>
          <DialogContent className="glass border-white/10">
            <DialogHeader>
              <DialogTitle>Edit Contact</DialogTitle>
            </DialogHeader>
            {editingPerson && (
              <PersonForm
                person={editingPerson}
                onSave={handleSavePerson}
                onCancel={() => setEditingPerson(null)}
                saving={saving}
              />
            )}
          </DialogContent>
        </Dialog>
      </motion.div>
    </motion.div>
  )
}

interface PersonFormProps {
  person?: Person
  onSave: (data: Partial<Person>) => void
  onCancel: () => void
  saving: boolean
}

function PersonForm({ person, onSave, onCancel, saving }: PersonFormProps) {
  const [name, setName] = useState(person?.name || "")
  const [email, setEmail] = useState(person?.email || "")
  const [phone, setPhone] = useState(person?.phone || "")
  const [relationship, setRelationship] = useState(person?.relationship || "")
  const [notes, setNotes] = useState(person?.notes || "")

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    onSave({
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      relationship: relationship || null,
      notes: notes.trim() || null,
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium mb-1 block">Name *</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="John Doe"
          className="bg-white/5 border-white/10"
          required
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">Email</label>
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="john@example.com"
          className="bg-white/5 border-white/10"
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">Phone</label>
        <Input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="+1 234 567 8900"
          className="bg-white/5 border-white/10"
        />
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">Relationship</label>
        <Select value={relationship} onValueChange={setRelationship}>
          <SelectTrigger className="bg-white/5 border-white/10">
            <SelectValue placeholder="Select relationship" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="friend">Friend</SelectItem>
            <SelectItem value="family">Family</SelectItem>
            <SelectItem value="colleague">Colleague</SelectItem>
            <SelectItem value="roommate">Roommate</SelectItem>
            <SelectItem value="partner">Partner</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium mb-1 block">Notes</label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any notes about this contact..."
          className="bg-white/5 border-white/10 min-h-[80px]"
        />
      </div>

      <div className="flex gap-3 pt-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="flex-1 bg-transparent border-white/10"
          disabled={saving}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500"
          disabled={saving || !name.trim()}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : person ? "Save Changes" : "Add Contact"}
        </Button>
      </div>
    </form>
  )
}
