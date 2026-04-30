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
  Copy,
  Mail,
  Monitor,
  Smartphone,
  LayoutTemplate,
  Clapperboard,
  MessageSquare,
  Send,
  Smile,
  X,
  Type,
  TextCursorInput,
  Bot,
  Sparkles,
  Video,
  Minimize2,
  Maximize2
} from 'lucide-react'
import { inferDocumentTheme } from '../lib/documentThemes'

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
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const FONT_FAMILY_OPTIONS = [
  { label: 'Modern Sans', value: 'Manrope, Segoe UI, sans-serif' },
  { label: 'Classic Serif', value: 'Cormorant Garamond, Georgia, serif' },
  { label: 'Neutral Sans', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Monospace', value: 'JetBrains Mono, Consolas, monospace' },
]

const FONT_SIZE_OPTIONS = [
  { label: 'Small', value: '14px' },
  { label: 'Body', value: '16px' },
  { label: 'Reading', value: '18px' },
  { label: 'Large', value: '20px' },
]

const LAYOUT_OPTIONS = [
  { id: 'document', label: 'Document', helper: 'Classic writing canvas', icon: LayoutTemplate },
  { id: 'landscape', label: 'Landscape', helper: 'Wide post or deck slide', icon: Monitor },
  { id: 'mobile', label: 'Mobile', helper: 'Phone article preview', icon: Smartphone },
  { id: 'story', label: 'Story', helper: '9:16 story layout', icon: Smartphone },
  { id: 'reel', label: 'Reel', helper: 'Vertical reel cover', icon: Clapperboard },
]

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

const isValidVideoFileSrc = (value) => {
  if (!isValidHttpUrl(value)) return false
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(new URL(value).pathname + new URL(value).search)
}

const getSafeVideoEmbedSrc = (value) => {
  if (!isValidHttpUrl(value)) return ''

  const url = new URL(value)
  const host = url.hostname.replace(/^www\./i, '').toLowerCase()

  if (host === 'youtu.be') {
    const videoId = url.pathname.split('/').filter(Boolean)[0]
    return videoId ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}` : ''
  }

  if (host === 'youtube.com' || host === 'm.youtube.com') {
    const videoId = url.searchParams.get('v') || url.pathname.split('/').filter(Boolean).pop()
    return videoId ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(videoId)}` : ''
  }

  if (host === 'youtube-nocookie.com' && url.pathname.startsWith('/embed/')) {
    return url.toString()
  }

  if (host === 'vimeo.com') {
    const videoId = url.pathname.split('/').filter(Boolean)[0]
    return /^\d+$/.test(videoId || '') ? `https://player.vimeo.com/video/${videoId}` : ''
  }

  if (host === 'player.vimeo.com' && url.pathname.startsWith('/video/')) {
    return url.toString()
  }

  return ''
}

