-- Financial Tracking Agent Database Schema
-- Single source of truth for all financial data

-- People table (who you track money with)
CREATE TABLE IF NOT EXISTS people (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  relationship TEXT,
  running_balance DECIMAL(12, 2) DEFAULT 0, -- positive = they owe user, negative = user owes them
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions table (all spending records)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  merchant TEXT,
  date DATE DEFAULT CURRENT_DATE,
  paid_by TEXT DEFAULT 'user', -- 'user' or person_id
  paid_by_person_id UUID REFERENCES people(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Dues table (who owes whom)
CREATE TABLE IF NOT EXISTS dues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_id UUID NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  amount DECIMAL(12, 2) NOT NULL, -- positive = they owe user, negative = user owes them
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'settled')),
  due_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Bills table (recurring and one-time bills)
CREATE TABLE IF NOT EXISTS bills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  due_date DATE NOT NULL,
  recurring BOOLEAN DEFAULT FALSE,
  recurrence_pattern TEXT, -- 'monthly', 'weekly', 'yearly', etc.
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reminders table (for bills and dues)
CREATE TABLE IF NOT EXISTS reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('bill', 'due')),
  entity_id UUID NOT NULL,
  remind_at TIMESTAMPTZ NOT NULL,
  escalated BOOLEAN DEFAULT FALSE,
  completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notes table (supermemory-lite for context)
CREATE TABLE IF NOT EXISTS notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  summary_text TEXT NOT NULL,
  linked_entity TEXT, -- 'transaction:uuid', 'bill:uuid', etc.
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_people_user_id ON people(user_id);
CREATE INDEX IF NOT EXISTS idx_dues_user_id ON dues(user_id);
CREATE INDEX IF NOT EXISTS idx_dues_status ON dues(status);
CREATE INDEX IF NOT EXISTS idx_bills_user_id ON bills(user_id);
CREATE INDEX IF NOT EXISTS idx_bills_due_date ON bills(due_date);
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_remind_at ON reminders(remind_at);

-- Enable Row Level Security on all tables
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dues ENABLE ROW LEVEL SECURITY;
ALTER TABLE bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies for people
CREATE POLICY "users_select_own_people" ON people FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own_people" ON people FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own_people" ON people FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own_people" ON people FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for transactions
CREATE POLICY "users_select_own_transactions" ON transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own_transactions" ON transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own_transactions" ON transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own_transactions" ON transactions FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for dues
CREATE POLICY "users_select_own_dues" ON dues FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own_dues" ON dues FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own_dues" ON dues FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own_dues" ON dues FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for bills
CREATE POLICY "users_select_own_bills" ON bills FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own_bills" ON bills FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own_bills" ON bills FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own_bills" ON bills FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for reminders
CREATE POLICY "users_select_own_reminders" ON reminders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own_reminders" ON reminders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own_reminders" ON reminders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own_reminders" ON reminders FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for notes
CREATE POLICY "users_select_own_notes" ON notes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own_notes" ON notes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own_notes" ON notes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own_notes" ON notes FOR DELETE USING (auth.uid() = user_id);
