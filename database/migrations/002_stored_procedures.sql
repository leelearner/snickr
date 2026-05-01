-- Migration 002 — stored procedures for transactional operations.
-- Each function wraps a multi-step operation (membership check + inserts +
-- status update) so the application can invoke it as a single SELECT call
-- and the database guarantees atomicity.

-- create_channel_for_member: insert a channel and add the creator as its
-- first member, but only if the creator is a member of the workspace.
-- Returns the new channelID, or NULL if the creator is not a workspace member.
CREATE OR REPLACE FUNCTION create_channel_for_member(
    p_workspace_id  INTEGER,
    p_channel_name  VARCHAR,
    p_type_name     VARCHAR,
    p_user_id       INTEGER
) RETURNS INTEGER AS $$
DECLARE
    v_type_id    INTEGER;
    v_channel_id INTEGER;
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM workspacemember
         WHERE workspaceID = p_workspace_id AND userID = p_user_id
    ) THEN
        RETURN NULL;
    END IF;

    SELECT typeID INTO v_type_id FROM channeltype WHERE name = p_type_name;
    IF v_type_id IS NULL THEN
        RAISE EXCEPTION 'unknown channel type: %', p_type_name;
    END IF;

    INSERT INTO channels (workspaceID, channel_name, typeID, created_by, created_time, updated_time)
    VALUES (p_workspace_id, p_channel_name, v_type_id, p_user_id, NOW(), NOW())
    RETURNING channelID INTO v_channel_id;

    INSERT INTO channelmember (channelID, userID, joined_time)
    VALUES (v_channel_id, p_user_id, NOW());

    RETURN v_channel_id;
END;
$$ LANGUAGE plpgsql;


-- accept_workspace_invitation: flip the invitation to accepted and insert
-- the user into workspacemember (as 'member'), atomically.
-- Returns the workspaceID on success, or NULL if the invitation does not
-- exist or is not addressed to this user. Raises if the invitation has
-- already been responded to.
CREATE OR REPLACE FUNCTION accept_workspace_invitation(
    p_invitation_id INTEGER,
    p_user_id       INTEGER
) RETURNS INTEGER AS $$
DECLARE
    v_workspace_id INTEGER;
    v_status       VARCHAR;
    v_accepted_id  INTEGER;
    v_member_role  INTEGER;
BEGIN
    SELECT wi.workspaceID, s.type
      INTO v_workspace_id, v_status
      FROM workspaceinvitation wi
      JOIN status s ON s.statusID = wi.status_type
     WHERE wi.invitationID = p_invitation_id
       AND wi.invitee      = p_user_id;

    IF v_workspace_id IS NULL THEN
        RETURN NULL;
    END IF;
    IF v_status <> 'pending' THEN
        RAISE EXCEPTION 'invitation already %', v_status;
    END IF;

    SELECT statusID INTO v_accepted_id FROM status WHERE type = 'accepted';
    SELECT roleID   INTO v_member_role FROM roles  WHERE name = 'member';

    UPDATE workspaceinvitation
       SET status_type = v_accepted_id
     WHERE invitationID = p_invitation_id;

    INSERT INTO workspacemember (workspaceID, userID, role, joined_time)
    VALUES (v_workspace_id, p_user_id, v_member_role, NOW())
    ON CONFLICT (workspaceID, userID) DO NOTHING;

    RETURN v_workspace_id;
END;
$$ LANGUAGE plpgsql;