const buildSafeStyle = (styleValue = '') => {
  const allowed = new Map()
  const rules = styleValue
    .split(';')
    .map((rule) => rule.trim())
    .filter(Boolean)

  rules.forEach((rule) => {
    const separatorIndex = rule.indexOf(':')
    if (separatorIndex === -1) return

    const property = rule.slice(0, separatorIndex).trim().toLowerCase()
    const value = rule.slice(separatorIndex + 1).trim()

    if (!value) return

    if (property === 'font-size' && /^\d+(px|rem|em|%)$/i.test(value)) {
      allowed.set(property, value)
    }

    if (
      property === 'font-family' &&
      /^[a-z0-9\s,'"-]+$/i.test(value)
    ) {
      allowed.set(property, value)
    }

    if (property === 'font-weight' && /^(400|500|600|700|800|bold|normal)$/i.test(value)) {
      allowed.set(property, value)
    }

    if (property === 'font-style' && /^(italic|normal)$/i.test(value)) {
      allowed.set(property, value)
    }

    if (property === 'text-decoration' && /^(underline|none)$/i.test(value)) {
      allowed.set(property, value)
    }
  })

  return Array.from(allowed.entries())
    .map(([property, value]) => `${property}: ${value}`)
    .join('; ')
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

  root.querySelectorAll('.video-embed').forEach((video) => {
    if (!video.dataset.videoId) {
      video.dataset.videoId = crypto.randomUUID()
    }
    if (
      !video.classList.contains('video-size-small') &&
      !video.classList.contains('video-size-medium') &&
      !video.classList.contains('video-size-large')
    ) {
      video.classList.add('video-size-large')
    }
    video.draggable = true
  })
}

const sanitizeEditorHtml = (value = '') => {
  if (typeof window === 'undefined') return value

  const template = window.document.createElement('template')
  template.innerHTML = value

  template.content.querySelectorAll('script, style, object, embed').forEach((node) => node.remove())
  template.content.querySelectorAll('*').forEach((node) => {
    Array.from(node.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase()
      const attrValue = attr.value

      if (name.startsWith('on')) {
        node.removeAttribute(attr.name)
        return
      }

      if (name === 'style') {
        const safeStyle = buildSafeStyle(attrValue)
        if (safeStyle) {
          node.setAttribute('style', safeStyle)
        } else {
          node.removeAttribute(attr.name)
        }
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

      if (node.tagName === 'IFRAME') {
        if (name === 'src') {
          const url = getSafeVideoEmbedSrc(attrValue)
          if (url) {
            node.setAttribute('src', url)
          } else {
            node.remove()
          }
          return
        }
        if (['title', 'allow', 'allowfullscreen', 'loading', 'referrerpolicy'].includes(name)) return
      }

      if (node.tagName === 'VIDEO') {
        if (name === 'src') {
          const url = normalizeUrl(attrValue)
          if (isValidVideoFileSrc(url)) {
            node.setAttribute('src', url)
          } else {
            node.remove()
          }
          return
        }
        if (['controls', 'playsinline', 'preload'].includes(name)) return
      }

      if (node.tagName === 'DIV' && node.classList.contains('video-embed')) {
        if (name === 'class') {
          const safeClasses = attrValue
            .split(/\s+/)
            .filter((className) => ['video-embed', 'video-size-small', 'video-size-medium', 'video-size-large'].includes(className))
          node.setAttribute('class', Array.from(new Set(['video-embed', ...safeClasses])).join(' '))
          return
        }
        if (name === 'data-video-id') return
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
  const [showLayoutModal, setShowLayoutModal] = useState(false)
  const [shareLinkCopied, setShareLinkCopied] = useState(false)
  const [canEdit, setCanEdit] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [showLinkPanel, setShowLinkPanel] = useState(false)
  const [showVideoPanel, setShowVideoPanel] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')
  const [linkText, setLinkText] = useState('')
  const [videoUrl, setVideoUrl] = useState('')
  const [selectedImageId, setSelectedImageId] = useState('')
  const [selectedVideoId, setSelectedVideoId] = useState('')
  const [selectedVideoSize, setSelectedVideoSize] = useState('large')
  const [activeFontFamily, setActiveFontFamily] = useState(FONT_FAMILY_OPTIONS[0].value)
  const [activeFontSize, setActiveFontSize] = useState(FONT_SIZE_OPTIONS[1].value)
  const [layoutMode, setLayoutMode] = useState('document')
  const [isAiThinking, setIsAiThinking] = useState(false)
  
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
  }, [messages, showChat, isAiThinking])

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
    editorRef.current.querySelectorAll('.video-embed').forEach((video) => {
      video.classList.toggle('is-selected', video.dataset.videoId === selectedVideoId)
    })
  }, [selectedImageId, selectedVideoId, content])

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

  const wrapSelectionWithStyle = (styles) => {
    if (!canEdit || !editorRef.current) return

    focusEditor()
    restoreEditorSelection()

    const selection = window.getSelection()
    if (!selection?.rangeCount) return

    const range = selection.getRangeAt(0)
    if (!editorRef.current.contains(range.commonAncestorContainer)) return

    const styleString = Object.entries(styles)
      .filter(([, value]) => value)
      .map(([property, value]) => `${property}: ${value}`)
      .join('; ')

    if (!styleString) return

    if (range.collapsed) {
      window.document.execCommand('insertHTML', false, `<span style="${styleString}">\u200B</span>`)
      const insertedSpan = editorRef.current.querySelector('span[style]')
      if (insertedSpan?.textContent?.includes('\u200B')) {
        const nextRange = window.document.createRange()
        nextRange.setStart(insertedSpan.firstChild, 1)
        nextRange.collapse(true)
        selection.removeAllRanges()
        selection.addRange(nextRange)
        savedSelectionRef.current = nextRange
      }
    } else {
      const selectedHtml = range.cloneContents()
      const wrapper = window.document.createElement('span')
      wrapper.setAttribute('style', styleString)
      wrapper.appendChild(selectedHtml)
      range.deleteContents()
      range.insertNode(wrapper)
      const nextRange = window.document.createRange()
      nextRange.selectNodeContents(wrapper)
      nextRange.collapse(false)
      selection.removeAllRanges()
      selection.addRange(nextRange)
      savedSelectionRef.current = nextRange
    }

    updateDocumentContent(editorRef.current.innerHTML)
  }

  const handleFontFamilyChange = (e) => {
    const nextFont = e.target.value
    setActiveFontFamily(nextFont)
    wrapSelectionWithStyle({ 'font-family': nextFont })
  }

  const handleFontSizeChange = (e) => {
    const nextSize = e.target.value
    setActiveFontSize(nextSize)
    wrapSelectionWithStyle({ 'font-size': nextSize })
  }

  const openSocialShare = (platform) => {
    const baseLink = `${window.location.origin}/join/${document?.share_id}`
    const encodedLink = encodeURIComponent(baseLink)
    const encodedTitle = encodeURIComponent(title || 'CollabDocs document')
    const encodedBody = encodeURIComponent(`Take a look at this document: ${baseLink}`)

    const targets = {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(`${title || 'CollabDocs document'} - ${baseLink}`)}`,
      linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedLink}`,
      x: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedLink}`,
      facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedLink}`,
      email: `mailto:?subject=${encodedTitle}&body=${encodedBody}`,
    }

    const shareUrl = targets[platform]
    if (!shareUrl) return
    window.open(shareUrl, '_blank', 'noopener,noreferrer')
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

  const handleInsertVideo = (e) => {
    e.preventDefault()
    const url = normalizeUrl(videoUrl)
    const embedSrc = getSafeVideoEmbedSrc(url)

    if (embedSrc) {
      insertHtmlIntoEditor(
        `<div class="video-embed video-size-large" data-video-id="${crypto.randomUUID()}" draggable="true"><iframe src="${escapeHtml(embedSrc)}" title="Embedded video" loading="lazy" referrerpolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowfullscreen></iframe></div>`
      )
      setVideoUrl('')
      setShowVideoPanel(false)
      return
    }

    if (isValidVideoFileSrc(url)) {
      insertHtmlIntoEditor(
        `<div class="video-embed video-size-large" data-video-id="${crypto.randomUUID()}" draggable="true"><video src="${escapeHtml(url)}" controls playsinline preload="metadata"></video></div>`
      )
      setVideoUrl('')
      setShowVideoPanel(false)
      return
    }

    toast.error('Paste a YouTube, Vimeo, or direct MP4/WebM/Ogg video URL')
  }

  const handleAskAi = async (mode = 'ask') => {
    const prompt = newMessage.trim()

    if (mode === 'ask' && !prompt) {
      toast.error('Type a question for the AI assistant')
      return
    }

    setShowChat(true)
    setIsAiThinking(true)

    try {
      if (editorRef.current) {
        contentRef.current = sanitizeEditorHtml(editorRef.current.innerHTML)
      }

      const { data: sessionData } = await supabase.auth.getSession()
      const token = sessionData?.session?.access_token

      if (!token) {
        throw new Error('Please log in again before using AI')
      }

      const response = await fetch(`${API_BASE_URL}/api/ai/assist`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          documentId,
          prompt,
          mode,
          messages: messages
            .filter((message) => !message.is_ai)
            .slice(-8)
            .map((message) => ({
              content: message.content,
              sender: { name: message.sender?.name || (message.sender_id === user?.id ? 'You' : 'Collaborator') },
            })),
        }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.message || 'AI assistant failed')
      }

      const answer = payload?.data?.answer?.trim()
      if (!answer) {
        throw new Error('AI returned an empty response')
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          sender_id: 'ai-assistant',
          sender: { name: 'AI Assistant' },
          content: answer,
          created_at: new Date().toISOString(),
          is_ai: true,
        },
      ])

      if (mode === 'ask') {
        setNewMessage('')
      }
    } catch (error) {
      toast.error(error.message || 'AI assistant failed')
    } finally {
      setIsAiThinking(false)
    }
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
      const imageId = image.dataset.imageId || crypto.randomUUID()
      image.dataset.imageId = imageId
      image.draggable = true
      setSelectedImageId(imageId)
      setSelectedVideoId('')
      return
    }

    const video = e.target.closest('.video-embed')
    if (video && editorRef.current?.contains(video)) {
      e.preventDefault()
      const videoId = video.dataset.videoId || crypto.randomUUID()
      video.dataset.videoId = videoId
      video.draggable = true
      setSelectedImageId('')
      setSelectedVideoId(videoId)
      setSelectedVideoSize(
        video.classList.contains('video-size-small')
          ? 'small'
          : video.classList.contains('video-size-medium')
          ? 'medium'
          : 'large'
      )
      return
    }

    setSelectedImageId('')
    setSelectedVideoId('')

    const link = e.target.closest('a')
    if (!link?.href) return

    e.preventDefault()
    window.open(link.href, '_blank', 'noopener,noreferrer')
  }

  const deleteSelectedImage = () => {
    if (!editorRef.current) return

    if (selectedVideoId) {
      const video = editorRef.current.querySelector(`.video-embed[data-video-id="${CSS.escape(selectedVideoId)}"]`)
      if (!video) return

      video.remove()
      setSelectedVideoId('')
      updateDocumentContent(editorRef.current.innerHTML)
      return
    }

    if (!selectedImageId) return

    const image = editorRef.current.querySelector(`img[data-image-id="${CSS.escape(selectedImageId)}"]`)
    if (!image) return

    image.remove()
    setSelectedImageId('')
    updateDocumentContent(editorRef.current.innerHTML)
  }

  const resizeSelectedVideo = (size) => {
    if (!selectedVideoId || !editorRef.current) return

    const video = editorRef.current.querySelector(`.video-embed[data-video-id="${CSS.escape(selectedVideoId)}"]`)
    if (!video) return

    video.classList.remove('video-size-small', 'video-size-medium', 'video-size-large')
    video.classList.add(`video-size-${size}`)
    setSelectedVideoSize(size)
    updateDocumentContent(editorRef.current.innerHTML)
  }

  const handleEditorDragStart = (e) => {
    const media = e.target.closest('img, .video-embed')
    if (!media || !editorRef.current?.contains(media)) return

    const isVideo = media.classList.contains('video-embed')
    const mediaId = isVideo
      ? media.dataset.videoId || crypto.randomUUID()
      : media.dataset.imageId || crypto.randomUUID()

    if (isVideo) {
      media.dataset.videoId = mediaId
      setSelectedVideoId(mediaId)
      setSelectedImageId('')
    } else {
      media.dataset.imageId = mediaId
      setSelectedImageId(mediaId)
      setSelectedVideoId('')
    }

    media.draggable = true
    draggedImageIdRef.current = `${isVideo ? 'video' : 'image'}:${mediaId}`
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', draggedImageIdRef.current)
  }

  const handleEditorDragOver = (e) => {
    if (!draggedImageIdRef.current) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleEditorDrop = (e) => {
    const dragValue = draggedImageIdRef.current
    if (!dragValue || !editorRef.current) return

    e.preventDefault()
    const [mediaType, mediaId] = dragValue.split(':')
    const media = mediaType === 'video'
      ? editorRef.current.querySelector(`.video-embed[data-video-id="${CSS.escape(mediaId || '')}"]`)
      : editorRef.current.querySelector(`img[data-image-id="${CSS.escape(mediaId || '')}"]`)
    if (!media) return

    const range =
      window.document.caretRangeFromPoint?.(e.clientX, e.clientY) ||
      (() => {
        const position = window.document.caretPositionFromPoint?.(e.clientX, e.clientY)
        if (!position) return null
        const nextRange = window.document.createRange()
        nextRange.setStart(position.offsetNode, position.offset)
        return nextRange
      })()

    if (!range || media.contains(range.startContainer)) return

    media.remove()
    range.insertNode(media)
    draggedImageIdRef.current = ''
    if (mediaType === 'video') {
      setSelectedVideoId(mediaId)
      setSelectedImageId('')
    } else {
      setSelectedImageId(mediaId)
      setSelectedVideoId('')
    }
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

  const documentTheme = inferDocumentTheme(title)

  return (
    <div className={`editor-shell editor-theme-${documentTheme} -mx-4 -my-8 flex h-[calc(100vh-8rem)] flex-col`}>
      <header className="flex items-center justify-between border-b border-white/50 bg-[rgba(255,251,244,0.82)] px-4 py-4 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <button
            onClick={async () => {
              await flushPendingSave()
              navigate('/dashboard')
            }}
            className="rounded-xl p-2 text-charcoal-700 transition-colors hover:bg-white/70"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          
          <div>
            <input
              type="text"
              value={title}
              onChange={handleTitleChange}
              disabled={!canEdit}
              className="border-none bg-transparent font-display text-3xl font-semibold text-charcoal-900 focus:outline-none focus:ring-0 disabled:text-charcoal-700"
            />
            <div className="text-sm text-charcoal-700/65">
              {isSaving ? 'Saving...' : 'Live auto-save'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowLayoutModal(true)}
            className="flex items-center gap-2 rounded-xl bg-white/76 px-4 py-2 text-charcoal-800 shadow-[0_12px_24px_rgba(48,58,69,0.06)] hover:bg-white"
          >
            <LayoutTemplate className="h-4 w-4" />
            Modes
          </button>

          <button
            onClick={handleManualSave}
            disabled={!canEdit || isSaving}
            className="flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-white shadow-[0_14px_28px_rgba(54,81,107,0.2)] hover:bg-primary-700 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            Save
          </button>

          <button
            onClick={() => setShowShareModal(true)}
            className="flex items-center gap-2 rounded-xl bg-white/76 px-4 py-2 text-charcoal-800 shadow-[0_12px_24px_rgba(48,58,69,0.06)] hover:bg-white"
          >
            <Share2 className="h-4 w-4" />
            Share
          </button>

          <button
            onClick={() => setShowChat(!showChat)}
            className={`rounded-xl p-2 transition-colors ${showChat ? 'bg-primary-100 text-primary-700' : 'text-charcoal-700 hover:bg-white/70'}`}
          >
            <MessageSquare className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        <div className={`flex-1 ${showChat ? 'mr-80' : ''}`}>
          <div className="h-full p-8 overflow-auto">
            <div className={`editor-stage editor-stage-${layoutMode}`}>
              <div className={`editor-frame editor-canvas editor-canvas-${layoutMode} mx-auto overflow-hidden rounded-[28px]`}>
              <div className="editor-toolbar flex flex-wrap items-center gap-2 border-b border-white/45 px-4 py-3">
                <div className="flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2 shadow-[0_10px_22px_rgba(48,58,69,0.06)]">
                  <Type className="h-4 w-4 text-charcoal-700/70" />
                  <select
                    value={activeFontFamily}
                    onChange={handleFontFamilyChange}
                    disabled={!canEdit}
                    className="bg-transparent text-sm text-charcoal-800 focus:outline-none"
                  >
                    {FONT_FAMILY_OPTIONS.map((font) => (
                      <option key={font.value} value={font.value}>
                        {font.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 rounded-xl bg-white/80 px-3 py-2 shadow-[0_10px_22px_rgba(48,58,69,0.06)]">
                  <TextCursorInput className="h-4 w-4 text-charcoal-700/70" />
                  <select
                    value={activeFontSize}
                    onChange={handleFontSizeChange}
                    disabled={!canEdit}
                    className="bg-transparent text-sm text-charcoal-800 focus:outline-none"
                  >
                    {FONT_SIZE_OPTIONS.map((size) => (
                      <option key={size.value} value={size.value}>
                        {size.label}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  onClick={() => setShowEmojiPicker(prev => !prev)}
                  disabled={!canEdit}
                  title="Add emoji"
                  className="rounded-xl p-2 text-charcoal-700 hover:bg-white hover:text-primary-700 disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <Smile className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowLinkPanel(prev => !prev)
                    setShowVideoPanel(false)
                  }}
                  disabled={!canEdit}
                  title="Add link"
                  className="rounded-xl p-2 text-charcoal-700 hover:bg-white hover:text-primary-700 disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <Link className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowVideoPanel(prev => !prev)
                    setShowLinkPanel(false)
                  }}
                  disabled={!canEdit}
                  title="Add video"
                  className="rounded-xl p-2 text-charcoal-700 hover:bg-white hover:text-primary-700 disabled:opacity-50 disabled:hover:bg-transparent"
                >
                  <Video className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleOpenImagePicker}
                  disabled={!canEdit}
                  title="Add image"
                  className="rounded-xl p-2 text-charcoal-700 hover:bg-white hover:text-primary-700 disabled:opacity-50 disabled:hover:bg-transparent"
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

                {(selectedImageId || selectedVideoId) && (
                  <div className="flex items-center gap-2 border-l border-white/45 pl-2">
                    <span className="text-xs text-charcoal-700/70">
                      {selectedVideoId ? 'Video selected' : 'Image selected'}
                    </span>
                    {selectedVideoId && (
                      <>
                        <button
                          type="button"
                          onClick={() => resizeSelectedVideo('small')}
                          title="Small video"
                          className={`rounded-xl p-2 hover:bg-white ${selectedVideoSize === 'small' ? 'bg-primary-100 text-primary-700' : 'text-charcoal-700'}`}
                        >
                          <Minimize2 className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => resizeSelectedVideo('medium')}
                          title="Medium video"
                          className={`h-8 rounded-xl px-2 text-xs font-semibold hover:bg-white ${selectedVideoSize === 'medium' ? 'bg-primary-100 text-primary-700' : 'text-charcoal-700'}`}
                        >
                          M
                        </button>
                        <button
                          type="button"
                          onClick={() => resizeSelectedVideo('large')}
                          title="Large video"
                          className={`rounded-xl p-2 hover:bg-white ${selectedVideoSize === 'large' ? 'bg-primary-100 text-primary-700' : 'text-charcoal-700'}`}
                        >
                          <Maximize2 className="h-4 w-4" />
                        </button>
                      </>
                    )}
                    <button
                      type="button"
                      onClick={deleteSelectedImage}
                      title={selectedVideoId ? 'Delete video' : 'Delete image'}
                      className="rounded-xl p-2 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                )}

                {showEmojiPicker && (
                  <div className="flex flex-wrap gap-1 border-l border-white/45 pl-2">
                    {QUICK_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => handleInsertEmoji(emoji)}
                        className="h-8 w-8 rounded-xl text-lg hover:bg-white"
                        title={`Insert ${emoji}`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {showLinkPanel && (
                <form onSubmit={handleInsertLink} className="grid gap-3 border-b border-white/45 bg-white/76 px-4 py-3 sm:grid-cols-[1fr_1fr_auto]">
                  <input
                    type="text"
                    inputMode="url"
                    value={linkUrl}
                    onChange={(e) => setLinkUrl(e.target.value)}
                    placeholder="https://example.com"
                    className="rounded-xl border border-white/60 bg-white/90 px-3 py-2 text-sm text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <input
                    type="text"
                    value={linkText}
                    onChange={(e) => setLinkText(e.target.value)}
                    placeholder="Link text"
                    className="rounded-xl border border-white/60 bg-white/90 px-3 py-2 text-sm text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    type="submit"
                    className="rounded-xl bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700"
                  >
                    Add URL
                  </button>
                </form>
              )}

              {showVideoPanel && (
                <form onSubmit={handleInsertVideo} className="grid gap-3 border-b border-white/45 bg-white/76 px-4 py-3 sm:grid-cols-[1fr_auto]">
                  <input
                    type="text"
                    inputMode="url"
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    placeholder="YouTube, Vimeo, or direct video URL"
                    className="rounded-xl border border-white/60 bg-white/90 px-3 py-2 text-sm text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-sm text-white hover:bg-primary-700"
                  >
                    <Video className="h-4 w-4" />
                    Add video
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
                className="document-editor min-h-[600px] border-none shadow-none rounded-none"
                style={{ fontSize: '16px', lineHeight: '1.6' }}
              />
            </div>
            </div>
          </div>
        </div>

        {showChat && (
          <div className="glass-panel flex w-80 flex-col border-l border-white/40 animate-slide-in">
            <div className="flex items-center justify-between border-b border-white/40 p-4">
              <h3 className="font-semibold flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Chat
              </h3>
              <button onClick={() => setShowChat(false)} className="rounded p-1 hover:bg-white/70">
                <X className="h-4 w-4 text-charcoal-700/70" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 border-b border-white/40 p-3">
              <button
                type="button"
                onClick={() => handleAskAi('summarize')}
                disabled={isAiThinking}
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-white/78 px-2 py-2 text-xs font-medium text-charcoal-800 hover:bg-white disabled:opacity-50"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Summary
              </button>
              <button
                type="button"
                onClick={() => handleAskAi('improve')}
                disabled={isAiThinking}
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-white/78 px-2 py-2 text-xs font-medium text-charcoal-800 hover:bg-white disabled:opacity-50"
              >
                <Bot className="h-3.5 w-3.5" />
                Improve
              </button>
              <button
                type="button"
                onClick={() => handleAskAi('actions')}
                disabled={isAiThinking}
                className="inline-flex items-center justify-center gap-1 rounded-xl bg-white/78 px-2 py-2 text-xs font-medium text-charcoal-800 hover:bg-white disabled:opacity-50"
              >
                <TextCursorInput className="h-3.5 w-3.5" />
                Actions
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isAiThinking && (
                <div className="flex flex-col items-start">
                  <div className="max-w-[85%] rounded-2xl rounded-bl-none bg-white/86 p-3 text-sm text-charcoal-700 shadow-[0_10px_20px_rgba(48,58,69,0.06)]">
                    <p className="mb-1 flex items-center gap-1 text-xs font-medium text-primary-700">
                      <Bot className="h-3.5 w-3.5" />
                      AI Assistant
                    </p>
                    <p>Thinking...</p>
                  </div>
                </div>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.sender_id === user?.id ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] p-3 rounded-2xl text-sm ${
                      msg.is_ai
                        ? 'bg-white/90 text-charcoal-800 rounded-bl-none shadow-[0_10px_20px_rgba(48,58,69,0.06)]'
                        : msg.sender_id === user?.id
                        ? 'bg-primary-500 text-white rounded-br-none'
                        : 'bg-gray-100 text-gray-800 rounded-bl-none'
                    }`}
                  >
                    {(msg.sender_id !== user?.id || msg.is_ai) && (
                      <p className="mb-1 text-xs font-medium opacity-75">
                        {msg.is_ai && <Bot className="mr-1 inline h-3.5 w-3.5" />}
                        {msg.sender?.name || 'Unknown'}
                      </p>
                    )}
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  <span className="mt-1 text-xs text-charcoal-700/50">
                    {formatTime(msg.created_at)}
                  </span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="border-t border-white/40 p-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 rounded-xl border border-white/60 bg-white/84 px-3 py-2 text-sm text-charcoal-800 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="rounded-xl bg-primary-600 p-2 text-white hover:bg-primary-700 disabled:opacity-50"
                >
                  <Send className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleAskAi('ask')}
                  disabled={!newMessage.trim() || isAiThinking}
                  title="Ask AI"
                  className="rounded-xl bg-white/84 p-2 text-primary-700 hover:bg-white disabled:opacity-50"
                >
                  <Bot className="h-4 w-4" />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {showShareModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(35,42,49,0.42)] backdrop-blur-sm">
          <div className="m-4 w-full max-w-xl rounded-[28px] border border-white/60 bg-[rgba(255,251,244,0.96)] p-6 shadow-[0_28px_72px_rgba(35,42,49,0.22)]">
            <div className="mb-5">
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-700">Share</p>
              <h2 className="mt-1 font-display text-3xl font-semibold text-charcoal-900">Share Document</h2>
              <p className="mt-2 text-sm text-charcoal-700/75">Copy the link or send it directly to social apps.</p>
            </div>

            <div className="mb-4 flex gap-2">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/join/${document?.share_id}`}
                className="flex-1 rounded-xl border border-white/60 bg-white/90 px-4 py-3 text-sm text-charcoal-800"
              />
              <button
                onClick={handleCopyShareLink}
                className="inline-flex items-center justify-center rounded-xl bg-primary-600 px-4 py-3 text-white hover:bg-primary-700"
              >
                {shareLinkCopied ? 'Copied!' : <Copy className="h-4 w-4" />}
              </button>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <button
                onClick={() => openSocialShare('whatsapp')}
                className="rounded-xl bg-[#e8f5ec] px-4 py-3 text-sm font-medium text-[#1f7a3b] hover:bg-[#dcf0e3]"
              >
                WhatsApp
              </button>
              <button
                onClick={() => openSocialShare('linkedin')}
                className="rounded-xl bg-[#e7f1f7] px-4 py-3 text-sm font-medium text-[#1f5c88] hover:bg-[#d9ebf4]"
              >
                LinkedIn
              </button>
              <button
                onClick={() => openSocialShare('x')}
                className="rounded-xl bg-[#edf0f3] px-4 py-3 text-sm font-medium text-charcoal-800 hover:bg-[#e4e8ec]"
              >
                X / Twitter
              </button>
              <button
                onClick={() => openSocialShare('facebook')}
                className="rounded-xl bg-[#e9effb] px-4 py-3 text-sm font-medium text-[#345b9d] hover:bg-[#dfe8f8]"
              >
                Facebook
              </button>
              <button
                onClick={() => openSocialShare('email')}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#f5ede3] px-4 py-3 text-sm font-medium text-[#8d5f35] hover:bg-[#f0e4d5]"
              >
                <Mail className="h-4 w-4" />
                Email
              </button>
            </div>

            <button
              onClick={() => setShowShareModal(false)}
              className="w-full rounded-xl border border-white/60 bg-white/84 px-4 py-3 text-charcoal-800 hover:bg-white"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {showLayoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(35,42,49,0.42)] backdrop-blur-sm">
          <div className="m-4 w-full max-w-3xl rounded-[28px] border border-white/60 bg-[rgba(255,251,244,0.96)] p-6 shadow-[0_28px_72px_rgba(35,42,49,0.22)]">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-700">Layout modes</p>
                <h2 className="mt-1 font-display text-3xl font-semibold text-charcoal-900">Preview for social formats</h2>
                <p className="mt-2 text-sm text-charcoal-700/75">
                  Switch the editor canvas between document, landscape, mobile, story, and reel-friendly layouts.
                </p>
              </div>
              <button
                onClick={() => setShowLayoutModal(false)}
                className="rounded-xl p-2 text-charcoal-700/60 hover:bg-white/70 hover:text-charcoal-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {LAYOUT_OPTIONS.map((option) => {
                const Icon = option.icon
                const isActive = layoutMode === option.id

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => {
                      setLayoutMode(option.id)
                      setShowLayoutModal(false)
                    }}
                    className={`rounded-2xl border p-5 text-left transition-all ${
                      isActive
                        ? 'border-primary-500 bg-primary-50/80 shadow-[0_18px_32px_rgba(54,81,107,0.12)]'
                        : 'border-white/60 bg-white/76 hover:border-primary-200 hover:bg-white'
                    }`}
                  >
                    <div className={`mb-4 inline-flex rounded-xl p-3 ${
                      isActive ? 'bg-primary-100 text-primary-700' : 'bg-[rgba(91,130,157,0.08)] text-charcoal-700/70'
                    }`}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h3 className="text-lg font-semibold text-charcoal-900">{option.label}</h3>
                    <p className="mt-2 text-sm text-charcoal-700/72">{option.helper}</p>
                    <p className="mt-4 text-xs font-semibold uppercase tracking-[0.14em] text-primary-700/80">
                      {isActive ? 'Current view' : 'Switch view'}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EditorPage
