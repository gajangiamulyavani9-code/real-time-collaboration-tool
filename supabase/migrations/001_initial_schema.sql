-- CollabDocs Database Schema
-- Run this in your Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX idx_users_email ON users(email);

-- ============================================
-- DOCUMENTS TABLE
-- ============================================
CREATE TABLE documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL DEFAULT 'Untitled Document',
    content TEXT DEFAULT '',
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    share_id VARCHAR(12) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for faster lookups
CREATE INDEX idx_documents_owner ON documents(owner_id);
CREATE INDEX idx_documents_share_id ON documents(share_id);
CREATE INDEX idx_documents_updated_at ON documents(updated_at DESC);

-- Function to generate share_id
CREATE OR REPLACE FUNCTION generate_share_id()
RETURNS TRIGGER AS $$
BEGIN
    -- Generate a random 8-character alphanumeric string
    NEW.share_id := UPPER(SUBSTRING(MD5(random()::text) FROM 1 FOR 8));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate share_id
CREATE TRIGGER set_share_id
    BEFORE INSERT ON documents
    FOR EACH ROW
    EXECUTE FUNCTION generate_share_id();

-- ============================================
-- DOCUMENT COLLABORATORS TABLE
-- ============================================
CREATE TABLE document_collaborators (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL CHECK (role IN ('viewer', 'editor')),
    added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(document_id, user_id)
);

-- Create indexes
CREATE INDEX idx_collaborators_document ON document_collaborators(document_id);
CREATE INDEX idx_collaborators_user ON document_collaborators(user_id);

-- ============================================
-- MESSAGES TABLE (Document Chat)
-- ============================================
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_messages_document ON messages(document_id);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_created_at ON messages(created_at DESC);

-- ============================================
-- DOCUMENT VERSIONS (Version History)
-- ============================================
CREATE TABLE document_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    change_summary VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_versions_document ON document_versions(document_id);
CREATE INDEX idx_versions_created_at ON document_versions(created_at DESC);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_versions ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can read their own data" ON users
    FOR SELECT USING (auth.uid() = id);

-- Documents policies
CREATE POLICY "Owners can manage their documents" ON documents
    FOR ALL USING (owner_id = auth.uid());

CREATE POLICY "Collaborators can view documents" ON documents
    FOR SELECT USING (
        id IN (
            SELECT document_id FROM document_collaborators 
            WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Editors can update document content" ON documents
    FOR UPDATE USING (
        owner_id = auth.uid() OR 
        id IN (
            SELECT document_id FROM document_collaborators 
            WHERE user_id = auth.uid() AND role = 'editor'
        )
    );

-- Collaborators policies
CREATE POLICY "Owners can manage collaborators" ON document_collaborators
    FOR ALL USING (
        document_id IN (
            SELECT id FROM documents WHERE owner_id = auth.uid()
        )
    );

CREATE POLICY "Users can see collaborators for their documents" ON document_collaborators
    FOR SELECT USING (
        user_id = auth.uid() OR
        document_id IN (
            SELECT id FROM documents WHERE owner_id = auth.uid()
        ) OR
        document_id IN (
            SELECT document_id FROM document_collaborators WHERE user_id = auth.uid()
        )
    );

-- Messages policies
CREATE POLICY "Document members can view messages" ON messages
    FOR SELECT USING (
        document_id IN (
            SELECT id FROM documents WHERE owner_id = auth.uid()
            UNION
            SELECT document_id FROM document_collaborators WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Document members can send messages" ON messages
    FOR INSERT WITH CHECK (
        sender_id = auth.uid() AND
        document_id IN (
            SELECT id FROM documents WHERE owner_id = auth.uid()
            UNION
            SELECT document_id FROM document_collaborators WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Senders can delete their messages" ON messages
    FOR DELETE USING (sender_id = auth.uid());

CREATE POLICY "Owners can delete any message in their documents" ON messages
    FOR DELETE USING (
        document_id IN (SELECT id FROM documents WHERE owner_id = auth.uid())
    );

-- Versions policies
CREATE POLICY "Document members can view versions" ON document_versions
    FOR SELECT USING (
        document_id IN (
            SELECT id FROM documents WHERE owner_id = auth.uid()
            UNION
            SELECT document_id FROM document_collaborators WHERE user_id = auth.uid()
        )
    );

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to documents
CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Apply to users
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- INITIAL DATA (Optional sample data)
-- ============================================

-- Note: Uncomment and modify if you want sample data
-- INSERT INTO users (name, email, password) VALUES 
-- ('Demo User', 'demo@example.com', '$2a$12$...'); -- Password should be bcrypt hashed

-- ============================================
-- REALTIME (OPTIONAL - enables Supabase Realtime)
-- ============================================
-- Enable the realtime extension for these tables
-- Note: This is optional as Socket.IO handles real-time features

BEGIN;

ALTER PUBLICATION supabase_realtime ADD TABLE documents;
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE document_collaborators;

COMMIT;
