-- Migration 005 — track edited time on messages.
-- NULL means the message has not been edited.

ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS edited_time TIMESTAMP NULL;
