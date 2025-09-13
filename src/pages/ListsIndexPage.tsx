import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useFamily } from '@/lib/familyContext'
import blink from '@/blink/client'
import toast from '@/lib/notify'

export default function ListsIndexPage() {
  const navigate = useNavigate()
  const { familyId } = useFamily()

  useEffect(() => {
    let cancelled = false
    const go = async () => {
      try {
        if (!familyId) return
        const lists = await blink.db.lists.list({ where: { familyId, type: 'grocery' }, orderBy: { createdAt: 'desc' }, limit: 1 })
        if (cancelled) return
        if (lists.length > 0) {
          navigate(`/lists/${lists[0].id}`)
          toast.success('Opening your latest grocery list')
        } else {
          navigate('/trips')
          toast('No lists yet — create one from Trips & Lists')
        }
      } catch (e) {
        navigate('/')
        toast.error('Could not open lists')
      }
    }
    go()
    return () => { cancelled = true }
  }, [familyId, navigate])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
        <p className="text-muted-foreground">Loading lists…</p>
      </div>
    </div>
  )
}
