-- Migration 001 — widen users.password from VARCHAR(30) to VARCHAR(255).
-- Reason: Project 2 stores bcrypt hashes (60 chars) instead of plaintext.
-- Run once on the existing Supabase database.

ALTER TABLE users
    ALTER COLUMN password TYPE VARCHAR(255);
