import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FileText, Loader2, Plus, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { DOCUMENT_TEMPLATES } from './DashboardPage'
import { getTemplateThemeStyles } from '../lib/documentThemes'

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
    <div className="templates-page rounded-[32px] border border-white/40 bg-[rgba(255,251,244,0.48)] p-6 shadow-[0_22px_56px_rgba(48,58,69,0.07)] backdrop-blur-sm sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-700 mb-2">Curated layouts</p>
          <h1 className="text-3xl font-semibold text-slate-900">Templates</h1>
          <p className="text-slate-600 mt-2 max-w-2xl">
            Pick a ready-made sample and edit it in your document.
          </p>
        </div>

        <button
          onClick={() => navigate('/dashboard?create=1')}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary-600 px-5 py-2.5 font-medium text-white shadow-[0_14px_32px_rgba(51,85,116,0.22)] transition-colors hover:bg-primary-700"
        >
          <Plus className="h-5 w-5" />
          Blank Document
        </button>
      </div>

      <div className="relative mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
        <input
          type="text"
          placeholder="Search templates..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-xl border border-white/60 bg-white/85 pl-10 pr-4 py-3 text-slate-700 shadow-[0_14px_34px_rgba(48,58,69,0.06)] backdrop-blur focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
        {filteredTemplates.map((template) => {
          const isCreating = creatingTemplateId === template.id
          const theme = getTemplateThemeStyles(template.category)

          return (
            <div
              key={template.id}
              className={`rounded-2xl border p-5 transition-all ${theme.card}`}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className={`rounded-xl p-3 ${theme.icon}`}>
                  <FileText className="h-6 w-6" />
                </div>
                <span className={`rounded-full px-2 py-1 text-xs font-medium ${theme.badge}`}>
                  {template.category}
                </span>
              </div>

              <h2 className="text-xl font-semibold text-slate-900">{template.name}</h2>
              <p className="mt-2 text-sm text-slate-600">{template.description}</p>
              <p className={`mt-3 text-xs font-semibold uppercase tracking-[0.18em] ${theme.accent}`}>{template.sample}</p>

              <div className={`mt-5 min-h-28 rounded-xl border p-4 text-sm ${theme.preview}`}>
                <p className="font-semibold">{template.title}</p>
                <p className="mt-2 leading-7">
                  {template.content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 150)}...
                </p>
              </div>

              <button
                onClick={() => createFromTemplate(template)}
                disabled={Boolean(creatingTemplateId)}
                className={`mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 font-medium shadow-[0_14px_28px_rgba(48,58,69,0.1)] disabled:opacity-50 ${theme.button}`}
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
