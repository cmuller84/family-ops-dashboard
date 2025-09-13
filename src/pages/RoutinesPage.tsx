import React, { useState, useEffect } from 'react'
import { Clock, Plus, Star, User, Calendar, CheckCircle, Pencil } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { useFamily } from '@/lib/familyContext'
import { children, routines, routineLogs } from '@/lib/serverActions'
import { todayISOInTZ } from '@/lib/dates'
import type { Child, Routine } from '@/types'
import toast from '@/lib/notify'
import blink from '@/blink/client'
import { Link } from 'react-router-dom'

interface RoutineTaskCheckboxProps {
  task: string
  taskIndex: number
  routineId: string
  onComplete: () => void
}

function RoutineTaskCheckbox({ task, taskIndex, routineId, onComplete }: RoutineTaskCheckboxProps) {
  const [checking, setChecking] = useState(false)
  const [isChecked, setIsChecked] = useState(false)
  const [lastUpdateTime, setLastUpdateTime] = useState(0)

  // Check if this specific task is completed today
  const checkTaskStatus = React.useCallback(async () => {
    try {
      const todayISO = todayISOInTZ()
      const taskLogs = await blink.db.routineTaskLogs.list({
        where: { routineId: routineId, date: todayISO },
        limit: 500
      })
      const match = taskLogs.find((l: any) => String(l.taskIndex) === String(taskIndex))
      const newCheckedState = !!(match && Number(match.checked) > 0)
      setIsChecked(newCheckedState)
    } catch (error) {
      console.error('Failed to check task status:', error)
      setIsChecked(false)
    }
  }, [routineId, taskIndex])

  useEffect(() => {
    checkTaskStatus()
  }, [checkTaskStatus, lastUpdateTime])

  // Add in-flight tracking to prevent race conditions
  const inFlight = React.useRef<Record<string, boolean>>({})

  const handleCheck = async (checked: boolean) => {
    const taskKey = `${routineId}_${taskIndex}`
    if (checking || inFlight.current[taskKey]) return // Prevent race conditions
    
    inFlight.current[taskKey] = true
    setChecking(true)
    
    // Store original state for rollback
    const originalChecked = isChecked
    
    try {
      // Optimistic update
      setIsChecked(checked)
      
      const todayISO = todayISOInTZ()
      const result = await routines.toggleTask(routineId, taskIndex, checked, todayISO)
      
      console.log('[RoutineTaskCheckbox] Task toggle result:', result)
      
      // Show success toast with updated progress and streak
      const streakPart = result.streak > 0 ? `, streak ${result.streak}` : ''
      toast.success(`Updated: ${result.completed}/${result.total} tasks complete${streakPart}`)
      
      setLastUpdateTime(Date.now())
      onComplete()
    } catch (error) {
      console.error('Failed to toggle task:', error)
      toast.error('Failed to update task')
      // Revert optimistic update
      setIsChecked(originalChecked)
    } finally {
      setChecking(false)
      delete inFlight.current[taskKey]
    }
  }

  return (
    <div className="flex items-center space-x-2 text-sm">
      <Checkbox
        checked={isChecked === true}
        onCheckedChange={(v) => handleCheck(v === true)}
        disabled={checking}
        className="w-4 h-4"
      />
      <span className={isChecked ? 'line-through text-muted-foreground' : ''}>{task}</span>
    </div>
  )
}

interface RoutineWithChild extends Routine {
  childName?: string
}

interface RoutineTemplate {
  title: string
  tasks: string[]
  suggestedTime: string
}

const ROUTINE_TEMPLATES: RoutineTemplate[] = [
  {
    title: 'Morning Routine',
    tasks: ['Brush teeth', 'Get dressed', 'Make bed', 'Eat breakfast', 'Pack backpack'],
    suggestedTime: '07:00'
  },
  {
    title: 'After School',
    tasks: ['Hang up backpack', 'Wash hands', 'Snack time', 'Homework', 'Free play'],
    suggestedTime: '15:30'
  },
  {
    title: 'Bedtime Routine',
    tasks: ['Clean up toys', 'Bath time', 'Brush teeth', 'Pajamas', 'Story time'],
    suggestedTime: '19:00'
  },
  {
    title: 'Weekend Chores',
    tasks: ['Make bed', 'Tidy room', 'Help with laundry', 'Feed pets', 'Family time'],
    suggestedTime: '09:00'
  }
]

