import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import blink from '@/blink/client'
import toast from '@/lib/notify'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ChevronLeft, Plus, Trash2, Copy } from 'lucide-react'
import { routines as routineActions } from '@/lib/serverActions'
import { useFamily } from '@/lib/familyContext'
import { 
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction
} from '@/components/ui/alert-dialog'

interface Schedule {
  type?: string
  time?: string
  days?: string[]
  tasks?: string[]
}

export default function RoutineEditPage() {
  const { routineId } = useParams()
  const navigate = useNavigate()
  const { role } = useFamily()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [title, setTitle] = useState('')
  const [time, setTime] = useState('07:00')
  const [days, setDays] = useState<string[]>(['monday','tuesday','wednesday','thursday','friday'])
  const [tasks, setTasks] = useState<string[]>([''])
  const [childName, setChildName] = useState<string>('')

  const dayShort = (d: string) => ({
    monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun'
  } as Record<string,string>)[d] || d

  useEffect(() => {
    const load = async () => {
      if (!routineId) return

      let retryCount = 0
      const maxRetries = 3

      while (retryCount < maxRetries) {
        try {
          setLoading(true)

          // Add a small delay for retries
          if (retryCount > 0) {
            await new Promise(resolve => setTimeout(resolve, 1000 * retryCount))
          }

          const r = (await blink.db.routines.list({ where: { id: routineId }, limit: 1 }))[0]
          if (!r) {
            // If not found, don't retry - it genuinely doesn't exist
            throw new Error('Routine not found')
          }

          setTitle(r.title || '')
          let schedule: Schedule = {}
          try { schedule = JSON.parse(r.scheduleJson || '{}') } catch { /* ignore */ }
          if (schedule?.time) setTime(String(schedule.time))
          if (Array.isArray(schedule?.days)) setDays(schedule.days as string[])
          if (Array.isArray(schedule?.tasks) && schedule.tasks.length) setTasks(schedule.tasks as string[])

          // Load child name (optional)
          try {
            const ch = (await blink.db.children.list({ where: { id: r.childId }, limit: 1 }))[0]
            setChildName(ch?.name || '')
          } catch { /* ignore */ }

          // Success - exit the retry loop
          break
        } catch (e: any) {
          retryCount++

          // Check if it's a network error and we should retry
          const isNetworkError = e?.message?.includes('fetch') || e?.message?.includes('network') || e?.message?.includes('Network')

          if (retryCount >= maxRetries || !isNetworkError) {
            console.error('Failed to load routine after retries:', e)
            toast.error(e?.message || 'Failed to load routine')
            // Navigate back on error
            setTimeout(() => navigate('/routines'), 2000)
            break
          }
        } finally {
          if (retryCount >= maxRetries || retryCount === 0) {
            setLoading(false)
          }
        }
      }
    }
    load()
  }, [routineId, navigate])

  const toggleDay = (d: string) => {
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])
  }

  const addTask = () => setTasks(prev => [...prev, ''])
  const updateTask = (i: number, v: string) => setTasks(prev => prev.map((t, idx) => idx === i ? v : t))
  const removeTask = (i: number) => setTasks(prev => prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev)

  const handleSave = async () => {
    if (!routineId) return
    if (!title.trim()) { toast.error('Please enter a routine name'); return }
    if (!tasks.some(t => t.trim())) { toast.error('Add at least one task'); return }
    const schedule: Schedule = { type: 'recurring', time, days, tasks: tasks.filter(t => t.trim()) }
    setSaving(true)
    try {
      await routineActions.update(routineId, { title: title.trim(), schedule })
      navigate('/routines')
    } catch (e: any) {
      toast.error(e?.message || 'Failed to save routine')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-3" />
          <p className="text-muted-foreground">Loading routine…</p>
        </div>
      </div>
    )
  }

  if (role !== 'owner' && role !== 'adult') {
    return (
      <div className="flex items-center justify-center py-16">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Insufficient permissions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">You don’t have permission to edit routines. Ask a parent or owner to make changes.</p>
            <Button onClick={() => navigate('/routines')}>Back to Routines</Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/routines" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            <ChevronLeft className="w-4 h-4 mr-1" /> Back
          </Link>
          <div>
            <h1 className="text-2xl font-semibold leading-tight">Edit Routine</h1>
            {childName && <p className="text-sm text-muted-foreground">for {childName}</p>}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" onClick={async () => {
            if (!routineId) return
            try {
              const res = await routineActions.duplicate(routineId)
              navigate(`/routines/${res.id}`)
            } catch (e: any) {
              toast.error(e?.message || 'Failed to duplicate')
            }
          }}>
            <Copy className="w-4 h-4 mr-2" /> Duplicate
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" variant="destructive">
                <Trash2 className="w-4 h-4 mr-2" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this routine?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete the routine and its logs.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={async () => {
                  if (!routineId) return
                  try {
                    await routineActions.remove(routineId)
                    navigate('/routines')
                  } catch (e: any) {
                    toast.error(e?.message || 'Failed to delete')
                  }
                }}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <Button variant="ghost" onClick={() => navigate('/routines')}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-2">Routine name</label>
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Morning Routine" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Time</label>
              <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Days</label>
            <div className="flex flex-wrap gap-2">
              {['monday','tuesday','wednesday','thursday','friday','saturday','sunday'].map(d => (
                <Button key={d} type="button" size="sm" variant={days.includes(d) ? 'default' : 'outline'} onClick={() => toggleDay(d)}>
                  {dayShort(d)}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium">Tasks</label>
              <Button type="button" variant="outline" size="sm" onClick={addTask}>
                <Plus className="w-3 h-3 mr-1" /> Add Task
              </Button>
            </div>
            <div className="space-y-2">
              {tasks.map((t, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input value={t} onChange={(e) => updateTask(i, e.target.value)} placeholder={`Task ${i+1}`} />
                  {tasks.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeTask(i)} aria-label="Remove task">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
