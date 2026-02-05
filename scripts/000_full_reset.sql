-- FinTrack AI - FULL DATABASE RESET
-- This script DROPS ALL TABLES and recreates them from scratch

-- ================================
-- DROP ALL EXISTING TABLES (CASCADE)
-- ================================
DROP TABLE IF EXISTS public.reminder_payments CASCADE;
DROP TABLE IF EXISTS public.recurring_reminders CASCADE;
DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
DROP TABLE IF EXISTS public.reminders CASCADE;
DROP TABLE IF EXISTS public.notes CASCADE;
DROP TABLE IF EXISTS public.dues CASCADE;
DROP TABLE IF EXISTS public.bills CASCADE;
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.people CASCADE;

-- Drop existing functions
DROP FUNCTION IF EXISTS update_people_updated_at() CASCADE;
DROP FUNCTION IF EXISTS update_conversation_updated_at() CASCADE;

-- ================================
-- CONTACTS/PEOPLE TABLE
-- ================================
CREATE TABLE public.people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  relationship TEXT,
  notes TEXT,
  running_balance DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================
-- TRANSACTIONS TABLE
-- ================================
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  merchant TEXT,
  date DATE DEFAULT CURRENT_DATE,
  paid_by TEXT DEFAULT 'user',
  paid_by_person_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================
-- DUES TABLE (WHO OWES WHOM)
-- ================================
CREATE TABLE public.dues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
  due_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================
-- BILLS TABLE
-- ================================
CREATE TABLE public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  due_date DATE NOT NULL,
  recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================
-- REMINDERS TABLE
-- ================================
CREATE TABLE public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('bill', 'due')),
  entity_id UUID NOT NULL,
  remind_at TIMESTAMPTZ NOT NULL,
  escalated BOOLEAN DEFAULT FALSE,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================
-- NOTES TABLE (AI MEMORY)
-- ================================
CREATE TABLE public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_text TEXT NOT NULL,
  linked_entity TEXT,
  linked_entity_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================
-- CONVERSATIONS TABLE
-- ================================
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================
-- MESSAGES TABLE
-- ================================
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  mentioned_people UUID[] DEFAULT '{}',
  ai_insights JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================
