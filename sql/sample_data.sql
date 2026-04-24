-- Part (d) — Sample test data for Snickr.
-- Run after schema is deployed. Idempotent (TRUNCATEs business tables).

TRUNCATE TABLE messages, channelinvitation, channelmember, channels,
               workspaceinvitation, workspacemember, workspaces, users
RESTART IDENTITY CASCADE;

INSERT INTO roles (name)       VALUES ('admin'),   ('member')                 ON CONFLICT (name) DO NOTHING;
INSERT INTO status (type)      VALUES ('pending'), ('accepted'), ('declined') ON CONFLICT (type) DO NOTHING;
INSERT INTO channeltype (name) VALUES ('public'),  ('private'),  ('direct')   ON CONFLICT (name) DO NOTHING;


-- Users (u6 frank has no workspaces — used for negative tests)
INSERT INTO users (email, username, nickname, password) VALUES
  ('alice@acme.com',   'alice', 'Ali',     'pw_alice'),
  ('bob@acme.com',     'bob',   'Bobby',   'pw_bob'),
  ('carol@acme.com',   'carol', 'Caz',     'pw_carol'),
  ('dave@acme.com',    'dave',  'D',       'pw_dave'),
  ('eve@math.org',     'eve',   'Evie',    'pw_eve'),
  ('frank@outside.io', 'frank', 'Frankie', 'pw_frank');


-- Workspaces
INSERT INTO workspaces (name, description, created_by) VALUES
  ('Acme Corp', 'Company workspace for Acme team', 1),
  ('Math Club', 'University math-club collaboration', 2);


-- Workspace members
--   W1 Acme : alice+bob admins, carol+dave members
--   W2 Math : bob admin, carol+eve members
INSERT INTO workspacemember (workspaceID, userID, role) VALUES
  (1, 1, (SELECT roleID FROM roles WHERE name='admin')),
  (1, 2, (SELECT roleID FROM roles WHERE name='admin')),
  (1, 3, (SELECT roleID FROM roles WHERE name='member')),
  (1, 4, (SELECT roleID FROM roles WHERE name='member')),
  (2, 2, (SELECT roleID FROM roles WHERE name='admin')),
  (2, 3, (SELECT roleID FROM roles WHERE name='member')),
  (2, 5, (SELECT roleID FROM roles WHERE name='member'));


-- Channels
INSERT INTO channels (workspaceID, channel_name, typeID, created_by) VALUES
  (1, 'general',  (SELECT typeID FROM channeltype WHERE name='public'),  1),
  (1, 'random',   (SELECT typeID FROM channeltype WHERE name='public'),  2),
  (1, 'exec',     (SELECT typeID FROM channeltype WHERE name='private'), 1),
  (2, 'geometry', (SELECT typeID FROM channeltype WHERE name='public'),  2),
  (2, 'calculus', (SELECT typeID FROM channeltype WHERE name='public'),  3);


-- Channel members
INSERT INTO channelmember (channelID, userID) VALUES
  (1, 1), (1, 2), (1, 3),
  (2, 1), (2, 2),
  (3, 1), (3, 2),
  (4, 2), (4, 5),
  (5, 2), (5, 3), (5, 5);


-- Channel invitations (drives c.4: old-pending-not-joined should count)
INSERT INTO channelinvitation
  (channelID, invitee, inviter, invited_time, status_type) VALUES
  (1, 4, 1, NOW() - INTERVAL '7 days',  (SELECT statusID FROM status WHERE type='pending')),
  (2, 3, 2, NOW() - INTERVAL '10 days', (SELECT statusID FROM status WHERE type='pending')),
  (2, 4, 2, NOW() - INTERVAL '3 days',  (SELECT statusID FROM status WHERE type='pending')),
  (3, 3, 1, NOW() - INTERVAL '20 days', (SELECT statusID FROM status WHERE type='pending'));


-- Messages (several contain "perpendicular" across different access levels)
INSERT INTO messages (channelID, content, posted_time, posted_by) VALUES
  (1, 'Hello team, welcome to Acme general channel!',              NOW() - INTERVAL '5 days',  1),
  (1, 'Our new logo features perpendicular lines for a modern look.', NOW() - INTERVAL '4 days',  2),
  (1, 'Love the perpendicular motif — very clean.',                 NOW() - INTERVAL '3 days',  3),
  (2, 'Off-topic: perpendicular is my favorite geometry word.',     NOW() - INTERVAL '2 days',  1),
  (3, 'Confidential — we need a perpendicular strategy for Q4.',    NOW() - INTERVAL '1 days',  1),
  (4, 'Two perpendicular lines form a right angle.',                NOW() - INTERVAL '10 days', 2),
  (4, 'Indeed, that is the definition.',                            NOW() - INTERVAL '9 days',  5),
  (5, 'Recall: the tangent and normal vectors are perpendicular.',  NOW() - INTERVAL '8 days',  3),
  (5, 'Great insight, thanks for sharing.',                         NOW() - INTERVAL '7 days',  2);
