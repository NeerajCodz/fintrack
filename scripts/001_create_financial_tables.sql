-- Financial Tracking Agent Database Schema
-- All tables use RLS with user_id matching auth.uid()

-- People table - tracks contacts who owe/are owed money
CREATE TABLE IF NOT EXISTS public.people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT,
  running_balance DECIMAL(12,2) DEFAULT 0, -- positive = they owe user, negative = user owes them
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions table - all financial movements
CREATE TABLE IF NOT EXISTS public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  category TEXT,
  description TEXT,
  merchant TEXT,
  date DATE DEFAULT CURRENT_DATE,
  paid_by TEXT DEFAULT 'user', -- 'user' or person_id
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dues table - tracks who owes whom
CREATE TABLE IF NOT EXISTS public.dues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id UUID REFERENCES public.people(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
  due_date DATE,
  direction TEXT NOT NULL CHECK (direction IN ('user_owes', 'they_owe')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bills table - recurring and one-time bills
CREATE TABLE IF NOT EXISTS public.bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  due_date DATE,
  recurring BOOLEAN DEFAULT false,
  recurrence_pattern TEXT, -- 'monthly', 'weekly', 'yearly'
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reminders table - attached to bills or dues
CREATE TABLE IF NOT EXISTS public.reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('bill', 'due')),
  entity_id UUID NOT NULL,
  remind_at TIMESTAMPTZ NOT NULL,
  escalated BOOLEAN DEFAULT false,
  completed BOOLEAN DEFAULT false,
  ignore_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notes table - for storing summaries and insights
CREATE TABLE IF NOT EXISTS public.notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_text TEXT NOT NULL,
  linked_entity TEXT,
  linked_entity_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table - conversation history for context
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.people ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for people
CREATE POLICY "people_select_own" ON public.people FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "people_insert_own" ON public.people FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "people_update_own" ON public.people FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "people_delete_own" ON public.people FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for transactions
CREATE POLICY "transactions_select_own" ON public.transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "transactions_insert_own" ON public.transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "transactions_update_own" ON public.transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "transactions_delete_own" ON public.transactions FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for dues
CREATE POLICY "dues_select_own" ON public.dues FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "dues_insert_own" ON public.dues FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dues_update_own" ON public.dues FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "dues_delete_own" ON public.dues FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for bills
CREATE POLICY "bills_select_own" ON public.bills FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "bills_insert_own" ON public.bills FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "bills_update_own" ON public.bills FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "bills_delete_own" ON public.bills FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for reminders
CREATE POLICY "reminders_select_own" ON public.reminders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "reminders_insert_own" ON public.reminders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reminders_update_own" ON public.reminders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "reminders_delete_own" ON public.reminders FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for notes
CREATE POLICY "notes_select_own" ON public.notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notes_insert_own" ON public.notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "notes_update_own" ON public.notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "notes_delete_own" ON public.notes FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for messages
CREATE POLICY "messages_select_own" ON public.messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "messages_insert_own" ON public.messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "messages_update_own" ON public.messages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "messages_delete_own" ON public.messages FOR DELETE USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_dues_user_status ON public.dues(user_id, status);
CREATE INDEX IF NOT EXISTS idx_bills_user_status ON public.bills(user_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_reminders_user_completed ON public.reminders(user_id, completed, remind_at);
CREATE INDEX IF NOT EXISTS idx_messages_user_created ON public.messages(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_people_user ON public.people(user_id);