-- RECURRING REMINDERS TABLE
-- ================================
CREATE TABLE public.recurring_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  recurrence_type TEXT NOT NULL CHECK (recurrence_type IN ('daily', 'weekly', 'monthly', 'yearly')),
  recurrence_day INTEGER,
  next_due_date DATE NOT NULL,
  category TEXT DEFAULT 'subscription',
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================
-- REMINDER PAYMENTS TABLE
-- ================================
CREATE TABLE public.reminder_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_id UUID NOT NULL REFERENCES public.recurring_reminders(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  paid_date DATE,
  amount DECIMAL(12,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'skipped', 'overdue')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================
-- ENABLE ROW LEVEL SECURITY
-- ================================
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_payments ENABLE ROW LEVEL SECURITY;

-- ================================
-- RLS POLICIES - PEOPLE
-- ================================
CREATE POLICY "people_select_own" ON public.people FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "people_insert_own" ON public.people FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "people_update_own" ON public.people FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "people_delete_own" ON public.people FOR DELETE USING (auth.uid() = user_id);

-- ================================
-- RLS POLICIES - TRANSACTIONS
-- ================================
CREATE POLICY "transactions_select_own" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "transactions_insert_own" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "transactions_update_own" ON public.transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "transactions_delete_own" ON public.transactions FOR DELETE USING (auth.uid() = user_id);

-- ================================
-- RLS POLICIES - DUES
-- ================================
CREATE POLICY "dues_select_own" ON public.dues FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "dues_insert_own" ON public.dues FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dues_update_own" ON public.dues FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "dues_delete_own" ON public.dues FOR DELETE USING (auth.uid() = user_id);

-- ================================
-- RLS POLICIES - BILLS
-- ================================
CREATE POLICY "bills_select_own" ON public.bills FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "bills_insert_own" ON public.bills FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bills_update_own" ON public.bills FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "bills_delete_own" ON public.bills FOR DELETE USING (auth.uid() = user_id);

-- ================================
-- RLS POLICIES - REMINDERS
-- ================================
CREATE POLICY "reminders_select_own" ON public.reminders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "reminders_insert_own" ON public.reminders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reminders_update_own" ON public.reminders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "reminders_delete_own" ON public.reminders FOR DELETE USING (auth.uid() = user_id);

-- ================================
-- RLS POLICIES - NOTES
-- ================================
CREATE POLICY "notes_select_own" ON public.notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notes_insert_own" ON public.notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notes_update_own" ON public.notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notes_delete_own" ON public.notes FOR DELETE USING (auth.uid() = user_id);

-- ================================
-- RLS POLICIES - CONVERSATIONS
-- ================================
CREATE POLICY "conversations_select_own" ON public.conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "conversations_insert_own" ON public.conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "conversations_update_own" ON public.conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "conversations_delete_own" ON public.conversations FOR DELETE USING (auth.uid() = user_id);

-- ================================
-- RLS POLICIES - MESSAGES
-- ================================
CREATE POLICY "messages_select_own" ON public.messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "messages_insert_own" ON public.messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "messages_update_own" ON public.messages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "messages_delete_own" ON public.messages FOR DELETE USING (auth.uid() = user_id);

-- ================================
-- RLS POLICIES - RECURRING REMINDERS
-- ================================
CREATE POLICY "recurring_reminders_select_own" ON public.recurring_reminders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "recurring_reminders_insert_own" ON public.recurring_reminders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recurring_reminders_update_own" ON public.recurring_reminders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "recurring_reminders_delete_own" ON public.recurring_reminders FOR DELETE USING (auth.uid() = user_id);

-- ================================
-- RLS POLICIES - REMINDER PAYMENTS
-- ================================
CREATE POLICY "reminder_payments_select_own" ON public.reminder_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "reminder_payments_insert_own" ON public.reminder_payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reminder_payments_update_own" ON public.reminder_payments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "reminder_payments_delete_own" ON public.reminder_payments FOR DELETE USING (auth.uid() = user_id);

-- ================================
-- INDEXES FOR PERFORMANCE
-- ================================
CREATE INDEX idx_people_user_id ON public.people(user_id);
CREATE INDEX idx_people_name ON public.people(user_id, name);

CREATE INDEX idx_transactions_user_date ON public.transactions(user_id, date DESC);
CREATE INDEX idx_transactions_category ON public.transactions(user_id, category);
CREATE INDEX idx_transactions_paid_by_person ON public.transactions(paid_by_person_id);

CREATE INDEX idx_dues_user_status ON public.dues(user_id, status);
CREATE INDEX idx_dues_person ON public.dues(person_id);

CREATE INDEX idx_bills_user_status ON public.bills(user_id, status, due_date);

CREATE INDEX idx_reminders_user_completed ON public.reminders(user_id, completed, remind_at);

CREATE INDEX idx_conversations_user_updated ON public.conversations(user_id, updated_at DESC);

CREATE INDEX idx_messages_conversation ON public.messages(conversation_id, created_at);
CREATE INDEX idx_messages_user ON public.messages(user_id);

CREATE INDEX idx_recurring_reminders_user ON public.recurring_reminders(user_id, is_active);
CREATE INDEX idx_recurring_reminders_next_due ON public.recurring_reminders(user_id, next_due_date);
CREATE INDEX idx_reminder_payments_reminder ON public.reminder_payments(reminder_id, due_date);
CREATE INDEX idx_reminder_payments_user ON public.reminder_payments(user_id, status);

-- ================================
-- FUNCTION: Update people.updated_at
-- ================================
CREATE OR REPLACE FUNCTION update_people_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_people_updated_at
  BEFORE UPDATE ON public.people
  FOR EACH ROW
  EXECUTE FUNCTION update_people_updated_at();

-- ================================
-- FUNCTION: Update conversations.updated_at
-- ================================
CREATE OR REPLACE FUNCTION update_conversation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.conversations 
  SET updated_at = NOW() 
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_conversation_updated_at
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_updated_at();

-- ================================
-- DONE!
-- ================================
SELECT 'Database reset and migration complete!' as status;
