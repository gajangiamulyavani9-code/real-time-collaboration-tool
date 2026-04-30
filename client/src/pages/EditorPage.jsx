import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'
import toast from 'react-hot-toast'
import {
  ArrowLeft,
  Image,
  Link,
  Save,
  Trash2,
  Share2,
  MessageSquare,
  Send,
  Smile,
  X
} from 'lucide-react'

const QUICK_EMOJIS = [
  '\u{1F600}',
  '\u{1F602}',
  '\u{1F60D}',
  '\u{1F44D}',
  '\u{1F44F}',
  '\u{1F389}',
  '\u{1F525}',
  '\u{1F4A1}',
  '\u2705',
  '\u2B50',
  '\u2764\uFE0F',
  '\u{1F680}',
]

const MAX_INLINE_IMAGE_SIZE = 1.5 * 1024 * 1024

const hasHtmlMarkup = (value) => /<\/?[a-z][\s\S]*>/i.test(value)

const escapeHtml = (value) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')

const normalizeContentForEditor = (value = '') => {
  if (!value) return ''
  return hasHtmlMarkup(value) ? sanitizeEditorHtml(value) : escapeHtml(value).replace(/\n/g, '<br>')
}

const normalizeUrl = (value) => {
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (/^https?:\/\//i.test(trimmed)) return trimmed
  return `https://${trimmed}`
}

const isValidHttpUrl = (value) => {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

const isValidImageSrc = (value) => {
  if (/^data:image\/(png|jpe?g|gif|webp);base64,/i.test(value)) return true
  return isValidHttpUrl(value)
}

const readJson = (value) => {
  try {
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

const getPlainText = (html = '') => {
  if (typeof window === 'undefined') return html
  const element = window.document.createElement('div')
  element.innerHTML = html
  return element.textContent || ''
}

const persistLocalDraft = (key, updates) => {
  try {
    localStorage.setItem(key, JSON.stringify({
      title: updates.title,
      content: updates.content,
      savedAt: new Date().toISOString(),
      plainText: getPlainText(updates.content),
    }))
  } catch (error) {
    console.warn('Local draft backup failed:', error)
  }
}

const clearLocalDraft = (key) => {
  try {
    localStorage.removeItem(key)
  } catch (error) {
    console.warn('Local draft cleanup failed:', error)
  }
}

const getLocalDraft = (key) => {
  try {
    return readJson(localStorage.getItem(key))
  } catch {
    return null
  }
}

const ensureImageIds = (root) => {
  root.querySelectorAll('img').forEach((image) => {
    if (!image.dataset.imageId) {
      image.dataset.imageId = crypto.randomUUID()
    }
    image.draggable = true
  })
}

const sanitizeEditorHtml = (value = '') => {
  if (typeof window === 'undefined') return value

  const template = window.document.createElement('template')
  template.innerHTML = value

  template.content.querySelectorAll('script, style, iframe, object, embed').forEach((node) => node.remove())
  template.content.querySelectorAll('*').forEach((node) => {
    Array.from(node.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase()
      const attrValue = attr.value

      if (name.startsWith('on') || name === 'style') {
        node.removeAttribute(attr.name)
        return
      }

      if (node.tagName === 'A') {
        if (name === 'href') {
          const url = normalizeUrl(attrValue)
          if (isValidHttpUrl(url)) {
            node.setAttribute('href', url)
            node.setAttribute('target', '_blank')
            node.setAttribute('rel', 'noopener noreferrer')
          } else {
            node.removeAttribute('href')
          }
          return
        }
        if (name === 'target' || name === 'rel') return
      }

      if (node.tagName === 'IMG') {
        if (!node.getAttribute('data-image-id')) {
          node.setAttribute('data-image-id', crypto.randomUUID())
        }
        node.setAttribute('draggable', 'true')

        if (name === 'src') {
          const url = normalizeUrl(attrValue)
          const src = attrValue.startsWith('data:image/') ? attrValue : url
          if (isValidImageSrc(src)) {
            node.setAttribute('src', src)
          } else {
            node.remove()
          }
          return
        }
        if (name === 'alt') return
        if (name === 'data-image-id') return
        if (name === 'draggable') return
      }

      node.removeAttribute(attr.name)
    })
  })

  return template.innerHTML
}

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
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showLinkPanel, setShowLinkPanel] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkText, setLinkText] = useState('')
  const [selectedImageId, setSelectedImageId] = useState('')
  
  const chatEndRef = useRef(null)
  const editorRef = useRef(null)
  const imageInputRef = useRef(null)
  const savedSelectionRef = useRef(null)
  const draggedImageIdRef = useRef('')
  const saveTimeoutRef = useRef(null)
  const pendingSaveRef = useRef(null)
  const latestSaveTokenRef = useRef(0)
  const realtimeChannelRef = useRef(null)
  const lastPersistedAtRef = useRef('')
  const contentRef = useRef('')
  const titleRef = useRef('')
  const localDraftKey = `collab-doc-draft-${documentId}-${user?.id || 'guest'}`

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

        const serverContent = normalizeContentForEditor(doc.content || '')
        const localDraft = getLocalDraft(localDraftKey)
        const draftHasChanges =
          localDraft?.content &&
          normalizeContentForEditor(localDraft.content) !== serverContent
        const draftIsNewer =
          localDraft?.content &&
          localDraft?.savedAt &&
          new Date(localDraft.savedAt).getTime() > new Date(doc.updated_at || 0).getTime()
        const shouldRestoreDraft = draftHasChanges || draftIsNewer
        const docContent = shouldRestoreDraft ? normalizeContentForEditor(localDraft.content) : serverContent

        if (shouldRestoreDraft) {
          const { error } = await supabase
            .from('documents')
            .update({ title: localDraft.title || doc.title, content: docContent })
            .eq('id', documentId)

          if (error) {
            toast.error('Restored unsaved local draft. Server save still needs retry.')
          }
        }

        setDocument(doc)
        setContent(docContent)
        setTitle(shouldRestoreDraft ? localDraft.title || doc.title : doc.title)
        contentRef.current = docContent
        titleRef.current = shouldRestoreDraft ? localDraft.title || doc.title : doc.title
        lastPersistedAtRef.current = doc.updated_at || ''
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

    const docSubscription = supabase
      .channel(`doc-${documentId}`, {
        config: {
          broadcast: { self: false },
        },
      })
      .on('broadcast', { event: 'document-change' }, ({ payload }) => {
        if (payload.userId === user?.id) return

        if (typeof payload.content === 'string' && payload.content !== contentRef.current) {
          const nextContent = normalizeContentForEditor(payload.content)
          contentRef.current = nextContent
          setContent(nextContent)
        }

        if (typeof payload.title === 'string' && payload.title !== titleRef.current) {
          titleRef.current = payload.title
          setTitle(payload.title)
        }
      })
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'documents', filter: `id=eq.${documentId}` },
        (payload) => {
          const nextTitle = payload.new.title || ''
          const nextContent = normalizeContentForEditor(payload.new.content || '')
          const pendingSave = pendingSaveRef.current
          const persistedAt = payload.new.updated_at || ''
          const incomingSavePayload = { title: nextTitle, content: nextContent }

          if (
            pendingSave &&
            !isSameSavePayload(incomingSavePayload, {
              title: pendingSave.title,
              content: normalizeContentForEditor(pendingSave.content || ''),
            })
          ) {
            return
          }

          if (lastPersistedAtRef.current && persistedAt && persistedAt < lastPersistedAtRef.current) {
            return
          }

          lastPersistedAtRef.current = persistedAt || lastPersistedAtRef.current

          if (nextContent !== contentRef.current) {
            contentRef.current = nextContent
            setContent(nextContent)
          }
          if (nextTitle !== titleRef.current) {
            titleRef.current = nextTitle
            setTitle(nextTitle)
          }
        }
      )
      .subscribe()
    realtimeChannelRef.current = docSubscription

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
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      if (pendingSaveRef.current) {
        saveDocumentNow(pendingSaveRef.current, latestSaveTokenRef.current)
      }
      realtimeChannelRef.current = null
      docSubscription.unsubscribe()
      msgSubscription.unsubscribe()
    }
  }, [documentId, isLoading, user?.id])

  // Auto-scroll chat
  useEffect(() => {
    if (showChat && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, showChat])

  useEffect(() => {
    if (!editorRef.current || window.document.activeElement === editorRef.current) return
    if (editorRef.current.innerHTML !== content) {
      editorRef.current.innerHTML = content
      ensureImageIds(editorRef.current)
    }
  }, [content])

  useEffect(() => {
    if (!editorRef.current) return

    editorRef.current.querySelectorAll('img').forEach((image) => {
      image.classList.toggle('is-selected', image.dataset.imageId === selectedImageId)
    })
  }, [selectedImageId, content])

  const broadcastDocumentChange = (updates) => {
    realtimeChannelRef.current?.send({
      type: 'broadcast',
      event: 'document-change',
      payload: {
        userId: user.id,
        ...updates,
      },
    })
  }

  const isSameSavePayload = (first, second) =>
    first?.title === second?.title && first?.content === second?.content

  const saveDocumentNow = async (updates, token = latestSaveTokenRef.current) => {
    if (!canEdit && !isLoading) return false

    try {
      const { data, error } = await supabase
        .from('documents')
        .update(updates)
        .eq('id', documentId)
        .select('id, title, content, updated_at')
        .single()

      if (error) throw error
      if (!data?.id) throw new Error('No document was updated')

      const persistedPayload = {
        title: data.title || '',
        content: normalizeContentForEditor(data.content || ''),
      }
      const expectedPayload = {
        title: updates.title || '',
        content: normalizeContentForEditor(updates.content || ''),
      }

      if (!isSameSavePayload(persistedPayload, expectedPayload)) {
        throw new Error('Saved content did not match the latest editor content')
      }

      lastPersistedAtRef.current = data.updated_at || lastPersistedAtRef.current

      const isLatestSave = token === latestSaveTokenRef.current && isSameSavePayload(updates, pendingSaveRef.current)

      if (isLatestSave) {
        pendingSaveRef.current = null
        clearLocalDraft(localDraftKey)
      } else if (token !== latestSaveTokenRef.current) {
        const latestUpdates = {
          title: titleRef.current,
          content: contentRef.current,
        }
        pendingSaveRef.current = latestUpdates
        persistLocalDraft(localDraftKey, latestUpdates)
        window.setTimeout(() => {
          saveDocumentNow(latestUpdates, latestSaveTokenRef.current)
        }, 0)
      }

      return true
    } catch (error) {
      console.error('Auto-save failed:', error)
      persistLocalDraft(localDraftKey, updates)
      toast.error('Could not save latest changes')
      return false
    } finally {
      if (token === latestSaveTokenRef.current || !pendingSaveRef.current) {
        setIsSaving(false)
      }
    }
  }

  const flushPendingSave = async () => {
    if (!pendingSaveRef.current) return

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
      saveTimeoutRef.current = null
    }

    const token = latestSaveTokenRef.current
    await saveDocumentNow(pendingSaveRef.current, token)
  }

  const handleManualSave = async () => {
    if (!canEdit) return

    if (editorRef.current) {
      ensureImageIds(editorRef.current)
      contentRef.current = sanitizeEditorHtml(editorRef.current.innerHTML)
    }

    setIsSaving(true)
    const token = latestSaveTokenRef.current + 1
    latestSaveTokenRef.current = token
    pendingSaveRef.current = {
      title: titleRef.current,
      content: contentRef.current,
    }
    persistLocalDraft(localDraftKey, pendingSaveRef.current)
    const saved = await saveDocumentNow({
      title: titleRef.current,
      content: contentRef.current,
    }, token)

    if (saved) {
      toast.success('Document saved')
    }
  }

  const scheduleAutoSave = (updates) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    const token = latestSaveTokenRef.current + 1
    latestSaveTokenRef.current = token
    pendingSaveRef.current = updates
    persistLocalDraft(localDraftKey, updates)
    setIsSaving(true)
    saveTimeoutRef.current = setTimeout(async () => {
      await saveDocumentNow(updates, token)
    }, 350)
  }

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (window.document.visibilityState === 'hidden') {
        flushPendingSave()
      }
    }

  const handleBeforeUnload = () => {
      if (pendingSaveRef.current) {
        persistLocalDraft(localDraftKey, pendingSaveRef.current)
      }
    }

    window.document.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', handleBeforeUnload)

    return () => {
      window.document.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [localDraftKey])

  const updateDocumentContent = (newContent) => {
    const sanitizedContent = sanitizeEditorHtml(newContent)
    contentRef.current = sanitizedContent
    setContent(sanitizedContent)
    broadcastDocumentChange({ content: sanitizedContent })
    scheduleAutoSave({ title: titleRef.current, content: sanitizedContent })
  }

  const handleTitleChange = (e) => {
    if (!canEdit) return

    const newTitle = e.target.value
    titleRef.current = newTitle
    setTitle(newTitle)
    broadcastDocumentChange({ title: newTitle })
    scheduleAutoSave({ title: newTitle, content: contentRef.current })
  }

  const handleContentChange = (e) => {
    if (!canEdit) return

    ensureImageIds(e.currentTarget)
    updateDocumentContent(e.currentTarget.innerHTML)
    saveEditorSelection()
  }

  const focusEditor = () => {
    editorRef.current?.focus()
  }

  const saveEditorSelection = () => {
    const selection = window.getSelection()
    if (!selection?.rangeCount || !editorRef.current?.contains(selection.anchorNode)) return
    savedSelectionRef.current = selection.getRangeAt(0)
  }

  const restoreEditorSelection = () => {
    const selection = window.getSelection()
    if (!selection || !savedSelectionRef.current) return
    selection.removeAllRanges()
    selection.addRange(savedSelectionRef.current)
  }

  const insertHtmlIntoEditor = (html) => {
    if (!canEdit) return

    focusEditor()
    restoreEditorSelection()
    window.document.execCommand('insertHTML', false, html)
    updateDocumentContent(editorRef.current?.innerHTML || '')
    saveEditorSelection()
  }

  const handleInsertEmoji = (emoji) => {
    insertHtmlIntoEditor(emoji)
    setShowEmojiPicker(false)
  }

  const handleInsertLink = (e) => {
    e.preventDefault()
    const url = normalizeUrl(linkUrl)

    if (!isValidHttpUrl(url)) {
      toast.error('Enter a valid URL')
      return
    }

    const selectedText = savedSelectionRef.current?.toString()
    const text = linkText.trim() || selectedText || url
    insertHtmlIntoEditor(
      `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(text)}</a>`
    )
    setLinkUrl('')
    setLinkText('')
    setShowLinkPanel(false)
  }

  const handleOpenImagePicker = () => {
    if (!canEdit) return
    saveEditorSelection()
    imageInputRef.current?.click()
  }

  const handleImageSelected = (e) => {
    const file = e.target.files?.[0]
    e.target.value = ''

    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast.error('Choose an image file')
      return
    }
    if (file.size > MAX_INLINE_IMAGE_SIZE) {
      toast.error('Image is too large. Please choose one under 1.5 MB')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      const src = String(reader.result || '')
      if (!isValidImageSrc(src)) {
        toast.error('Could not read this image')
        return
      }

      insertHtmlIntoEditor(
        `<img src="${src}" alt="${escapeHtml(file.name || 'Document image')}" data-image-id="${crypto.randomUUID()}" draggable="true" />`
      )
    }
    reader.onerror = () => toast.error('Could not read this image')
    reader.readAsDataURL(file)
  }

  const handleEditorClick = (e) => {
    const image = e.target.closest('img')
    if (image && editorRef.current?.contains(image)) {
      e.preventDefault()
      setSelectedImageId(image.dataset.imageId || '')
      return
    }

    setSelectedImageId('')

    const link = e.target.closest('a')
    if (!link?.href) return

    e.preventDefault()
    window.open(link.href, '_blank', 'noopener,noreferrer')
  }

  const deleteSelectedImage = () => {
    if (!selectedImageId || !editorRef.current) return

    const image = editorRef.current.querySelector(`img[data-image-id="${CSS.escape(selectedImageId)}"]`)
    if (!image) return

    image.remove()
    setSelectedImageId('')
    updateDocumentContent(editorRef.current.innerHTML)
  }

  const handleEditorDragStart = (e) => {
    const image = e.target.closest('img')
    if (!image || !editorRef.current?.contains(image)) return

    const imageId = image.dataset.imageId || crypto.randomUUID()
    image.dataset.imageId = imageId
    image.draggable = true
    draggedImageIdRef.current = imageId
    setSelectedImageId(imageId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', imageId)
  }

  const handleEditorDragOver = (e) => {
    if (!draggedImageIdRef.current) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleEditorDrop = (e) => {
    const imageId = draggedImageIdRef.current
    if (!imageId || !editorRef.current) return

    e.preventDefault()
    const image = editorRef.current.querySelector(`img[data-image-id="${CSS.escape(imageId)}"]`)
    if (!image) return

    const range =
      window.document.caretRangeFromPoint?.(e.clientX, e.clientY) ||
      (() => {
        const position = window.document.caretPositionFromPoint?.(e.clientX, e.clientY)
        if (!position) return null
        const nextRange = window.document.createRange()
        nextRange.setStart(position.offsetNode, position.offset)
        return nextRange
      })()

    if (!range || image.contains(range.startContainer)) return

    image.remove()
    range.insertNode(image)
    draggedImageIdRef.current = ''
    setSelectedImageId(imageId)
    updateDocumentContent(editorRef.current.innerHTML)
  }

  const handleEditorDragEnd = () => {
    draggedImageIdRef.current = ''
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
    await flushPendingSave()
    const link = `${window.location.origin}/join/${document?.share_id}`
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
            onClick={async () => {
              await flushPendingSave()
              navigate('/dashboard')
            }}
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
            <div className="text-sm text-gray-500">
              {isSaving ? 'Saving...' : 'Live auto-save'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleManualSave}
            disabled={!canEdit || isSaving}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            Save
          </button>

          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>

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
            <div className="max-w-4xl mx-auto bg-white min-h-full shadow-sm border border-gray-200 rounded-lg overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(prev => !prev)}
                  disabled={!canEdit}
                  title="Add emoji"
                  className="p-2 rounded-lg text-gray-600 hover:bg-white hover:text-primary-600 disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <Smile className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLinkPanel(prev => !prev)
                  }}
                  disabled={!canEdit}
                  title="Add link"
                  className="p-2 rounded-lg text-gray-600 hover:bg-white hover:text-primary-600 disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <Link className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleOpenImagePicker}
                  disabled={!canEdit}
                  title="Add image"
                  className="p-2 rounded-lg text-gray-600 hover:bg-white hover:text-primary-600 disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <Image className="h-4 w-4" />
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelected}
                  className="hidden"
                />

                {selectedImageId && (
                  <div className="flex items-center gap-2 border-l border-gray-200 pl-2">
                    <span className="text-xs text-gray-500">Image selected</span>
                    <button
                      type="button"
                      onClick={deleteSelectedImage}
                      title="Delete image"
                      className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {showEmojiPicker && (
                  <div className="flex flex-wrap gap-1 border-l border-gray-200 pl-2">
                    {QUICK_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => handleInsertEmoji(emoji)}
                        className="h-8 w-8 rounded-lg hover:bg-white text-lg"
                        title={`Insert ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {showLinkPanel && (
                <form onSubmit={handleInsertLink} className="grid gap-3 border-b border-gray-200 bg-white px-4 py-3 sm:grid-cols-[1fr_1fr_auto]">
                  <input
                    type="text"
                    inputMode="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                  <input
                    type="text"
                    value={linkText}
                    onChange={(e) => setLinkText(e.target.value)}
                    placeholder="Link text"
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 text-sm"
                  >
                    Add URL
                  </button>
                </form>
              )}

              <div
                ref={editorRef}
                contentEditable={canEdit}
                suppressContentEditableWarning
                dangerouslySetInnerHTML={{ __html: content }}
                onInput={handleContentChange}
                onClick={handleEditorClick}
                onDragStart={handleEditorDragStart}
                onDragOver={handleEditorDragOver}
                onDrop={handleEditorDrop}
                onDragEnd={handleEditorDragEnd}
                onKeyUp={saveEditorSelection}
                onMouseUp={saveEditorSelection}
                onBlur={flushPendingSave}
                data-placeholder={canEdit ? 'Start typing...' : 'View-only mode'}
                className="document-editor min-h-[600px] border-none shadow-none rounded-none text-gray-800"
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
                value={`${window.location.origin}/join/${document?.share_id}`}
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