export function RoutinesPage() {
  const { family, role } = useFamily()
  const [familyChildren, setFamilyChildren] = useState<Child[]>([])
  const [familyRoutines, setFamilyRoutines] = useState<RoutineWithChild[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [selectedChild, setSelectedChild] = useState<Child | null>(null)
  const [selectedTemplate, setSelectedTemplate] = useState<RoutineTemplate | null>(null)
  const [newRoutine, setNewRoutine] = useState({
    title: '',
    tasks: [''],
    time: '07:00',
    days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
  })

  const loadData = React.useCallback(async () => {
    if (!family) return
    
    try {
      setLoading(true)
      
      // Load children
      const childrenData = await children.list(family.id)
      setFamilyChildren(childrenData)
      
      // Load routines
      if (childrenData.length > 0) {
        const routinesData = await routines.listByFamily(family.id)
        // Enhance with child names
        const routinesWithChildren = routinesData.map(routine => ({
          ...routine,
          childName: childrenData.find(c => c.id === routine.childId)?.name || 'Unknown'
        }))
        setFamilyRoutines(routinesWithChildren)
      }
    } catch (error) {
      console.error('Failed to load routines data:', error)
    } finally {
      setLoading(false)
    }
  }, [family])

  useEffect(() => {
    if (family) {
      loadData()
    }
  }, [loadData, family])

  // Compute initial progress per routine on load
  useEffect(() => {
    const computeAllProgress = async () => {
      const progressEntries: Record<string, { completed: number; total: number; streak: number }> = {}
      for (const routine of familyRoutines) {
        const p = await getRoutineProgress(routine)
        progressEntries[routine.id] = p
      }
      setRoutineProgress(prev => ({ ...prev, ...progressEntries }))
    }
    if (familyRoutines.length > 0) computeAllProgress()
  }, [familyRoutines])

  const [creatingRoutine, setCreatingRoutine] = useState(false)

  const createRoutine = async () => {
    if (!selectedChild || !newRoutine.title.trim() || newRoutine.tasks.every(t => !t.trim()) || creatingRoutine) return
    
    setCreatingRoutine(true)
    try {
      const schedule = {
        type: 'recurring',
        time: newRoutine.time,
        days: newRoutine.days,
        tasks: newRoutine.tasks.filter(task => task.trim())
      }
      
      const routineId = await routines.create(selectedChild.id, newRoutine.title, schedule)
      toast.success('Routine created successfully!')
      
      // Optimistically add to UI with real ID
      const newRoutineObj = {
        id: routineId,
        childId: selectedChild.id,
        title: newRoutine.title,
        scheduleJson: JSON.stringify(schedule),
        streakCount: '0',
        childName: selectedChild.name,
        createdAt: new Date().toISOString()
      }
      setFamilyRoutines(prev => [newRoutineObj, ...prev])
      
      setShowCreateForm(false)
      resetForm()
      
      // Sync with server after a brief delay to ensure consistency
      setTimeout(() => {
        loadData()
      }, 500)
    } catch (error) {
      console.error('Failed to create routine:', error)
      toast.error('Failed to create routine')
    } finally {
      setCreatingRoutine(false)
    }
  }

  function resetForm() {
    setNewRoutine({
      title: '',
      tasks: [''],
      time: '07:00',
      days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
    })
    setSelectedChild(null)
    setSelectedTemplate(null)
  }

  const applyTemplate = (template: RoutineTemplate) => {
    setSelectedTemplate(template)
    setNewRoutine({
      ...newRoutine,
      title: template.title,
      tasks: [...template.tasks],
      time: template.suggestedTime
    })
  }

  const addTask = () => {
    setNewRoutine({
      ...newRoutine,
      tasks: [...newRoutine.tasks, '']
    })
  }

  const updateTask = (index: number, value: string) => {
    const updatedTasks = [...newRoutine.tasks]
    updatedTasks[index] = value
    setNewRoutine({
      ...newRoutine,
      tasks: updatedTasks
    })
  }

  const removeTask = (index: number) => {
    if (newRoutine.tasks.length > 1) {
      const updatedTasks = newRoutine.tasks.filter((_, i) => i !== index)
      setNewRoutine({
        ...newRoutine,
        tasks: updatedTasks
      })
    }
  }

  const toggleDay = (day: string) => {
    const updatedDays = newRoutine.days.includes(day)
      ? newRoutine.days.filter(d => d !== day)
      : [...newRoutine.days, day]
    
    setNewRoutine({
      ...newRoutine,
      days: updatedDays
    })
  }

  const getRoutineProgress = async (routine: RoutineWithChild) => {
    const schedule = JSON.parse(routine.scheduleJson || '{}')
    const tasks = Array.isArray(schedule.tasks) ? schedule.tasks : []
    const visibleCount = Math.min(tasks.length, 4)
    
    try {
      const todayISO = todayISOInTZ()
      // Get all task logs for this routine today from correct table
      const taskLogs = await blink.db.routineTaskLogs.list({ 
        where: { 
          routineId: routine.id,
          date: todayISO
        },
        limit: 500
      })
      
      // Count unique checked tasks among the first 4 only
      const checkedSet = new Set<number>()
      for (const log of taskLogs) {
        const idx = Number((log as any).taskIndex)
        if (Number(log.checked) > 0 && Number.isFinite(idx) && idx >= 0 && idx < visibleCount) {
          checkedSet.add(idx)
        }
      }

      return {
        completed: checkedSet.size,
        total: visibleCount,
        streak: parseInt(routine.streakCount || '0')
      }
    } catch (error) {
      console.error('Failed to get routine progress:', error)
      return {
        completed: 0,
        total: visibleCount,
        streak: parseInt(routine.streakCount || '0')
      }
    }
  }

  // Track real-time progress for each routine
  const [routineProgress, setRoutineProgress] = useState<Record<string, { completed: number, total: number, streak: number }>>({})

  const getDayName = (day: string) => {
    const days = {
      monday: 'Mon',
      tuesday: 'Tue', 
      wednesday: 'Wed',
      thursday: 'Thu',
      friday: 'Fri',
      saturday: 'Sat',
      sunday: 'Sun'
    }
    return days[day as keyof typeof days] || day
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Routines</h1>
          <p className="text-muted-foreground">
            {role === 'child'
              ? 'Complete your daily routines and build great habits!'
              : 'Manage daily routines for your children'}
        </div>
        {(role === 'owner' || role === 'adult') && (
          <Button
            onClick={() => setShowCreateForm(true)}
            className="flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>New Routine</span>
          </Button>
        )}
      </div>
      {/* Create Routine Modal */}
      {showCreateForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Create New Routine</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Child Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Select Child</label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {familyChildren.map((child) => (
                  <Button
                    key={child.id}
                    variant={selectedChild?.id === child.id ? 'default' : 'outline'}
                    onClick={() => setSelectedChild(child)}
                    className="flex items-center space-x-2"
                  >
                    <User className="w-4 h-4" />
                    <span>{child.name}</span>
                  </Button>
                ))}
              </div>
            </div>

            {/* Templates */}
            <div>
              <label className="block text-sm font-medium mb-2">Choose Template (Optional)</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {ROUTINE_TEMPLATES.map((template, index) => (
                  <Button
                    key={index}
                    variant={selectedTemplate?.title === template.title ? 'default' : 'outline'}
                    onClick={() => applyTemplate(template)}
                    className="text-left h-auto p-3"
                  >
                    <div>
                      <p className="font-medium">{template.title}</p>
                      <p className="text-xs text-muted-foreground">{template.tasks.length} tasks</p>
                    </div>
                  </Button>
                ))}
              </div>
            </div>

            {/* Routine Details */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Routine Name</label>
                <input
                  type="text"
                  value={newRoutine.title}
                  onChange={(e) => setNewRoutine({...newRoutine, title: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background"
                  placeholder="e.g., Morning Routine"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Time</label>
                <input
                  type="time"
                  value={newRoutine.time}
                  onChange={(e) => setNewRoutine({...newRoutine, time: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background"
                />
              </div>
            </div>

            {/* Days */}
            <div>
              <label className="block text-sm font-medium mb-2">Days</label>
              <div className="flex flex-wrap gap-2">
                {['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].map((day) => (
                  <Button
                    key={day}
                    size="sm"
                    variant={newRoutine.days.includes(day) ? 'default' : 'outline'}
                    onClick={() => toggleDay(day)}
                  >
                    {getDayName(day)}
                  </Button>
                ))}
              </div>
            </div>

            {/* Tasks */}
            <div>
              <label className="block text-sm font-medium mb-2">Tasks</label>
              <div className="space-y-2">
                {newRoutine.tasks.map((task, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input
                      type="text"
                      value={task}
                      onChange={(e) => updateTask(index, e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg border border-input bg-background"
                      placeholder={`Task ${index + 1}`}
                    />
                    {newRoutine.tasks.length > 1 && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeTask(index)}
                      >
                        ×
                      </Button>
                    )}
                  </div>
                ))}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={addTask}
                  className="flex items-center space-x-1"
                >
                  <Plus className="w-3 h-3" />
                  <span>Add Task</span>
                </Button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4">
              <Button variant="ghost" onClick={() => { setShowCreateForm(false); resetForm(); }}>
                Cancel
              </Button>
              <Button 
                onClick={createRoutine}
                disabled={!selectedChild || !newRoutine.title.trim() || newRoutine.tasks.every(t => !t.trim()) || creatingRoutine}
                className="flex items-center space-x-2"
              >
                {creatingRoutine && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />}
                <span>{creatingRoutine ? 'Creating...' : 'Create Routine'}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Routines Grid */}
      {familyRoutines.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {familyRoutines.map((routine) => {
            const schedule = JSON.parse(routine.scheduleJson || '{}')
            const cachedProgress = routineProgress[routine.id]
            const progress = cachedProgress || {
              completed: 0,
              total: schedule.tasks?.length || 0,
              streak: parseInt(routine.streakCount || '0')
            }
            
            return (
              <Card key={routine.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{routine.title}</CardTitle>
                    <div className="flex items-center space-x-1">
                      <Star className="w-4 h-4 text-yellow-500" />
                      <span className="text-sm font-medium">{progress.streak}</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                    <div className="flex items-center space-x-1">
                      <User className="w-4 h-4" />
                      <span>{routine.childName}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Clock className="w-4 h-4" />
                      <span>{schedule.time || 'No time set'}</span>
                    </div>
                  </div>
                  {(role === 'owner' || role === 'adult') && (
                    <div>
                      <Link to={`/routines/${routine.id}`} className="inline-flex items-center text-sm text-primary hover:underline">
                        <Pencil className="w-4 h-4 mr-1" /> Edit
                      </Link>
                    </div>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Days */}
                  {schedule.days && (
                    <div className="flex flex-wrap gap-1">
                      {schedule.days.map((day: string) => (
                        <span
                          key={day}
                          className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary"
                        >
                          {getDayName(day)}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Tasks with checkboxes */}
                  <div className="space-y-2">
                    {schedule.tasks?.slice(0, 4).map((task: string, index: number) => (
                      <RoutineTaskCheckbox 
                        key={`${routine.id}-task-${index}`}
                        task={task}
                        taskIndex={index}
                        routineId={routine.id}
                        onComplete={async () => {
                          // Calculate updated progress immediately
                          const updatedProgress = await getRoutineProgress(routine)
                          setRoutineProgress(prev => ({
                            ...prev,
                            [routine.id]: updatedProgress
                          }))
                          
                          // Reload full data to sync streaks
                          setTimeout(() => loadData(), 500)
                        }}
                      />
                    ))}
                    {schedule.tasks?.length > 4 && (
                      <p className="text-xs text-muted-foreground">
                        +{schedule.tasks.length - 4} more tasks
                      </p>
                    )}
                  </div>

                  {/* Progress */}
                  <div className="pt-2">
                    <div className="flex justify-between text-sm mb-1">
                      <span>Today's Progress</span>
                      <span>{progress.completed}/{progress.total}</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-2">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all"
                        style={{ 
                          width: progress.total > 0 ? `${(progress.completed / progress.total) * 100}%` : '0%' 
                        }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="pt-6 text-center">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No routines yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first routine to help your children stay organized.
            </p>
            {familyChildren.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Add children to your family first to create routines.
              </p>
            ) : (
              <Button
                onClick={() => setShowCreateForm(true)}
                disabled={role === 'child'}
              >
                {role === 'child' ? 'Ask an adult to create routines' : 'Create Your First Routine'}
              </Button>
            )}        </Card>
      )}
    </div>
  )
}