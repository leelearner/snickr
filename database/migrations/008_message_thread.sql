-- 008_message_thread.sql
-- Adds optional thread parent reference to messages.
--
-- A NULL parent_messageID means the message is a top-level post in the
-- channel timeline. A non-NULL value means the message is a reply inside
-- the parent's thread. The parent must live in the same channel; that
-- invariant is enforced in the application layer because Postgres CHECK
-- constraints cannot reference other rows.
--
-- Deleting a parent message removes the whole thread via ON DELETE
-- CASCADE so reply rows never outlive their parent.
--
-- Idempotent: re-running this migration is safe.

ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS parent_messageID INTEGER NULL
        REFERENCES messages(messageID) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_messages_parent
    ON messages (parent_messageID)
 WHERE parent_messageID IS NOT NULL;
