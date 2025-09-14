import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Calendar, UtensilsCrossed, Clock, MapPin, ChevronRight, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { formatDate, cn, getWeekDates } from '@/lib/utils'
import { useFamily } from '@/lib/familyContext'
import { events, meals, routines, children, seed, routineLogs } from '@/lib/serverActions'
import { todayISOInTZ } from '@/lib/dates'
import toast from '@/lib/notify'
import type { Event, Meal, Routine, Child } from '@/types'
import blink from '@/blink/client'

function SwapRecipeButton({ meal, familyId, onUpdate }: { meal: any; familyId?: string; onUpdate: (meal: any) => void }) {
  const [swapping, setSwapping] = useState(false)

  const handleSwap = async () => {
    if (!meal || !familyId || swapping) return
    setSwapping(true)
    try {
      console.log('Starting recipe swap for meal:', meal.id, 'in family:', familyId)
      const result = await meals.swapRecipe(meal.id, familyId)
      console.log('Recipe swap result:', result)
      
      if (result.ok && result.recipe) {
        const updatedMeal = {
          ...meal,
          recipeTitle: result.recipe.name,
          ingredientsJson: JSON.stringify(result.recipe.ingredients),
          instructions: 'Quick and delicious'
        }
        console.log('Updating UI with new meal:', updatedMeal)
        onUpdate(updatedMeal)
        toast.success(`Dinner swapped to ${result.recipe.name}`)
      } else {
        console.error('Invalid result from swap:', result)
        toast.error('Failed to swap recipe - invalid response')
      }
    } catch (error) {
      console.error('Failed to swap recipe:', error)
      toast.error(`Failed to swap recipe: ${error.message || 'Unknown error'}`)
    } finally {
      setSwapping(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="w-full flex items-center space-x-2"
      onClick={handleSwap}
      disabled={swapping || !meal || !familyId}
    >
      {swapping && <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />}
      <span>{swapping ? 'Swapping...' : 'Swap Recipe'}</span>
    </Button>
  )
}

function AddToGroceryListButton({ meal, familyId }: { meal: any; familyId?: string }) {
  const [adding, setAdding] = useState(false)

  const handleAdd = async () => {
    if (!meal || !familyId || adding) return
    setAdding(true)
    try {
      console.log('Adding ingredients to grocery list for meal:', meal.id, 'in family:', familyId)
      const result = await meals.addToGroceryList(meal.id, familyId)
      console.log('Add to grocery list result:', result)
      
      if (result.ok) {
      const { addedCount = 0, mergedCount = 0, totalAffected = 0 } = result as any
      if (totalAffected > 0) {
        if (addedCount > 0 && mergedCount > 0) {
          toast.success(`Added ${addedCount} ingredients and merged duplicates`)
        } else if (addedCount > 0) {
          toast.success(`Added ${addedCount} ingredients`)
        } else if (mergedCount > 0) {
          toast.success(`Merged duplicates`)
        }
      } else {
        toast('All ingredients already in grocery list')
      }
      } else {
        console.error('Invalid result from add to grocery:', result)
        toast.error('Failed to add to grocery list - invalid response')
      }
    } catch (error) {
      console.error('Failed to add to grocery list:', error)
      toast.error(`Failed to add to grocery list: ${error.message || 'Unknown error'}`)
    } finally {
      setAdding(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="w-full flex items-center space-x-2"
      onClick={handleAdd}
      disabled={adding || !meal || !familyId}
    >
      {adding && <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current" />}
      <span>{adding ? 'Adding...' : 'Add to Grocery List'}</span>
    </Button>
  )
}

export function DashboardPage() {
  const navigate = useNavigate()
  const { familyId, user } = useFamily()
  const [loading, setLoading] = useState(true)
  const [loadingRef, setLoadingRef] = useState(false)
  const [lastLoadTime, setLastLoadTime] = useState(0)
  const [eventsData, setEventsData] = useState<Event[]>([])
  const [mealsData, setMealsData] = useState<Meal[]>([])
  const [routinesData, setRoutinesData] = useState<Routine[]>([])
  const [childrenData, setChildrenData] = useState<Child[]>([])
  const [routineCompletions, setRoutineCompletions] = useState<Record<string, boolean>>({})
  const [isCreatingSampleData, setIsCreatingSampleData] = useState(false)
  const today = new Date()
  const weekDates = getWeekDates()
  const weekStart = React.useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - d.getDay() + 1)
    return d
  }, [])

  const loadDashboardDataRef = React.useRef<() => Promise<void> | null>(null)

  useEffect(() => {
    if (!familyId || loadingRef) return

    let cancelled = false

    const loadDashboardData = async () => {
      try {
        setLoadingRef(true)
        setLoading(true)

        // Load data with proper error boundaries
        const [weekEvents, todayMeals, familyChildren] = await Promise.all([
          events.listWeek(familyId, weekStart).catch(err => {
            console.error('Failed to load events:', err)
            return []
          }),
          meals.getToday(familyId).catch(err => {
            console.error('Failed to load meals:', err)
            return []
          }),
          children.list(familyId).catch(err => {
            console.error('Failed to load children:', err)
            return []
          })
        ])

        if (cancelled) return

        setEventsData(weekEvents)
        setMealsData(todayMeals)
        setChildrenData(familyChildren)

        // Load routines if children exist
        if (familyChildren.length > 0) {
          const familyRoutines = await routines.listByFamily(familyId).catch(err => {
            console.error('Failed to load routines:', err)
            return []
          })
          if (cancelled) return
          setRoutinesData(familyRoutines)

          // Check individual task completions using routineTaskLogs table
          const completions: Record<string, boolean> = {}
          const todayISO = todayISOInTZ()

          try {
            // Get all task logs for today in a single query
            const allTaskLogs = await blink.db.routineTaskLogs.list({
              where: {
                date: todayISO,
                routineId: { in: familyRoutines.map((r) => r.id) }
              }
            })

            // Process each routine's tasks
            for (const routine of familyRoutines.slice(0, 5)) {
              const schedule = JSON.parse(routine.scheduleJson || '{}')
              const tasks = schedule.tasks || []

              for (let taskIndex = 0; taskIndex < Math.min(tasks.length, 4); taskIndex++) {
                const taskLog = allTaskLogs.find(
                  (log) => log.routineId === routine.id && Number((log as any).taskIndex) === taskIndex
                )

                completions[`${routine.id}_${taskIndex}`] = taskLog ? Number(taskLog.checked) > 0 : false
              }
            }
          } catch (error) {
            console.error('Failed to load task completions:', error)
            // Set all tasks as incomplete on error
            familyRoutines.slice(0, 5).forEach((routine) => {
              const schedule = JSON.parse(routine.scheduleJson || '{}')
              const tasks = schedule.tasks || []
              for (let taskIndex = 0; taskIndex < Math.min(tasks.length, 4); taskIndex++) {
                completions[`${routine.id}_${taskIndex}`] = false
              }
            })
          }

          setRoutineCompletions(completions)
        }
      } catch (error: any) {
        console.error('Failed to load dashboard data:', error)
        // Don't show error toasts for network issues during normal operation
      } finally {
        if (!cancelled) {
          setLoading(false)
          setLoadingRef(false)
          setLastLoadTime(Date.now())
          try { (window as any).__qaReady?.('dashboard') } catch (e) { /* noop */ }
        }
      }
    }

    loadDashboardData().catch((e) => console.error('loadDashboardData error:', e))

    // expose to other callbacks (e.g. seeding flow)
    loadDashboardDataRef.current = loadDashboardData

    return () => {
      cancelled = true
      loadDashboardDataRef.current = null
    }
  }, [familyId, weekStart])

  // Add in-flight tracking to prevent routine toggle race conditions
  const inFlight = React.useRef<Record<string, boolean>>({})

  const toggleRoutineTask = async (routineId: string, taskIndex: number, completed: boolean) => {
    const taskKey = `${routineId}_${taskIndex}`
    if (inFlight.current[taskKey]) return // Prevent race conditions
    
    inFlight.current[taskKey] = true
    
    // Store original state for rollback
    const originalState = routineCompletions[taskKey]
    
    try {
      // Optimistically update UI for this specific task ONLY
      setRoutineCompletions(prev => ({ ...prev, [taskKey]: completed }))
      
      const todayISO = todayISOInTZ()
      const result = await routines.toggleTask(routineId, taskIndex, completed, todayISO)
      
      // Update streak in routines data if changed
      setRoutinesData(prev => prev.map(routine => {
        if (routine.id === routineId) {
          return { ...routine, streakCount: result.streak.toString() }
        }
        return routine
      }))
      
      // Show success toast with updated progress and streak
      const streakPart = result.streak > 0 ? `, streak ${result.streak}` : ''
      toast.success(`Updated: ${result.completed}/${result.total} tasks complete${streakPart}`)
    } catch (error) {
      console.error('Failed to update routine task:', error)
      toast.error('Failed to update task')
      // Revert optimistic update
      setRoutineCompletions(prev => ({ ...prev, [taskKey]: originalState }))
    } finally {
      delete inFlight.current[taskKey]
    }
  }

  const createSampleData = async () => {
    if (!user?.id || !familyId || isCreatingSampleData) return
    
    setIsCreatingSampleData(true)
    try {
      await seed.createDemoFamily(user.id)
      toast.success('Family seeded with demo data!')
      if (loadDashboardDataRef.current) await loadDashboardDataRef.current()
    } catch (error) {
      console.error('Failed to create demo family:', error)
      toast.error('Failed to set up demo family')
    } finally {
      setIsCreatingSampleData(false)
    }
  }

  // Get events for the week grouped by day
  const thisWeek = weekDates.map(date => {
    const dayEvents = eventsData.filter(event => {
      const eventDate = new Date(event.startTime)
      return eventDate.toDateString() === date.toDateString()
    })
    
    return {
      day: date.toLocaleDateString('en-US', { weekday: 'long' }),
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      events: dayEvents.map(e => `${new Date(e.startTime).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })} ${e.title}`)
    }
  })

  // Get today's routines from children
  const todaysRoutines = routinesData.flatMap(routine => {
    const child = childrenData.find(c => c.id === routine.childId)
    const schedule = JSON.parse(routine.scheduleJson || '{}')
    
    return schedule.tasks?.slice(0, 4).map((task: string, taskIndex: number) => ({
      child: child?.name || 'Unknown',
      task,
      completed: routineCompletions[`${routine.id}_${taskIndex}`] || false,
      routineId: routine.id,
      taskIndex
    })) || []
  }).slice(0, 4)

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Good morning!</h1>
          <p className="text-muted-foreground">{formatDate(today)}</p>
        </div>
        {(childrenData.length === 0 || eventsData.length === 0) && (
          <Button 
            onClick={createSampleData}
            disabled={isCreatingSampleData}
            className="flex items-center space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>{isCreatingSampleData ? 'Setting up...' : 'Get Started'}</span>
          </Button>
        )}
      </div>

      {/* Dashboard Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {/* This Week Card */}
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-lg font-semibold flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-primary" />
              <span>This Week</span>
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-muted-foreground">
              View All
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {thisWeek.map((day, index) => (
                <div key={index} className="flex items-start space-x-4">
                  <div className="text-center min-w-[60px]">
                    <p className="text-sm font-medium">{day.day}</p>
                    <p className="text-xs text-muted-foreground">{day.date}</p>
                  </div>
                  <div className="flex-1 space-y-1">
                    {day.events.map((event, eventIndex) => (
                      <p key={eventIndex} className="text-sm text-foreground">
                        {event}
                      </p>
                    ))}
                    {day.events.length === 0 && (
                      <p className="text-sm text-muted-foreground italic">No events</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Tonight's Dinner Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center space-x-2">
              <UtensilsCrossed className="w-5 h-5 text-accent" />
              <span>Tonight's Dinner</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(mealsData.find(m => m.mealType === 'dinner') || mealsData[0]) ? (
              (() => {
                const dinner = mealsData.find(m => m.mealType === 'dinner') || mealsData[0]
                return (
                  <div className="space-y-4">
                    <div>
                      <h3 className="font-medium mb-1">{dinner.recipeTitle}</h3>
                      <p className="text-sm text-muted-foreground">{dinner.instructions || 'No instructions'}</p>
                    </div>
                    <div className="space-y-2">
                      <SwapRecipeButton
                        meal={dinner}
                        familyId={familyId}
                        onUpdate={(updatedMeal) => {
                          setMealsData(prev => prev.map(meal => 
                            meal.id === updatedMeal.id ? updatedMeal : meal
                          ))
                        }}
                      />
                      <AddToGroceryListButton
                        meal={dinner}
                        familyId={familyId}
                      />
                    </div>
                  </div>
                )
              })()
            ) : (
              <div className="space-y-4">
                <div className="text-center py-4">
                  <UtensilsCrossed className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No dinner planned</p>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => {
                    try {
                      navigate('/meals')
                    } catch (error) {
                      console.error('Navigation failed:', error)
                      toast.error('Failed to navigate to meals')
                    }
                  }}
                >
                  Plan Tonight's Dinner
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today's Routines Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center space-x-2">
              <Clock className="w-5 h-5 text-primary" />
              <span>Today's Routines</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {todaysRoutines.length > 0 ? (
              todaysRoutines.map((routine, index) => (
                <div key={index} className="flex items-center space-x-3">
                  <Checkbox
                    checked={routine.completed === true}
                    onCheckedChange={(v) => toggleRoutineTask(routine.routineId, routine.taskIndex, v === true)}
                    className="w-4 h-4"
                  />
                  <div className="flex-1">
                    <p className={cn(
                      'text-sm',
                      routine.completed ? 'line-through text-muted-foreground' : 'text-foreground'
                    )}>
                      {routine.task}
                    </p>
                    <p className="text-xs text-muted-foreground">{routine.child}</p>
                  </div>
                </div>
              ))
              ) : (
                <div className="text-center py-4">
                  <Clock className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No routines for today</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Upcoming Trip Card */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg font-semibold flex items-center space-x-2">
              <MapPin className="w-5 h-5 text-accent" />
              <span>Upcoming Trip</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {eventsData.some(event => event.title.toLowerCase().includes('trip') || event.title.toLowerCase().includes('vacation') || event.location?.toLowerCase().includes('hotel')) ? (
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-1">Beach Vacation</h3>
                  <p className="text-sm text-muted-foreground">Feb 15-22 • San Diego</p>
                </div>
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={async () => {
                      try {
                        // Check if there's an existing packing list for this trip
                        const packingLists = await blink.db.lists.list({ 
                          where: { familyId, type: 'packing' }, 
                          orderBy: { createdAt: 'desc' }, 
                          limit: 1 
                        })
                        
                        if (packingLists.length > 0) {
                          // Navigate to the existing packing list
                          navigate(`/lists/${packingLists[0].id}`)
                          toast.success('Opening your packing list')
                        } else {
                          // Navigate to trips page to create a new packing list
                          navigate('/trips')
                          toast('Create a packing list for your trip')
                        }
                      } catch (error) {
                        console.error('Failed to navigate to packing list:', error)
                        navigate('/trips')
                        toast.error('Failed to open packing list')
                      }
                    }}
                  >
                    View Packing List
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    24 days remaining
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-4">
                <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-3">No upcoming trips</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="w-full"
                  onClick={() => {
                    try {
                      navigate('/trips')
                      toast.success('Redirecting to trip planner')
                    } catch (error) {
                      console.error('Navigation failed:', error)
                      toast.error('Failed to navigate to trips')
                    }
                  }}
                >
                  Plan a Trip
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}