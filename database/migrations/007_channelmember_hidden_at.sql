-- Migration 007 — let a user hide a direct-message channel from their list.
-- A NULL value means the channel is visible. A non-NULL timestamp means the
-- user has dismissed it from their DM list. The row stays in channelmember so
-- the message history is preserved and the partner is unaffected.

ALTER TABLE channelmember
    ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMP NULL;
