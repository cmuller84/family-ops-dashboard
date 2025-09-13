import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "npm:@blinkdotnew/sdk"

const blink = createClient({
  projectId: 'family-ops-dashboard-68kj0g31',
  authRequired: false
})

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  try {
    const { routineId, taskIndex, date, checked } = await req.json()

    console.log('[routine-task-toggle] Request:', { routineId, taskIndex, date, checked })

    if (!routineId || taskIndex === undefined || !date) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }

    // Get routine details
    const routines = await blink.db.routines.list({ where: { id: routineId } })
    if (routines.length === 0) {
      return new Response(JSON.stringify({ error: 'Routine not found' }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      })
    }
    
    const routine = routines[0]
    const schedule = JSON.parse(routine.scheduleJson || '{}')
    const totalTasks = Array.isArray(schedule.tasks) ? schedule.tasks.length : 0
    const visibleCount = Math.min(totalTasks, 4)

    if (checked) {
      // Create or update task log
      const existing = await blink.db.routineTaskLogs.list({
        where: { routineId, taskIndex, date }
      })

      if (existing.length > 0) {
        await blink.db.routineTaskLogs.update(existing[0].id, { checked: '1' })
      } else {
        await blink.db.routineTaskLogs.create({
          id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          routineId,
          taskIndex,
          date,
          checked: '1'
        })
      }
    } else {
      // Remove task log
      const existing = await blink.db.routineTaskLogs.list({
        where: { routineId, taskIndex, date }
      })
      
      if (existing.length > 0) {
        await blink.db.routineTaskLogs.delete(existing[0].id)
      }
    }

    // Check if routine is complete after this change
    const todayLogs = await blink.db.routineTaskLogs.list({
      where: { routineId, date }
    })
    
    // Count unique checked tasks among the first 4 only
    const checkedSet = new Set<number>()
    for (const log of todayLogs) {
      const idx = Number((log as any).taskIndex)
      if (Number(log.checked) > 0 && Number.isFinite(idx) && idx >= 0 && idx < visibleCount) checkedSet.add(idx)
    }
    const completedTasks = checkedSet.size
    const isComplete = completedTasks === visibleCount && visibleCount > 0

    // Calculate BEFORE state to check if completion status changed
    const beforeCompletedTasks = checked ? Math.max(0, completedTasks - 1) : Math.min(visibleCount, completedTasks + 1)
    const wasComplete = beforeCompletedTasks === visibleCount && visibleCount > 0

    let newStreak = Number(routine.streakCount) || 0

    // Only update streak when completion state changes
    if (!wasComplete && isComplete) {
      // Routine just became complete - increment streak
      newStreak = newStreak + 1
      
      await Promise.all([
        blink.db.routines.update(routineId, { streakCount: newStreak.toString() }),
        blink.db.routineLogs.create({
          id: `routine-log-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          routineId,
          date,
          completed: '1',
          fullyComplete: '1'
        })
      ])
    } else if (wasComplete && !isComplete) {
      // Routine is no longer complete - decrement streak but don't go below 0
      newStreak = Math.max(0, newStreak - 1)
      
      await blink.db.routines.update(routineId, { streakCount: newStreak.toString() })
      
      // Remove the completion log
      const routineLogs = await blink.db.routineLogs.list({
        where: { routineId, date }
      })
      
      if (routineLogs.length > 0) {
        await blink.db.routineLogs.delete(routineLogs[0].id)
      }
    }

    const responseData = {
      success: true,
      completed: completedTasks,
      total: visibleCount,
      streak: newStreak
    }

    console.log('[routine-task-toggle] Success response:', responseData)

    return new Response(JSON.stringify(responseData), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch (error) {
    console.error('Error toggling routine task:', error)
    
    return new Response(JSON.stringify({ 
      error: 'Internal server error',
      details: error.message 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    })
  }
})