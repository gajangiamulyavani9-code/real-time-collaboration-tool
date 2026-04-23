import { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { documentAPI, messageAPI } from '../services/api'
import { useSocket } from '../contexts/SocketContext'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  Share2,
  Users,
  MessageSquare,
  Save,
  Loader2,
  Send,
  MoreHorizontal,
  Clock,
  Check,
  CheckCheck,
  User,
  X
} from 'lucide-react'

// User color map for consistent cursor colors
const userColors = [
  '#EF4444', '#F59E0B', '#10B981', '#3B82F6', 
  '#6366F1', '#8B5CF6', '#EC4899', '#14B8A6'
]

const getUserColor = (userId) => {
  let hash = 0
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) - hash) + userId.charCodeAt(i)
    hash = hash & hash
  }
  return userColors[Math.abs(hash) % userColors.length]
}

const EditorPage = () => {
  const { documentId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { 
    isConnected, 
    joinDocument, 
    leaveDocument, 
    sendDocumentChange,
    sendCursorMove,
    sendMessage,
    requestSave,
    subscribe 
  } = useSocket()

  // State
  const [document, setDocument] = useState(null)
  const [content, setContent] = useState('')
  const [title, setTitle] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState(null)
  const [activeUsers, setActiveUsers] = useState([])
  const [cursors, setCursors] = useState({})
  const [showChat, setShowChat] = useState(false)
  const [messages, setMessages] = useState([])
  const [newMessage, setNewMessage] = useState('')
  const [typingUsers, setTypingUsers] = useState([])
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareLinkCopied, setShareLinkCopied] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  
  const editorRef = useRef(null)
  const chatEndRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const contentRef = useRef(content)

  // Keep content ref in sync
  useEffect(() => {
    contentRef.current = content
  }, [content])

  // Initial document load
  useEffect(() => {
    const loadDocument = async () => {
      try {
        const { data } = await documentAPI.getById(documentId)
        const doc = data.data.document
        setDocument(doc)
        setContent(doc.content || '')
        setTitle(doc.title)
        setCanEdit(doc.role === 'owner' || doc.role === 'editor')
        setIsLoading(false)

        // Load messages
        const { data: msgData } = await messageAPI.getByDocument(documentId)
        setMessages(msgData.data.messages || [])
      } catch (error) {
        toast.error('Failed to load document')
        navigate('/dashboard')
      }
    }

    loadDocument()
  }, [documentId, navigate])

  // Socket connection and event handlers
  useEffect(() => {
    if (isLoading || !isConnected) return

    // Join document room
    joinDocument(documentId)

    // Subscribe to events
    const unsubscribers = []

    // User joined/left events
    unsubscribers.push(subscribe('user-joined', ({ user: joinedUser, role, color }) => {
      setActiveUsers(prev => {
        if (prev.find(u => u.id === joinedUser.id)) return prev
        return [...prev, { ...joinedUser, role, color }]
      })
      toast.success(`${joinedUser.name} joined`)
    }))

    unsubscribers.push(subscribe('user-left', ({ userId, userName }) => {
      setActiveUsers(prev => prev.filter(u => u.id !== userId))
      setCursors(prev => {
        const next = { ...prev }
        delete next[userId]
        return next
      })
      toast(`${userName} left`, { icon: '👋' })
    }))

    // Active users list
    unsubscribers.push(subscribe('active-users', ({ users }) => {
      setActiveUsers(users.filter(u => u.id !== user?.id))
    }))

    // Document updates
    unsubscribers.push(subscribe('content-changed', ({ content: newContent, userId, userName }) => {
      if (userId !== user?.id) {
        setContent(newContent)
        toast.success(`${userName} made changes`, { duration: 1500 })
      }
    }))

    unsubscribers.push(subscribe('document-saved', ({ timestamp }) => {
      setLastSaved(new Date(timestamp))
      setIsSaving(false)
    }))

    // Cursor updates
    unsubscribers.push(subscribe('cursor-update', ({ userId, userName, cursor, color }) => {
      setCursors(prev => ({
        ...prev,
        [userId]: { userName, cursor, color, timestamp: Date.now() }
      }))
    }))

    // Chat messages
    unsubscribers.push(subscribe('new-message', ({ message }) => {
      setMessages(prev => [...prev, message])
    }))

    // Typing indicators
    unsubscribers.push(subscribe('user-typing', ({ userId, userName, isTyping }) => {
      if (userId === user?.id) return
      
      setTypingUsers(prev => {
        if (isTyping) {
          if (prev.find(u => u.id === userId)) return prev
          return [...prev, { id: userId, name: userName }]
        }
        return prev.filter(u => u.id !== userId)
      })
    }))

    // Cleanup on unmount
    return () => {
      leaveDocument(documentId)
      unsubscribers.forEach(unsub => unsub())
    }
  }, [isLoading, isConnected, documentId, joinDocument, leaveDocument, subscribe, user])

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (showChat && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, showChat])

  // Handle content change
  const handleContentChange = (e) => {
    if (!canEdit) return
    
    const newContent = e.target.value
    setContent(newContent)
    
    // Send to other users
    sendDocumentChange(documentId, newContent, { type: 'content' })

    // Handle typing indicator
    sendTyping(documentId, true)
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    
    typingTimeoutRef.current = setTimeout(() => {
      sendTyping(documentId, false)
    }, 1000)
  }

  // Handle title change
  const handleTitleChange = async (e) => {
    const newTitle = e.target.value
    setTitle(newTitle)
    
    // Auto-save title (debounced)
    // For simplicity, save immediately or implement debounce
  }

  // Save document
  const handleSave = async () => {
    if (!canEdit) return
    
    setIsSaving(true)
    try {
      await documentAPI.update(documentId, { 
        title,
        content: contentRef.current 
      })
      requestSave(documentId, contentRef.current)
      toast.success('Document saved')
    } catch (error) {
      toast.error('Failed to save')
      setIsSaving(false)
    }
  }

  // Send chat message
  const handleSendMessage = (e) => {
    e.preventDefault()
    if (!newMessage.trim()) return

    sendMessage(documentId, newMessage)
    setNewMessage('')
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
      {/* Header */}
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
              onChange={handleTitleChange}
              disabled={!canEdit}
              className="font-semibold text-lg bg-transparent border-none focus:outline-none focus:ring-0 disabled:text-gray-600"
            />
            <div className="flex items-center gap-2 text-sm text-gray-500">
              {lastSaved && (
                <span>Last saved {formatTime(lastSaved)}</span>
              )}
              {isSaving && (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Saving...
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Active Users */}
          <div className="flex items-center gap-2 mr-4">
            <div className="flex -space-x-2">
              {activeUsers.slice(0, 3).map((u) => (
                <div
                  key={u.id}
                  className="h-8 w-8 rounded-full flex items-center justify-center text-white text-xs font-medium ring-2 ring-white"
                  style={{ backgroundColor: u.color || getUserColor(u.id) }}
                  title={u.name}
                >
                  {u.name.charAt(0).toUpperCase()}
                </div>
              ))}
              {activeUsers.length > 3 && (
                <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-medium ring-2 ring-white">
                  +{activeUsers.length - 3}
                </div>
              )}
            </div>
            <span className="text-sm text-gray-500">
              {activeUsers.length} active
            </span>
          </div>

          {/* Share Button */}
          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>

          {/* Save Button */}
          {canEdit && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Save
            </button>
          )}

          {/* Chat Toggle */}
          <button
            onClick={() => setShowChat(!showChat)}
            className={`p-2 rounded-lg transition-colors ${
              showChat ? 'bg-primary-100 text-primary-600' : 'hover:bg-gray-100 text-gray-600'
            }`}
          >
            <MessageSquare className="h-5 w-5" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Editor */}
        <div className={`flex-1 ${showChat ? 'mr-80' : ''}`}>
          <div className="h-full p-8 overflow-auto">
            <div className="max-w-4xl mx-auto bg-white min-h-full shadow-sm border border-gray-200 rounded-lg">
              <textarea
                ref={editorRef}
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

        {/* Chat Sidebar */}
        {showChat && (
          <div className="w-80 bg-white border-l border-gray-200 flex flex-col animate-slide-in">
            {/* Chat Header */}
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Chat
              </h3>
              <button
                onClick={() => setShowChat(false)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-4 w-4 text-gray-500" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${
                    msg.sender.id === user?.id ? 'items-end' : 'items-start'
                  }`}
                >
                  <div
                    className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                      msg.sender.id === user?.id
                        ? 'bg-primary-500 text-white rounded-br-none'
                        : 'bg-gray-100 text-gray-800 rounded-bl-none'
                    }`}
                  >
                    {msg.sender.id !== user?.id && (
                      <p className="text-xs font-medium mb-1 opacity-75">
                        {msg.sender.name}
                      </p>
                    )}
                    <p>{msg.content}</p>
                  </div>
                  <span className="text-xs text-gray-400 mt-1">
                    {formatTime(msg.created_at)}
                  </span>
                </div>
              ))}
              
              {/* Typing Indicator */}
              {typingUsers.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                  <span>
                    {typingUsers.map(u => u.name).join(', ')} typing...
                  </span>
                </div>
              )}
              
              <div ref={chatEndRef} />
            </div>

            {/* Message Input */}
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

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md m-4">
            <h2 className="text-lg font-semibold mb-4">Share Document</h2>
            <p className="text-gray-600 mb-4">
              Anyone with this link can join the document:
            </p>
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
                {shareLinkCopied ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
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
