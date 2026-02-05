-- Recurring Reminders Table for tracking recurring payments (Netflix, rent, subscriptions)
-- This tracks WHAT needs to be paid and WHEN, plus payment history

-- Recurring reminders table - tracks what to pay and when
CREATE TABLE IF NOT EXISTS public.recurring_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- "Netflix", "Rent", "Gym"
  amount DECIMAL(12,2) NOT NULL,
  recurrence_type TEXT NOT NULL CHECK (recurrence_type IN ('daily', 'weekly', 'monthly', 'yearly')),
  recurrence_day INTEGER, -- 1-31 for monthly, 0-6 for weekly (0=Sunday), 1-365 for yearly
  next_due_date DATE NOT NULL,
  category TEXT DEFAULT 'subscription',
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment history for recurring reminders
CREATE TABLE IF NOT EXISTS public.reminder_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_id UUID NOT NULL REFERENCES public.recurring_reminders(id) ON DELETE CASCADE,
  due_date DATE NOT NULL,
  paid_date DATE,
  amount DECIMAL(12,2) NOT NULL,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'skipped', 'overdue')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.recurring_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for recurring_reminders
CREATE POLICY "recurring_reminders_select_own" ON public.recurring_reminders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "recurring_reminders_insert_own" ON public.recurring_reminders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "recurring_reminders_update_own" ON public.recurring_reminders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "recurring_reminders_delete_own" ON public.recurring_reminders FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for reminder_payments
CREATE POLICY "reminder_payments_select_own" ON public.reminder_payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "reminder_payments_insert_own" ON public.reminder_payments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "reminder_payments_update_own" ON public.reminder_payments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "reminder_payments_delete_own" ON public.reminder_payments FOR DELETE USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_recurring_reminders_user ON public.recurring_reminders(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_recurring_reminders_next_due ON public.recurring_reminders(user_id, next_due_date);
CREATE INDEX IF NOT EXISTS idx_reminder_payments_reminder ON public.reminder_payments(reminder_id, due_date);
CREATE INDEX IF NOT EXISTS idx_reminder_payments_user ON public.reminder_payments(user_id, status);
