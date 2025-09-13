import { test, expect } from 'vitest'
import { meals } from '../src/lib/serverActions'
import { seedFamilyWeek, cleanupFamily } from './helpers'
import blink from '../src/blink/client'

test('generateWeek persists meals and one grocery list', async () => {
  const { familyId, weekStart } = await seedFamilyWeek()
  const weekStartDate = new Date(weekStart)
  
  const res = await meals.generateWeek(familyId, { 
    weekStart: weekStartDate, 
    dietPrefs: { diet: null, allergies: [], budget: null, timePerMeal: null } 
  })
  
  expect(res.ok).toBe(true)
  expect(res.listId).toBeTruthy()

  const mealsData = await blink.db.meals.list({ where: { familyId } })
  expect(mealsData.length).toBeGreaterThan(0)

  const lists = await blink.db.lists.list({ where: { familyId, type: 'grocery' } })
  expect(lists.length).toBe(1)

  const items = await blink.db.listItems.list({ where: { listId: lists[0].id } })
  expect(items.length).toBeGreaterThan(0)

  await cleanupFamily(familyId)
}, 20_000)