import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import LoadingSpinner from '../components/LoadingSpinner'

const JoinDocumentPage = () => {
  const { shareId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  useEffect(() => {
    const joinByShareId = async () => {
      try {
        const normalizedShareId = (shareId || '').trim().toUpperCase()

        if (!normalizedShareId) {
          throw new Error('Invalid share link')
        }

        const { data, error } = await supabase.rpc('join_document_by_share_id', {
          input_share_id: normalizedShareId,
        })

        if (error || !data?.length || !data[0]?.document_id) {
          throw new Error(error?.message || 'Invalid or expired share link')
        }

        toast.success('Joined document')
        navigate(`/editor/${data[0].document_id}`, { replace: true })
      } catch (error) {
        toast.error(error.message || 'Failed to join document')
        navigate('/dashboard', { replace: true })
      }
    }

    if (user?.id) {
      joinByShareId()
    }
  }, [shareId, user, navigate])

  return <LoadingSpinner fullScreen />
}

export default JoinDocumentPage
