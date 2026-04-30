import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'
import { 
  FileText, 
  Plus, 
  Users, 
  Clock, 
  Trash2,
  Share2,
  ExternalLink,
  Search,
  X,
  Copy,
  Check,
  Loader2
} from 'lucide-react'
import toast from 'react-hot-toast'

export const DOCUMENT_TEMPLATES = [
  {
    id: 'blank',
    category: 'Start',
    name: 'Blank',
    title: 'Untitled Document',
    description: 'Start with an empty page.',
    sample: 'Empty page',
    content: '',
  },
  {
    id: 'resume-professional',
    category: 'Resume',
    name: 'Professional Resume',
    title: 'Professional Resume',
    description: 'A polished resume with summary, experience, education, and skills.',
    sample: 'Best for job applications',
    content: `
      <h1>Aarav Sharma</h1>
      <p>Bengaluru, India | aarav.email@example.com | +91 98765 43210 | linkedin.com/in/aaravsharma</p>
      <h2>Professional Summary</h2>
      <p>Detail-oriented software developer with 2+ years of experience building responsive web applications and improving user workflows.</p>
      <h2>Experience</h2>
      <h3>Frontend Developer - BrightApps Studio</h3>
      <p>June 2024 - Present</p>
      <ul>
        <li>Built reusable React components used across 12 product screens.</li>
        <li>Improved page load speed by optimizing images and reducing unused code.</li>
        <li>Collaborated with designers to ship accessible, mobile-friendly interfaces.</li>
      </ul>
      <h2>Education</h2>
      <p>B.Tech in Computer Science - Example University, 2024</p>
      <h2>Skills</h2>
      <p>React, JavaScript, HTML, CSS, Tailwind CSS, Supabase, Git</p>
    `,
  },
  {
    id: 'resume-student',
    category: 'Resume',
    name: 'Student Resume',
    title: 'Student Resume',
    description: 'A beginner-friendly resume for internships and first jobs.',
    sample: 'Best for freshers',
    content: `
      <h1>Your Name</h1>
      <p>City, Country | email@example.com | Phone | Portfolio link</p>
      <h2>Objective</h2>
      <p>Motivated student looking for an internship where I can apply my technical skills and learn from real-world projects.</p>
      <h2>Projects</h2>
      <h3>CollabDocs - Real-time Document Editor</h3>
      <ul>
        <li>Created a collaborative editor with authentication and document sharing.</li>
        <li>Added autosave and template-based document creation.</li>
      </ul>
      <h2>Education</h2>
      <p>Degree / Course - College Name - Graduation Year</p>
      <h2>Skills</h2>
      <p>JavaScript, React, Node.js, Database basics, Communication</p>
    `,
  },
  {
    id: 'birthday',
    category: 'Wishes',
    name: 'Birthday Wishes',
    title: 'Birthday Wishes',
    description: 'A warm birthday note that can be customized for anyone.',
    sample: 'Personal greeting',
    content: `
      <h1>Happy Birthday, Ananya!</h1>
      <p>Dear Ananya,</p>
      <p>Wishing you a beautiful birthday filled with laughter, love, and everything that makes you smile.</p>
      <p>You bring so much kindness and joy to the people around you. May this year bring you exciting opportunities, peaceful days, and memories you will always treasure.</p>
      <p>With love,</p>
      <p>Your Name</p>
    `,
  },
  {
    id: 'birthday-fun',
    category: 'Wishes',
    name: 'Fun Birthday Message',
    title: 'Fun Birthday Message',
    description: 'A playful birthday message for friends and close family.',
    sample: 'Light and cheerful',
    content: `
      <h1>It is Your Day!</h1>
      <p>Hey Name,</p>
      <p>Today is officially all about you, so enjoy the cake, the wishes, the photos, and every tiny bit of attention.</p>
      <p>I hope your birthday is full of good food, loud laughter, and people who make you feel loved.</p>
      <p>Have the best year ahead!</p>
      <p>From,</p>
      <p>Your Name</p>
    `,
  },
  {
    id: 'event-wishes',
    category: 'Wishes',
    name: 'Event Wishes',
    title: 'Event Wishes',
    description: 'A flexible greeting for festivals, weddings, anniversaries, and celebrations.',
    sample: 'Use for any event',
    content: `
      <h1>Warm Wishes</h1>
      <p>Dear Name,</p>
      <p>Wishing you happiness, success, and beautiful moments on this special occasion.</p>
      <p>May this celebration bring joy, togetherness, and memories you will always treasure.</p>
      <p>Best wishes,</p>
      <p>Your Name</p>
    `,
  },
  {
    id: 'notes',
    category: 'Notes',
    name: 'Notes',
    title: 'Notes',
    description: 'A simple structure for ideas, study notes, or quick drafts.',
    sample: 'General notes',
    content: `
      <h1>Project Ideas Notes</h1>
      <p>Date: 30 April 2026</p>
      <h2>Main Ideas</h2>
      <ul>
        <li>Create reusable document templates for common use cases.</li>
        <li>Improve editor saving so content stays after reopening.</li>
        <li>Add sharing options for teammates and friends.</li>
      </ul>
      <h2>Details</h2>
      <p>Templates should feel like editable samples, not empty outlines. Each one should include realistic text users can replace.</p>
      <h2>Next Steps</h2>
      <ul>
        <li>Test creating documents from each template.</li>
        <li>Ask users which template types they want next.</li>
      </ul>
    `,
  },
  {
    id: 'class-notes',
    category: 'Notes',
    name: 'Class Notes',
    title: 'Class Notes',
    description: 'A study-friendly note layout with topics, examples, and questions.',
    sample: 'Best for students',
    content: `
      <h1>Class Notes</h1>
      <p>Subject: Web Development</p>
      <p>Date: 30 April 2026</p>
      <h2>Topic</h2>
      <p>React components and state management</p>
      <h2>Key Points</h2>
      <ul>
        <li>Components split UI into reusable pieces.</li>
        <li>State stores values that change over time.</li>
        <li>Props pass information from parent to child components.</li>
      </ul>
      <h2>Example</h2>
      <p>A dashboard can use state for search text, selected filters, and modal visibility.</p>
      <h2>Questions</h2>
      <ul>
        <li>When should state be moved into a parent component?</li>
      </ul>
    `,
  },
  {
    id: 'meeting',
    category: 'Notes',
    name: 'Meeting Notes',
    title: 'Meeting Notes',
    description: 'Agenda, notes, decisions, and next steps.',
    sample: 'Team meeting',
    content: `
      <h1>Product Planning Meeting</h1>
      <p>Date: 30 April 2026</p>
      <p>Attendees: Product, Design, Engineering</p>
      <h2>Agenda</h2>
      <ul>
        <li>Review current document editor issues.</li>
        <li>Discuss template gallery improvements.</li>
        <li>Confirm next release tasks.</li>
      </ul>
      <h2>Discussion Notes</h2>
      <p>The team agreed that templates should include realistic sample content and be easy to edit after creation.</p>
      <h2>Decisions</h2>
      <ul>
        <li>Add multiple starter templates for resumes, wishes, notes, and task lists.</li>
      </ul>
      <h2>Action Items</h2>
      <ul>
        <li>Design - Review template card layout - Friday</li>
        <li>Engineering - Test template creation flow - Friday</li>
      </ul>
    `,
  },
  {
    id: 'proposal',
    category: 'Work',
    name: 'Project Proposal',
    title: 'Project Proposal',
    description: 'Outline goals, scope, timeline, and budget.',
    sample: 'Project planning',
    content: `
      <h1>CollabDocs Template Gallery Proposal</h1>
      <h2>Overview</h2>
      <p>This project will add ready-to-edit document templates so users can quickly create resumes, wishes, notes, and task lists.</p>
      <h2>Goals</h2>
      <ul>
        <li>Reduce the effort needed to start a new document.</li>
        <li>Make CollabDocs useful for personal, school, and work documents.</li>
        <li>Ensure every template remains fully editable.</li>
      </ul>
      <h2>Scope</h2>
      <p>Includes template selection, sample content, document creation, and editor persistence testing.</p>
      <h2>Timeline</h2>
      <p>Phase 1: Template content<br>Phase 2: Picker UI<br>Phase 3: Testing and polish</p>
      <h2>Budget</h2>
      <p>Internal development time only.</p>
    `,
  },
  {
    id: 'todo',
    category: 'Tasks',
    name: 'To-do List',
    title: 'To-do List',
    description: 'A quick checklist for daily work.',
    sample: 'Daily plan',
    content: `
      <h1>Today&apos;s To-do List</h1>
      <h2>Today</h2>
      <ul>
        <li>Finish template gallery updates.</li>
        <li>Test creating a birthday wishes document.</li>
        <li>Review autosave after reopening a document.</li>
      </ul>
      <h2>Later</h2>
      <ul>
        <li>Add more templates based on user feedback.</li>
        <li>Improve template previews.</li>
      </ul>
    `,
  },
  {
    id: 'project-todo',
    category: 'Tasks',
    name: 'Project Task List',
    title: 'Project Task List',
    description: 'A task tracker for small projects and team work.',
    sample: 'Project checklist',
    content: `
      <h1>Project Task List</h1>
      <h2>Backlog</h2>
      <ul>
        <li>Add template categories.</li>
        <li>Create sample content for each template.</li>
      </ul>
      <h2>In Progress</h2>
      <ul>
        <li>Connect New Document button to the template picker.</li>
      </ul>
      <h2>Done</h2>
      <ul>
        <li>Create blank document flow.</li>
        <li>Add editor autosave.</li>
      </ul>
    `,
  },
]

