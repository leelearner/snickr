-- Migration 004 — @username mention notifications.
-- One row per (message, mentioned user). Lets the application list all
-- messages that mention the current user without scanning every message.

CREATE TABLE IF NOT EXISTS mentions (
    mentionID        SERIAL PRIMARY KEY,
    messageID        INTEGER NOT NULL REFERENCES messages(messageID) ON DELETE CASCADE,
    mentioned_user   INTEGER NOT NULL REFERENCES users(userID) ON DELETE CASCADE,
    created_time     TIMESTAMP NOT NULL DEFAULT timezone('America/New_York', NOW()),
    UNIQUE (messageID, mentioned_user)
);

CREATE INDEX IF NOT EXISTS idx_mentions_user ON mentions(mentioned_user, created_time DESC);
