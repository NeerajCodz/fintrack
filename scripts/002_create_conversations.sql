-- Conversations table for chat history
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New Chat',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Messages table for conversation messages
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  ai_insights JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON conversations(updated_at);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON messages(user_id);

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for conversations
CREATE POLICY "users_select_own_conversations" ON conversations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own_conversations" ON conversations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own_conversations" ON conversations FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own_conversations" ON conversations FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies for messages
CREATE POLICY "users_select_own_messages" ON messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "users_insert_own_messages" ON messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "users_update_own_messages" ON messages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "users_delete_own_messages" ON messages FOR DELETE USING (auth.uid() = user_id);
