-- Migration 006 — flag system-generated messages.
-- NULL means a regular user message; otherwise the value names the event
-- (e.g. 'join'). Used to suppress edit/delete and to classify Inbox events.

ALTER TABLE messages
    ADD COLUMN IF NOT EXISTS system_kind VARCHAR(20) NULL;
