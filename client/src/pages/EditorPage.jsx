import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  Share2,
  MessageSquare,
  Save,
  Loader2,
  Send,
  X
} from 'lucide-react'

const EditorPage = () => {
  const { documentId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [document, setDocument] = useState(null)
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [showChat, setShowChat] = useState(false)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareLinkCopied, setShareLinkCopied] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  
  const chatEndRef = useRef(null)
  const saveTimeoutRef = useRef(null)

  // Load document
  useEffect(() => {
    const loadDocument = async () => {
      try {
        // Get document with owner and collaborators
        const { data: doc, error: docError } = await supabase
          .from('documents')
          .select('*, owner:owner_id(*), collaborators:document_collaborators(*)')
          .eq('id', documentId)
          .single()

        if (docError || !doc) {
          throw new Error('Document not found')
        }

        // Check permissions
        const isOwner = doc.owner_id === user.id
        const isCollaborator = doc.collaborators?.some(c => c.user_id === user.id)
        const collabRole = doc.collaborators?.find(c => c.user_id === user.id)?.role

        if (!isOwner && !isCollaborator) {
          throw new Error('Access denied')
        }

        setDocument(doc)
        setContent(doc.content || '')
        setTitle(doc.title)
        setCanEdit(isOwner || collabRole === 'editor')

        // Load messages
        const { data: msgs } = await supabase
          .from('messages')
          .select('*, sender:sender_id(*)')
          .eq('document_id', documentId)
          .order('created_at', { ascending: true })

        setMessages(msgs || [])
      } catch (error) {
        toast.error(error.message || 'Failed to load document')
        navigate('/dashboard')
      } finally {
        setIsLoading(false)
      }
    }

    loadDocument()
  }, [documentId, user, navigate])

  // Subscribe to realtime changes
  useEffect(() => {
    if (isLoading) return

    // Subscribe to document updates
    const docSubscription = supabase
      .channel(`doc-${documentId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'documents', filter: `id=eq.${documentId}` },
        (payload) => {
          if (payload.new.content !== content) {
            setContent(payload.new.content)
          }
          if (payload.new.title !== title) {
            setTitle(payload.new.title)
          }
        }
      )
      .subscribe()

    // Subscribe to new messages
    const msgSubscription = supabase
      .channel(`msgs-${documentId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `document_id=eq.${documentId}` },
        (payload) => {
          setMessages(prev => [...prev, payload.new])
        }
      )
      .subscribe()

    return () => {
      docSubscription.unsubscribe()
      msgSubscription.unsubscribe()
    }
  }, [documentId, isLoading, content, title])

  // Auto-scroll chat
  useEffect(() => {
    if (showChat && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, showChat])

  // Debounced auto-save
  const handleContentChange = (e) => {
    if (!canEdit) return
    
    const newContent = e.target.value
    setContent(newContent)

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Auto-save after 1 second
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        await supabase
          .from('documents')
          .update({ content: newContent })
          .eq('id', documentId)
      } catch (error) {
        console.error('Auto-save failed:', error)
      }
    }, 1000)
  }

  // Save document
  const handleSave = async () => {
    if (!canEdit) return
    
    setIsSaving(true)
    try {
      await supabase
        .from('documents')
        .update({ title, content })
        .eq('id', documentId)
      
      toast.success('Document saved')
    } catch (error) {
      toast.error('Failed to save')
    } finally {
      setIsSaving(false)
    }
  }

  // Send message
  const handleSendMessage = async (e) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    try {
      await supabase
        .from('messages')
        .insert([{
          document_id: documentId,
          sender_id: user.id,
          content: newMessage.trim()
        }])

      setNewMessage('')
    } catch (error) {
      toast.error('Failed to send message')
    }
  }

  // Copy share link
  const handleCopyShareLink = async () => {
    const link = `${window.location.origin}/editor/join/${document?.share_id}`
    try {
      await navigator.clipboard.writeText(link)
      setShareLinkCopied(true)
      toast.success('Link copied!')
      setTimeout(() => setShareLinkCopied(false), 2000)
    } catch (error) {
      toast.error('Failed to copy')
    }
  }

  const formatTime = (dateString) => {
    const date = new Date(dateString)
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  if (isLoading) {
    return <LoadingSpinner fullScreen />
  }

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col -mx-4 -my-8">
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={!canEdit}
              className="font-semibold text-lg bg-transparent border-none focus:outline-none focus:ring-0 disabled:text-gray-600"
            />
            <div className="text-sm text-gray-500">
              {isSaving ? 'Saving...' : 'Auto-saves every second'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>

          {canEdit && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </button>
          )}

          <button
            onClick={() => setShowChat(!showChat)}
            className={`p-2 rounded-lg transition-colors ${showChat ? 'bg-primary-100 text-primary-600' : 'hover:bg-gray-100 text-gray-600'}`}
          >
            <MessageSquare className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className={`flex-1 ${showChat ? 'mr-80' : ''}`}>
          <div className="h-full p-8 overflow-auto">
            <div className="max-w-4xl mx-auto bg-white min-h-full shadow-sm border border-gray-200 rounded-lg">
              <textarea
                value={content}
                onChange={handleContentChange}
                disabled={!canEdit}
                placeholder={canEdit ? "Start typing..." : "View-only mode"}
                className="w-full min-h-[600px] p-8 resize-none border-none focus:outline-none focus:ring-0 disabled:bg-gray-50 text-gray-800 leading-relaxed"
                style={{ fontFamily: 'system-ui, sans-serif', fontSize: '16px', lineHeight: '1.6' }}
              />
            </div>
          </div>
        </div>

        {showChat && (
          <div className="w-80 bg-white border-l border-gray-200 flex flex-col animate-slide-in">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Chat
              </h3>
              <button onClick={() => setShowChat(false)} className="p-1 hover:bg-gray-100 rounded">
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender_id === user?.id ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                      msg.sender_id === user?.id
                        ? 'bg-primary-500 text-white rounded-br-none'
                        : 'bg-gray-100 text-gray-800 rounded-bl-none'
                    }`}
                  >
                    {msg.sender_id !== user?.id && (
                      <p className="text-xs font-medium mb-1 opacity-75">
                        {msg.sender?.name || 'Unknown'}
                      </p>
                    )}
                    <p>{msg.content}</p>
                  </div>
                  <span className="text-xs text-gray-400 mt-1">
                    {formatTime(msg.created_at)}
                  </span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-4 border-t border-gray-200">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="p-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md m-4">
            <h2 className="text-lg font-semibold mb-4">Share Document</h2>
            <p className="text-gray-600 mb-4">Share this link:</p>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/editor/join/${document?.share_id}`}
                className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
              />
              <button
                onClick={handleCopyShareLink}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600"
              >
                {shareLinkCopied ? 'Copied!' : <Share2 className="h-4 w-4" />}
              </button>
            </div>
            <button
              onClick={() => setShowShareModal(false)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default EditorPage
