-- Snickr schema (PostgreSQL / Supabase).
-- Run this first; then sample_data.sql, then test_queries.sql.

CREATE TABLE users (
    userID INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    email VARCHAR(50) UNIQUE NOT NULL,
    username VARCHAR(30) UNIQUE NOT NULL,
    nickname VARCHAR(30),
    password VARCHAR(30),
    created_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE workspaces (
    workspaceID INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(30) NOT NULL,
    description VARCHAR(200),
    created_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by INTEGER NOT NULL,
    FOREIGN KEY (created_by) REFERENCES users (userID) ON DELETE SET NULL
);

CREATE TABLE roles (
    roleID INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(20) UNIQUE NOT NULL
);

CREATE TABLE workspacemember (
    workspaceID INTEGER,
    userID INTEGER,
    role INTEGER NOT NULL,
    joined_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (workspaceID, userID),
    FOREIGN KEY (workspaceID) REFERENCES workspaces (workspaceID) ON DELETE CASCADE,
    FOREIGN KEY (userID) REFERENCES users (userID) ON DELETE CASCADE,
    FOREIGN KEY (role) REFERENCES roles (roleID)
);

CREATE TABLE status (
    statusID INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    type VARCHAR(30) UNIQUE NOT NULL
);

CREATE TABLE workspaceinvitation (
    invitationID INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    workspaceID INTEGER NOT NULL,
    invitee INTEGER NOT NULL,
    inviter INTEGER NOT NULL,
    invited_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status_type INTEGER NOT NULL,
    FOREIGN KEY (workspaceID) REFERENCES workspaces (workspaceID) ON DELETE CASCADE,
    FOREIGN KEY (invitee) REFERENCES users (userID) ON DELETE CASCADE,
    FOREIGN KEY (inviter) REFERENCES users (userID),
    FOREIGN KEY (status_type) REFERENCES status (statusID),
    UNIQUE (workspaceID, invitee)
);

CREATE TABLE channeltype (
    typeID INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(30) UNIQUE NOT NULL
);

CREATE TABLE channels (
    channelID INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    workspaceID INTEGER NOT NULL,
    channel_name VARCHAR(50) NOT NULL,
    typeID INTEGER NOT NULL,
    created_by INTEGER NOT NULL,
    created_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (typeID) REFERENCES channeltype (typeID),
    FOREIGN KEY (workspaceID) REFERENCES workspaces (workspaceID) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users (userID),
    UNIQUE (workspaceID, channel_name)
);

CREATE TABLE channelmember (
    channelID INTEGER,
    userID INTEGER,
    joined_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    PRIMARY KEY (channelID, userID),
    FOREIGN KEY (channelID) REFERENCES channels (channelID) ON DELETE CASCADE,
    FOREIGN KEY (userID) REFERENCES users (userID) ON DELETE CASCADE
);

CREATE TABLE channelinvitation (
    invitationID INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    channelID INTEGER NOT NULL,
    invited_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status_type INTEGER NOT NULL,
    invitee INTEGER NOT NULL,
    inviter INTEGER NOT NULL,
    FOREIGN KEY (channelID) REFERENCES channels (channelID) ON DELETE CASCADE,
    FOREIGN KEY (invitee) REFERENCES users (userID) ON DELETE CASCADE,
    FOREIGN KEY (inviter) REFERENCES users (userID),
    FOREIGN KEY (status_type) REFERENCES status (statusID),
    UNIQUE (channelID, invitee)
);

CREATE TABLE messages (
    messageID INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    channelID INTEGER NOT NULL,
    content VARCHAR(500) NOT NULL,
    posted_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    posted_by INTEGER NOT NULL,
    FOREIGN KEY (channelID) REFERENCES channels (channelID) ON DELETE CASCADE,
    FOREIGN KEY (posted_by) REFERENCES users (userID)
);

CREATE INDEX idx_messages_channel      ON messages (channelID);
CREATE INDEX idx_workspace_member_user ON workspacemember (userID);
CREATE INDEX idx_channel_member_user   ON channelmember (userID);
