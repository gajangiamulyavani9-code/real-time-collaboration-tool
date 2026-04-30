import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();
dotenv.config({ path: '../.env' });

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials. Check your .env file.');
  process.exit(1);
}

// Create Supabase client with service role key for server-side operations
export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Database helper functions for common operations
export const db = {
  // User operations
  users: {
    findByEmail: async (email) => {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .single();
      return { data, error };
    },

    findById: async (id) => {
      const { data, error } = await supabase
        .from('users')
        .select('id, name, email, avatar_url, created_at')
        .eq('id', id)
        .single();
      return { data, error };
    },

    create: async (userData) => {
      const { data, error } = await supabase
        .from('users')
        .insert([userData])
        .select('id, name, email, avatar_url, created_at')
        .single();
      return { data, error };
    },

    update: async (id, updates) => {
      const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', id)
        .select('id, name, email, avatar_url')
        .single();
      return { data, error };
    }
  },

  // Document operations
  documents: {
    findAllByUser: async (userId) => {
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          owner:owner_id(id, name, email),
          collaborators:document_collaborators(
            user_id,
            role,
            user:user_id(id, name, email)
          )
        `)
        .or(`owner_id.eq.${userId},collaborators.user_id.eq.${userId}`)
        .order('updated_at', { ascending: false });
      return { data, error };
    },

    findById: async (id) => {
      const { data, error } = await supabase
        .from('documents')
        .select(`
          *,
          owner:owner_id(id, name, email),
          collaborators:document_collaborators(
            user_id,
            role,
            user:user_id(id, name, email)
          )
        `)
        .eq('id', id)
        .single();
      return { data, error };
    },

    create: async (docData) => {
      const { data, error } = await supabase
        .from('documents')
        .insert([docData])
        .select(`
          *,
          owner:owner_id(id, name, email)
        `)
        .single();
      return { data, error };
    },

    update: async (id, updates) => {
      const { data, error } = await supabase
        .from('documents')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select(`
          *,
          owner:owner_id(id, name, email)
        `)
        .single();
      return { data, error };
    },

    delete: async (id) => {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id);
      return { error };
    },

    searchByShareId: async (shareId) => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('share_id', shareId)
        .single();
      return { data, error };
    }
  },

  // Collaborator operations
  collaborators: {
    findByDocument: async (documentId) => {
      const { data, error } = await supabase
        .from('document_collaborators')
        .select(`
          user_id,
          role,
          user:user_id(id, name, email, avatar_url)
        `)
        .eq('document_id', documentId);
      return { data, error };
    },

    findByUserAndDocument: async (userId, documentId) => {
      const { data, error } = await supabase
        .from('document_collaborators')
        .select('*')
        .eq('user_id', userId)
        .eq('document_id', documentId)
        .single();
      return { data, error };
    },

    add: async (documentId, userId, role) => {
      const { data, error } = await supabase
        .from('document_collaborators')
        .insert([{ document_id: documentId, user_id: userId, role }])
        .select()
        .single();
      return { data, error };
    },

    updateRole: async (documentId, userId, role) => {
      const { data, error } = await supabase
        .from('document_collaborators')
        .update({ role })
        .eq('document_id', documentId)
        .eq('user_id', userId)
        .select()
        .single();
      return { data, error };
    },

    remove: async (documentId, userId) => {
      const { error } = await supabase
        .from('document_collaborators')
        .delete()
        .eq('document_id', documentId)
        .eq('user_id', userId);
      return { error };
    }
  },

  // Message operations
  messages: {
    findByDocument: async (documentId, limit = 50) => {
      const { data, error } = await supabase
        .from('messages')
        .select(`
          *,
          sender:sender_id(id, name, email, avatar_url)
        `)
        .eq('document_id', documentId)
        .order('created_at', { ascending: true })
        .limit(limit);
      return { data, error };
    },

    create: async (messageData) => {
      const { data, error } = await supabase
        .from('messages')
        .insert([messageData])
        .select(`
          *,
          sender:sender_id(id, name, email, avatar_url)
        `)
        .single();
      return { data, error };
    },

    deleteByDocument: async (documentId) => {
      const { error } = await supabase
        .from('messages')
        .delete()
        .eq('document_id', documentId);
      return { error };
    }
  },

  // Version history operations
  versions: {
    findByDocument: async (documentId) => {
      const { data, error } = await supabase
        .from('document_versions')
        .select(`
          *,
          user:user_id(id, name, email)
        `)
        .eq('document_id', documentId)
        .order('created_at', { ascending: false });
      return { data, error };
    },

    create: async (versionData) => {
      const { data, error } = await supabase
        .from('document_versions')
        .insert([versionData])
        .select()
        .single();
      return { data, error };
    },

    findById: async (id) => {
      const { data, error } = await supabase
        .from('document_versions')
        .select('*')
        .eq('id', id)
        .single();
      return { data, error };
    }
  }
};

export default supabase;
