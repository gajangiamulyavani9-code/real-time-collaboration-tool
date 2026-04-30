import { createClient } from '@supabase/supabase-js';
import { ApiError, asyncHandler } from '../middleware/errorHandler.js';

const MAX_DOCUMENT_CHARS = 12000;
const MAX_CONTEXT_MESSAGES = 8;

const getSupabaseConfig = () => {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey =
    process.env.SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY;

  if (!url || !anonKey) {
    throw new ApiError(500, 'Supabase is not configured for AI requests');
  }

  return { url, anonKey };
};

const createUserSupabaseClient = (token) => {
  const { url, anonKey } = getSupabaseConfig();

  return createClient(url, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

const stripHtml = (html = '') =>
  String(html)
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const trimText = (value = '', maxLength = MAX_DOCUMENT_CHARS) => {
  const text = String(value);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}\n\n[Document truncated for AI context]`;
};

const extractResponseText = (payload) => {
  if (payload?.output_text) return payload.output_text;

  const parts = payload?.output
    ?.flatMap((item) => item.content || [])
    ?.map((content) => content.text || '')
    ?.filter(Boolean);

  return parts?.join('\n').trim() || '';
};

const buildModeInstruction = (mode) => {
  const instructions = {
    summarize: 'Summarize the document clearly and keep it useful for collaborators.',
    improve: 'Suggest concrete improvements to the document. Include rewrites only when helpful.',
    actions: 'Extract action items, decisions, owners if mentioned, and open questions.',
    ask: 'Answer the user question using the document and chat context. If the answer is not in the context, say so briefly.',
  };

  return instructions[mode] || instructions.ask;
};

export const assistWithDocument = asyncHandler(async (req, res) => {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';

  if (!token) {
    throw new ApiError(401, 'Supabase session token is required');
  }

  const { documentId, prompt = '', mode = 'ask', messages = [] } = req.body;

  if (!documentId) {
    throw new ApiError(400, 'Document ID is required');
  }

  if (mode === 'ask' && !String(prompt).trim()) {
    throw new ApiError(400, 'Ask the assistant something first');
  }

  const openAiApiKey = process.env.OPENAI_API_KEY;
  if (!openAiApiKey) {
    throw new ApiError(501, 'AI is not configured. Add OPENAI_API_KEY to the server environment.');
  }

  const userSupabase = createUserSupabaseClient(token);
  const { data: userData, error: userError } = await userSupabase.auth.getUser(token);

  if (userError || !userData?.user) {
    throw new ApiError(401, 'Invalid Supabase session');
  }

  const { data: document, error: docError } = await userSupabase
    .from('documents')
    .select('id, title, content')
    .eq('id', documentId)
    .single();

  if (docError || !document) {
    throw new ApiError(404, 'Document not found or access denied');
  }

  const recentMessages = Array.isArray(messages)
    ? messages
        .slice(-MAX_CONTEXT_MESSAGES)
        .map((message) => `${message.sender?.name || 'Collaborator'}: ${message.content}`)
        .join('\n')
    : '';

  const documentText = trimText(stripHtml(document.content || ''));
  const userPrompt = String(prompt).trim();

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: [
                'You are an AI assistant inside a collaborative document editor.',
                'Be concise, practical, and specific.',
                'Do not invent facts beyond the provided document and chat context.',
                buildModeInstruction(mode),
              ].join(' '),
            },
          ],
        },
        {
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: [
                `Document title: ${document.title || 'Untitled Document'}`,
                `Document content:\n${documentText || '[Empty document]'}`,
                recentMessages ? `Recent chat:\n${recentMessages}` : 'Recent chat: [none]',
                userPrompt ? `User request: ${userPrompt}` : `User request: ${buildModeInstruction(mode)}`,
              ].join('\n\n'),
            },
          ],
        },
      ],
    }),
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    const message = payload?.error?.message || 'AI request failed';
    throw new ApiError(response.status, message);
  }

  const answer = extractResponseText(payload);

  if (!answer) {
    throw new ApiError(502, 'AI returned an empty response');
  }

  res.status(200).json({
    success: true,
    data: { answer },
  });
});
