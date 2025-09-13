import { test, expect } from 'vitest'
import blink from '../src/blink/client'
import { routines } from '../src/lib/serverActions'
import { cleanupFamily } from './helpers'

function captureToasts() {
  const messages: string[] = []
  // @ts-ignore
  globalThis.window = globalThis.window || ({} as any)
  // @ts-ignore
  ;(globalThis.window as any).__toastPing = (m: string) => { messages.push(m) }
  return messages
}

test('routine update persists schedule and emits success toast', async () => {
  const toasts = captureToasts()

  // Create family, child, routine
  const famId = `test_family_${Date.now()}`
  await blink.db.families.create({ id: famId, name: 'Test Fam', ownerId: 'tester' })
  await blink.db.familyMembers.create({ id: `mem_${Date.now()}`, familyId: famId, userId: 'tester', role: 'owner' })
  const childId = `test_child_${Date.now()}`
  await blink.db.children.create({ id: childId, familyId: famId, name: 'Kiddo' })
  const routineId = `test_routine_${Date.now()}`
  await blink.db.routines.create({ id: routineId, childId, title: 'Old Title', scheduleJson: JSON.stringify({ time: '07:00', days: ['monday'], tasks: ['A'] }), streakCount: '0' })

  // Update via server action
  const newSchedule = { time: '08:15', days: ['monday','wednesday'], tasks: ['Brush teeth','Get dressed'] }
  const res = await routines.update(routineId, { title: 'New Title', schedule: newSchedule })
  expect(res.ok).toBe(true)

  // Verify DB state
  const updated = (await blink.db.routines.list({ where: { id: routineId }, limit: 1 }))[0]
  expect(updated.title).toBe('New Title')
  const parsed = JSON.parse(updated.scheduleJson || '{}')
  expect(parsed.time).toBe('08:15')
  expect(parsed.days).toEqual(['monday','wednesday'])
  expect(parsed.tasks).toEqual(['Brush teeth','Get dressed'])

  // Verify a success toast ping occurred
  expect(toasts.some(m => m.startsWith('toast-success:') && m.includes('Routine updated'))).toBe(true)

  await cleanupFamily(famId)
}, 20_000)
