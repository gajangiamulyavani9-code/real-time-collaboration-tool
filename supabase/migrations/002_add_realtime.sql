-- Enable Realtime for Supabase
-- This allows the frontend to subscribe to database changes

-- Enable the realtime extension
BEGIN;

-- Documents table realtime
ALTER PUBLICATION supabase_realtime ADD TABLE documents;

-- Messages table realtime
ALTER PUBLICATION supabase_realtime ADD TABLE messages;

-- Document collaborators realtime
ALTER PUBLICATION supabase_realtime ADD TABLE document_collaborators;

COMMIT;

-- Note: Realtime primarily used as backup to Socket.IO for this application
-- Socket.IO handles real-time collaboration, but Supabase Realtime
-- can be used for additional features like notifications
