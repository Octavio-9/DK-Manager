-- Chat messages for the AI conversational assistant
-- Each message is private per user (RLS enforced)

CREATE TABLE IF NOT EXISTS "ChatMessage" (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"    UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tab         TEXT        NOT NULL CHECK (tab IN ('ideas', 'titles', 'script', 'podcast')),
  role        TEXT        NOT NULL CHECK (role IN ('user', 'assistant')),
  content     TEXT        NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast per-user retrieval ordered by time
CREATE INDEX IF NOT EXISTS chat_message_user_created
  ON "ChatMessage" ("userId", "createdAt");

-- Row Level Security: each user sees only their own messages
ALTER TABLE "ChatMessage" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "chat_private_select" ON "ChatMessage"
  FOR SELECT USING (auth.uid() = "userId");

CREATE POLICY "chat_private_insert" ON "ChatMessage"
  FOR INSERT WITH CHECK (auth.uid() = "userId");

CREATE POLICY "chat_private_delete" ON "ChatMessage"
  FOR DELETE USING (auth.uid() = "userId");
