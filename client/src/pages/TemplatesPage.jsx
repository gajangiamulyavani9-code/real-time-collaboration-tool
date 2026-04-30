import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Loader2, Plus, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { DOCUMENT_TEMPLATES } from './DashboardPage'

const TemplatesPage = () => {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [creatingTemplateId, setCreatingTemplateId] = useState('')

  const templates = DOCUMENT_TEMPLATES.filter(template => template.id !== 'blank')
  const filteredTemplates = templates.filter(template => {
    const query = searchQuery.toLowerCase()
    return (
      template.name.toLowerCase().includes(query) ||
      template.category.toLowerCase().includes(query) ||
      template.description.toLowerCase().includes(query)
    )
  })

  const createFromTemplate = async (template) => {
    setCreatingTemplateId(template.id)

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser()
      if (authError || !authData?.user?.id) {
        throw new Error('Please log in again before creating a document')
      }

      const documentId = crypto.randomUUID()
      const content = template.content.trim()

      const { data: createdDocs, error } = await supabase.rpc('create_document', {
        input_id: documentId,
        input_title: template.title,
        input_content: content,
      })

      if (error) throw error

      const insertedDoc = createdDocs?.[0]
      if (!insertedDoc?.id) throw new Error('Document was not created')

      if ((insertedDoc.content || '') !== content) {
        const { error: updateError } = await supabase
          .from('documents')
          .update({ content })
          .eq('id', documentId)

        if (updateError) throw updateError
      }

      toast.success(`${template.name} created`)
      navigate(`/editor/${documentId}`)
    } catch (error) {
      toast.error(error.message || 'Failed to create document from template')
    } finally {
      setCreatingTemplateId('')
    }
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Templates</h1>
          <p className="text-gray-600 mt-1">
            Pick a ready-made sample and edit it in your document.
          </p>
        </div>

        <button
          onClick={() => navigate('/dashboard?create=1')}
          className="inline-flex items-center justify-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 font-medium transition-colors"
        >
          <Plus className="h-5 w-5" />
          Blank Document
        </button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filteredTemplates.map((template) => {
          const isCreating = creatingTemplateId === template.id

          return (
            <div
              key={template.id}
              className="bg-white border border-gray-200 rounded-xl p-5 hover:border-primary-200 hover:shadow-md transition-all"
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="bg-primary-50 p-3 rounded-lg text-primary-600">
                  <FileText className="h-6 w-6" />
                </div>
                <span className="text-xs font-medium px-2 py-1 rounded-full bg-gray-100 text-gray-600">
                  {template.category}
                </span>
              </div>

              <h2 className="text-lg font-semibold text-gray-900">{template.name}</h2>
              <p className="text-sm text-gray-500 mt-2">{template.description}</p>
              <p className="text-xs text-primary-600 font-medium mt-3">{template.sample}</p>

              <div className="mt-5 rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600 min-h-28">
                <p className="font-medium text-gray-800">{template.title}</p>
                <p className="mt-2">
                  {template.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150)}...
                </p>
              </div>

              <button
                onClick={() => createFromTemplate(template)}
                disabled={Boolean(creatingTemplateId)}
                className="mt-5 w-full inline-flex items-center justify-center gap-2 bg-primary-500 text-white px-4 py-2 rounded-lg hover:bg-primary-600 disabled:opacity-50 font-medium"
              >
                {isCreating ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                Use Template
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default TemplatesPage
