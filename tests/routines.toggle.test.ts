import { test, expect } from 'vitest'
import { routines } from '../src/lib/serverActions'
import { seedRoutineForToday, cleanupFamily } from './helpers'

test('toggleRoutineLog idempotent for same day', async () => {
  const { familyId, routineId } = await seedRoutineForToday()

  const today = new Date().toISOString().slice(0,10)

  const a = await routines.toggle(routineId, true, today)
  const b = await routines.toggle(routineId, true, today)
  expect(a.completed).toBe(true)
  expect(b.completed).toBe(true)
  expect(b.streak).toBe(a.streak)

  const c = await routines.toggle(routineId, false, today)
  const d = await routines.toggle(routineId, false, today)
  expect(c.completed).toBe(false)
  expect(d.completed).toBe(false)
  expect(d.streak).toBe(Math.max(0, (a.streak - 1)))

  await cleanupFamily(familyId)
}, 20_000)