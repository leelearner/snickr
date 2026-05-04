-- Store message timestamps as Eastern local wall-clock time in the existing
-- TIMESTAMP WITHOUT TIME ZONE column used by the course schema.

ALTER TABLE messages
    ALTER COLUMN posted_time SET DEFAULT timezone('America/New_York', NOW());

-- Existing rows written with NOW() on Supabase were UTC values in a timestamp
-- column. Convert those stored values to America/New_York local time once.
CREATE TABLE IF NOT EXISTS app_migrations (
    name VARCHAR(100) PRIMARY KEY,
    applied_time TIMESTAMP DEFAULT timezone('America/New_York', NOW()) NOT NULL
);

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM app_migrations WHERE name = '003_message_time_eastern') THEN
        UPDATE messages
           SET posted_time = posted_time AT TIME ZONE 'UTC' AT TIME ZONE 'America/New_York';

        INSERT INTO app_migrations (name) VALUES ('003_message_time_eastern');
    END IF;
END $$;