const DashboardPage = () => {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user } = useAuth()
  const [documents, setDocuments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [newDocTitle, setNewDocTitle] = useState('')
  const [selectedTemplateId, setSelectedTemplateId] = useState('blank')
  const [isCreating, setIsCreating] = useState(false)
  const [shareLinkCopied, setShareLinkCopied] = useState(false)
  const [joinShareId, setJoinShareId] = useState('')
  const [isJoining, setIsJoining] = useState(false)

  // Fetch documents on mount
  useEffect(() => {
    fetchDocuments()
  }, [])

  useEffect(() => {
    if (searchParams.get('create') !== '1') return

    setShowCreateModal(true)
    setSearchParams({}, { replace: true })
  }, [searchParams, setSearchParams])

  const resetCreateModal = () => {
    setShowCreateModal(false)
    setNewDocTitle('')
    setSelectedTemplateId('blank')
  }

  const openCreateModal = (templateId = 'blank') => {
    const template = DOCUMENT_TEMPLATES.find(item => item.id === templateId) || DOCUMENT_TEMPLATES[0]
    setSelectedTemplateId(template.id)
    setNewDocTitle(template.id === 'blank' ? '' : template.title)
    setShowCreateModal(true)
  }

  const fetchDocuments = async () => {
    try {
      // Get documents where user is owner
      const { data: ownedDocs, error: ownedError } = await supabase
        .from('documents')
        .select('*, owner:owner_id(*)')
        .eq('owner_id', user.id)

      // Get documents where user is collaborator
      const { data: collabDocs, error: collabError } = await supabase
        .from('document_collaborators')
        .select('document:document_id(*, owner:owner_id(*)), role')
        .eq('user_id', user.id)

      if (ownedError || collabError) throw ownedError || collabError

      // Combine and format documents
      const allDocs = [
        ...(ownedDocs || []).map(d => ({ ...d, role: 'owner', is_owner: true })),
        ...(collabDocs || []).map(c => ({ 
          ...c.document, 
          role: c.role, 
          is_owner: false 
        }))
      ]

      setDocuments(allDocs)
    } catch (error) {
      toast.error('Failed to load documents')
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  // Create new document
  const handleCreateDocument = async (templateId = selectedTemplateId, customTitle = newDocTitle) => {
    const selectedTemplate = DOCUMENT_TEMPLATES.find(template => template.id === templateId) || DOCUMENT_TEMPLATES[0]
    const title = customTitle.trim() || selectedTemplate.title
    const content = selectedTemplate.content.trim()

    if (!title.trim()) {
      toast.error('Please enter a title')
      return
    }

    setIsCreating(true)
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData?.user?.id) {
        throw new Error('Please log in again before creating a document')
      }

      const documentId = crypto.randomUUID()

      const { data: createdDocs, error } = await supabase.rpc('create_document', {
        input_id: documentId,
        input_title: title,
        input_content: content,
      })

      if (error) throw error

      const insertedDoc = createdDocs?.[0]
      if (!insertedDoc?.id) throw new Error('Document was not created')

      const newDoc = {
        id: insertedDoc.id,
        title: insertedDoc.title,
        owner_id: insertedDoc.owner_id,
        share_id: insertedDoc.share_id,
        role: 'owner',
        is_owner: true,
        updated_at: insertedDoc.updated_at,
        collaborators: []
      }
      setDocuments([newDoc, ...documents])
      resetCreateModal()
      toast.success('Document created!')
      navigate(`/editor/${documentId}`)
    } catch (error) {
      toast.error('Failed to create document')
      console.error(error)
    } finally {
      setIsCreating(false)
    }
  }

  // Delete document
  const handleDeleteDocument = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return

    try {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', docId)

      if (error) throw error

      setDocuments(documents.filter(d => d.id !== docId))
      toast.success('Document deleted')
    } catch (error) {
      toast.error('Failed to delete document')
      console.error(error)
    }
  }

  // Copy share link
  const handleCopyShareLink = async (shareId) => {
    const link = `${window.location.origin}/join/${shareId}`
    try {
      await navigator.clipboard.writeText(link)
      setShareLinkCopied(true)
      toast.success('Share link copied!')
      setTimeout(() => setShareLinkCopied(false), 2000)
    } catch (error) {
      toast.error('Failed to copy link')
    }
  }

  // Join document via share ID
  const handleJoinDocument = async () => {
    if (!joinShareId.trim()) {
      toast.error('Please enter a share ID')
      return
    }

    setIsJoining(true)
    try {
      const { data, error } = await supabase.rpc('join_document_by_share_id', {
        input_share_id: joinShareId.trim().toUpperCase(),
      })

      if (error || !data?.length || !data[0]?.document_id) {
        throw new Error(error?.message || 'Invalid share ID')
      }

      toast.success('Joined document!')
      setJoinShareId('')
      navigate(`/editor/${data[0].document_id}`)
    } catch (error) {
      toast.error(error.message || 'Invalid share ID')
    } finally {
      setIsJoining(false)
    }
  }

  // Filter documents
  const filteredDocuments = documents.filter(doc => 
    doc.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatDate = (dateString) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInHours = (now - date) / (1000 * 60 * 60)
    
    if (diffInHours < 1) {
      return 'Just now'
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`
    } else if (diffInHours < 168) {
      return `${Math.floor(diffInHours / 24)}d ago`
    } else {
      return date.toLocaleDateString()
    }
  }

  const getRoleBadge = (role) => {
    const badges = {
      owner: 'bg-[rgba(91,130,157,0.14)] text-primary-800',
      editor: 'bg-[rgba(79,123,102,0.14)] text-[#4f6a55]',
      viewer: 'bg-[rgba(95,111,130,0.10)] text-charcoal-700'
    }
    return badges[role] || badges.viewer
  }

  if (isLoading) {
    return <LoadingSpinner fullScreen />
  }

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-primary-700">Workspace</p>
          <h1 className="font-display text-4xl font-semibold text-charcoal-900">My Documents</h1>
          <p className="text-charcoal-700/80 mt-2">
            {documents.length} document{documents.length !== 1 ? 's' : ''}
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Join Document Input */}
          <div className="flex gap-2">
            <input
              type="text"
              value={joinShareId}
              onChange={(e) => setJoinShareId(e.target.value)}
              placeholder="Enter share ID..."
              className="rounded-xl border border-white/60 bg-white/80 px-4 py-2 text-sm text-charcoal-800 shadow-[0_12px_28px_rgba(48,58,69,0.06)] focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <button
              onClick={handleJoinDocument}
              disabled={isJoining}
              className="flex items-center gap-2 rounded-xl bg-white/85 px-4 py-2 text-sm font-medium text-charcoal-800 shadow-[0_12px_28px_rgba(48,58,69,0.06)] transition-colors hover:bg-white disabled:opacity-50"
            >
              {isJoining ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ExternalLink className="h-4 w-4" />
              )}
              Join
            </button>
          </div>

          {/* Create Button */}
          <button
            onClick={() => openCreateModal()}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary-600 px-5 py-2.5 font-medium text-white shadow-[0_16px_30px_rgba(54,81,107,0.22)] transition-colors hover:bg-primary-700"
          >
            <Plus className="h-5 w-5" />
            New Document
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-charcoal-700/40" />
        <input
          type="text"
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-2xl border border-white/60 bg-white/82 pl-10 pr-4 py-3 text-charcoal-800 shadow-[0_16px_34px_rgba(48,58,69,0.06)] backdrop-blur focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Documents Grid */}
      {filteredDocuments.length === 0 ? (
        <div className="glass-panel rounded-[28px] border border-white/60 py-16 text-center">
          <FileText className="mx-auto mb-4 h-16 w-16 text-primary-300" />
          <h3 className="mb-2 text-xl font-semibold text-charcoal-900">
            {searchQuery ? 'No documents found' : 'No documents yet'}
          </h3>
          <p className="mb-6 text-charcoal-700/70">
            {searchQuery 
              ? 'Try a different search term' 
              : 'Create your first document to get started'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => openCreateModal()}
              className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-6 py-3 font-medium text-white shadow-[0_16px_30px_rgba(54,81,107,0.22)] hover:bg-primary-700"
            >
              <Plus className="h-5 w-5" />
              Create Document
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDocuments.map((doc) => (
            <div
              key={doc.id}
              className="group cursor-pointer rounded-[24px] border border-white/60 bg-white/82 p-6 shadow-[0_18px_40px_rgba(48,58,69,0.06)] backdrop-blur transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_56px_rgba(48,58,69,0.12)]"
              onClick={() => navigate(`/editor/${doc.id}`)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="rounded-xl bg-primary-50 p-3">
                  <FileText className="h-6 w-6 text-primary-600" />
                </div>
                
                {/* Actions Menu */}
                <div 
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  {doc.is_owner && (
                    <button
                      onClick={() => handleDeleteDocument(doc.id)}
                      className="p-2 text-charcoal-700/40 transition-colors hover:text-red-500"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <h3 className="mb-2 truncate text-lg font-semibold text-charcoal-900">
                {doc.title}
              </h3>
              
              <div className="mb-4 flex items-center gap-4 text-sm text-charcoal-700/65">
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {formatDate(doc.updated_at)}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {(doc.collaborators?.length ?? 0) + 1}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${getRoleBadge(doc.role)}`}>
                  {doc.role}
                </span>
                
                {doc.is_owner && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedDoc(doc)
                      setShowShareModal(true)
                    }}
                    className="flex items-center gap-1 text-sm text-charcoal-700/70 hover:text-primary-700"
                  >
                    <Share2 className="h-4 w-4" />
                    Share
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Document Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(35,42,49,0.42)] backdrop-blur-sm">
          <div className="m-4 max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-[28px] border border-white/60 bg-[rgba(255,251,244,0.96)] p-6 shadow-[0_28px_72px_rgba(35,42,49,0.22)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-primary-700">Start clean</p>
                <h2 className="mt-1 font-display text-3xl font-semibold text-charcoal-900">Create New Document</h2>
              </div>
              <button 
                onClick={resetCreateModal}
                className="text-charcoal-700/45 hover:text-charcoal-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <input
              type="text"
              value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
              placeholder="Enter document title..."
              className="mb-4 w-full rounded-xl border border-white/60 bg-white/86 px-4 py-3 text-charcoal-800 shadow-[0_12px_28px_rgba(48,58,69,0.06)] focus:outline-none focus:ring-2 focus:ring-primary-500"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateDocument()}
            />

            <div className="mb-5">
              <p className="mb-3 text-sm font-medium text-charcoal-800">Choose a template</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {DOCUMENT_TEMPLATES.map((template) => {
                  const isSelected = selectedTemplateId === template.id

                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => {
                        setSelectedTemplateId(template.id)
                        setNewDocTitle(template.id === 'blank' ? '' : template.title)
                      }}
                      className={`text-left rounded-2xl border p-4 transition-all ${
                        isSelected
                          ? 'border-primary-500 bg-primary-50/75 shadow-[0_18px_32px_rgba(54,81,107,0.12)]'
                          : 'border-white/60 bg-white/74 hover:border-primary-200 hover:bg-white/90'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`rounded-xl p-2 ${isSelected ? 'bg-primary-100 text-primary-700' : 'bg-[rgba(91,130,157,0.08)] text-charcoal-700/60'}`}>
                          <FileText className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-medium text-charcoal-900">{template.name}</h3>
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                              isSelected ? 'bg-primary-100 text-primary-700' : 'bg-[rgba(91,130,157,0.08)] text-charcoal-700/70'
                            }`}>
                              {template.category}
                            </span>
                          </div>
                          <p className="mt-1 text-sm text-charcoal-700/70">{template.description}</p>
                          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.12em] text-primary-700/80">{template.sample}</p>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={resetCreateModal}
                className="flex-1 rounded-xl border border-white/60 bg-white/84 px-4 py-2 text-charcoal-800 hover:bg-white"
              >
                Cancel
              </button>
              <button
                onClick={() => handleCreateDocument()}
                disabled={isCreating}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-2 text-white shadow-[0_14px_28px_rgba(54,81,107,0.2)] hover:bg-primary-700 disabled:opacity-50"
              >
                {isCreating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Create
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share Modal */}
      {showShareModal && selectedDoc && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md m-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Share Document</h2>
              <button 
                onClick={() => {
                  setShowShareModal(false)
                  setSelectedDoc(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <p className="text-gray-600 mb-4">
              Anyone with this link can view the document:
            </p>
            
            <div className="flex gap-2 mb-6">
              <input
                type="text"
                readOnly
                value={`${window.location.origin}/join/${selectedDoc.share_id}`}
                className="flex-1 px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm"
              />
              <button
                onClick={() => handleCopyShareLink(selectedDoc.share_id)}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 flex items-center gap-2"
              >
                {shareLinkCopied ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
                {shareLinkCopied ? 'Copied!' : 'Copy'}
              </button>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600">
                <strong>Share ID:</strong> {selectedDoc.share_id}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default DashboardPage
