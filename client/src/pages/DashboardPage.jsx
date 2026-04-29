import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'
import { 
  FileText, 
  Plus, 
  Users, 
  Clock, 
  MoreVertical,
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

const DashboardPage = () => {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [documents, setDocuments] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [showShareModal, setShowShareModal] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState(null)
  const [newDocTitle, setNewDocTitle] = useState('')
  const [isCreating, setIsCreating] = useState(false)
  const [shareLinkCopied, setShareLinkCopied] = useState(false)
  const [joinShareId, setJoinShareId] = useState('')
  const [isJoining, setIsJoining] = useState(false)

  // Fetch documents on mount
  useEffect(() => {
    fetchDocuments()
  }, [])

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
  const handleCreateDocument = async () => {
    if (!newDocTitle.trim()) {
      toast.error('Please enter a title')
      return
    }

    setIsCreating(true)
    try {
      const documentId = crypto.randomUUID()

      const { error } = await supabase
        .from('documents')
        .insert([{ 
          id: documentId,
          title: newDocTitle,
          owner_id: user.id
        }])

      if (error) throw error

      const { data: insertedDoc, error: insertedDocError } = await supabase
        .from('documents')
        .select('id, title, owner_id, share_id, updated_at')
        .eq('id', documentId)
        .single()

      if (insertedDocError) throw insertedDocError

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
      setShowCreateModal(false)
      setNewDocTitle('')
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
      owner: 'bg-purple-100 text-purple-700',
      editor: 'bg-blue-100 text-blue-700',
      viewer: 'bg-gray-100 text-gray-700'
    }
    return badges[role] || badges.viewer
  }

  if (isLoading) {
    return <LoadingSpinner fullScreen />
  }

  return (
    <div>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Documents</h1>
          <p className="text-gray-600 mt-1">
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
              className="px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
            <button
              onClick={handleJoinDocument}
              disabled={isJoining}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium text-sm flex items-center gap-2 disabled:opacity-50"
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
            onClick={() => setShowCreateModal(true)}
            className="flex items-center justify-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 font-medium transition-colors"
          >
            <Plus className="h-5 w-5" />
            New Document
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search documents..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      {/* Documents Grid */}
      {filteredDocuments.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {searchQuery ? 'No documents found' : 'No documents yet'}
          </h3>
          <p className="text-gray-500 mb-6">
            {searchQuery 
              ? 'Try a different search term' 
              : 'Create your first document to get started'}
          </p>
          {!searchQuery && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 bg-primary-500 text-white px-6 py-3 rounded-lg hover:bg-primary-600 font-medium"
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
              className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-shadow group cursor-pointer"
              onClick={() => navigate(`/editor/${doc.id}`)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="bg-primary-50 p-3 rounded-lg">
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
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>

              <h3 className="font-semibold text-gray-900 mb-2 truncate">
                {doc.title}
              </h3>
              
              <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
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
                    className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary-600"
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md m-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Create New Document</h2>
              <button 
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <input
              type="text"
              value={newDocTitle}
              onChange={(e) => setNewDocTitle(e.target.value)}
              placeholder="Enter document title..."
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 mb-4"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreateDocument()}
            />
            
            <div className="flex gap-3">
              <button
                onClick={() => setShowCreateModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateDocument}
                disabled={isCreating}
                className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 flex items-center justify-center gap-2"
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
