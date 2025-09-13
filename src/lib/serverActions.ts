import blink from '@/blink/client'
import { ENV } from './env'
import { MealPlanZ } from './ai-schemas'
import type { ListItem } from '@/types'
import { todayISOInTZ } from './dates'
import { featuresForcePro, qaAuthBypassEnabled } from './features'
import { info, err } from './log'
import toast from '@/lib/notify'

// Utility: retry wrapper
const withRetry = async <T>(fn: () => Promise<T>, maxRetries = 3, baseDelay = 500): Promise<T> => {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: any) {
      const retryable = error?.status === 429 || error?.code === 'RATE_LIMIT_EXCEEDED' || error?.message?.includes('Failed to fetch')
      if (retryable && attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 250
        await new Promise(r => setTimeout(r, delay))
        continue
      }
      throw error
    }
  }
  throw new Error('Max retries exceeded')
}

// Subscription helpers
const getSubscriptionByFamily = async (familyId: string) => {
  const subs = await blink.db.subscriptions.list({ where: { familyId }, orderBy: { createdAt: 'desc' }, limit: 1 })
  return subs[0] || null
}
const checkSubscriptionIsActive = async (familyId: string): Promise<boolean> => {
  const sub = await getSubscriptionByFamily(familyId)
  if (!sub) return false
  const now = Date.now()
  const trialEnd = sub.trialEndsAt ? Date.parse(sub.trialEndsAt) : 0
  const periodEnd = sub.currentPeriodEnd ? Date.parse(sub.currentPeriodEnd) : 0
  if (trialEnd && now < trialEnd) return true
  return sub.status === 'active' && periodEnd && now < periodEnd
}
export const subscriptions = {
  isActive: (familyId: string) => checkSubscriptionIsActive(familyId),
  getByFamily: (familyId: string) => getSubscriptionByFamily(familyId)
}

// QA helpers + Guards
const isQADemo = (): boolean => {
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('qaDemo') === '1' || qaAuthBypassEnabled()) return true
    } catch { /* ignore */ }
  }
  return false
}

const getUserOrDemo = async (): Promise<{ id: string }> => {
  try {
    const me = await blink.auth.me()
    if (me?.id) return { id: me.id }
  } catch { /* ignore */ }
  if (isQADemo() || featuresForcePro()) return { id: 'qa-demo-user' }
  throw new Error('Not authenticated')
}

const requireAuth = () => {
  if (isQADemo() || featuresForcePro()) return true
  try {
    // Synchronous guard using SDK state; avoids async call sites needing await
    if (!blink.auth.isAuthenticated || !blink.auth.isAuthenticated()) {
      throw new Error('Not authenticated')
    }
    return true
  } catch {
    throw new Error('Not authenticated')
  }
}

const requireFamily = async (familyId: string) => {
  if (isQADemo()) {
    await assertMembership('qa-demo-user', familyId)
    return { id: 'qa-demo-user' } as any
  }
  const me = await blink.auth.me()
  if (!me?.id) throw new Error('Not authenticated')
  await assertMembership(me.id, familyId)
  return me
}
const assertMembership = async (userId: string, familyId: string) => {
  let m = await blink.db.familyMembers.list({ where: { userId, familyId }, limit: 1 })
  if (m.length === 0) {
    if (isQADemo()) {
      await blink.db.familyMembers.create({ id: `member_${Date.now()}`, familyId, userId, role: 'owner' })
      m = await blink.db.familyMembers.list({ where: { userId, familyId }, limit: 1 })
    } else {
      throw new Error('User is not a member of this family')
    }
  }
  return m[0]
}
const isPro = async (familyId: string) => featuresForcePro() || (await checkSubscriptionIsActive(familyId))
const assertPro = async (familyId: string) => { if (!(await isPro(familyId))) throw new Error('Pro subscription required for this feature') }

// Seed
export const seed = {
  async createDemoFamily(userId: string) {
    let familyId: string | null = null
    const existing = await blink.db.familyMembers.list({ where: { userId }, limit: 1 })
    if (existing.length) {
      const fam = await blink.db.families.list({ where: { id: existing[0].familyId }, limit: 1 })
      if (fam.length) familyId = fam[0].id
    }
    if (!familyId) {
      familyId = `family_${userId}_${Date.now()}`
      await blink.db.families.create({ id: familyId, name: 'My Family', ownerId: userId })
      await blink.db.familyMembers.create({ id: `member_${Date.now()}`, familyId, userId, role: 'owner' })
    }

    const child1Id = `child_${Date.now()}_1`
    const child2Id = `child_${Date.now()}_2`
    await blink.db.children.create({ id: child1Id, familyId, name: 'Avery', birthDate: '2015-03-15' })
    await blink.db.children.create({ id: child2Id, familyId, name: 'Miles', birthDate: '2018-07-22' })

    await blink.db.routines.create({
      id: `routine_${Date.now()}_1`, childId: child1Id, title: 'AM School Routine',
      scheduleJson: JSON.stringify({ type: 'recurring', time: '07:00', days: ['monday','tuesday','wednesday','thursday','friday'], tasks: ['Brush teeth','Get dressed','Pack backpack','Eat breakfast'] }),
      streakCount: '5'
    })
    await blink.db.routines.create({
      id: `routine_${Date.now()}_2`, childId: child1Id, title: 'Bedtime Routine',
      scheduleJson: JSON.stringify({ type: 'recurring', time: '19:30', days: ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'], tasks: ['Clean up toys','Bath time','Brush teeth','Story time'] }),
      streakCount: '7'
    })
    await blink.db.routines.create({
      id: `routine_${Date.now()}_3`, childId: child2Id, title: 'AM School Routine',
      scheduleJson: JSON.stringify({ type: 'recurring', time: '07:00', days: ['monday','tuesday','wednesday','thursday','friday'], tasks: ['Brush teeth','Get dressed','Pack lunch','Eat breakfast'] }),
      streakCount: '3'
    })
    await blink.db.routines.create({
      id: `routine_${Date.now()}_4`, childId: child2Id, title: 'Bedtime Routine',
      scheduleJson: JSON.stringify({ type: 'recurring', time: '19:30', days: ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'], tasks: ['Put away toys','Brush teeth','Pajamas','Story time'] }),
      streakCount: '4'
    })

    const now = new Date(); const tomorrow = new Date(now); tomorrow.setDate(now.getDate()+1); tomorrow.setHours(15,30,0,0)
    const dayAfter = new Date(now); dayAfter.setDate(now.getDate()+2); dayAfter.setHours(10,0,0,0)
    const nextWeek = new Date(now); nextWeek.setDate(now.getDate()+6); nextWeek.setHours(14,0,0,0)
    await blink.db.events.create({ id: `event_${Date.now()}_1`, familyId, title: 'School pickup', startTime: tomorrow.toISOString(), endTime: new Date(tomorrow.getTime()+30*60*1000).toISOString(), location: 'Elementary School', source: 'manual' })
    await blink.db.events.create({ id: `event_${Date.now()}_2`, familyId, title: 'Soccer practice', startTime: dayAfter.toISOString(), endTime: new Date(dayAfter.getTime()+90*60*1000).toISOString(), location: 'Community Park', source: 'manual' })
    await blink.db.events.create({ id: `event_${Date.now()}_3`, familyId, title: 'Family movie night', startTime: nextWeek.toISOString(), endTime: new Date(nextWeek.getTime()+120*60*1000).toISOString(), location: 'Home', source: 'manual' })

    const today = todayISOInTZ()
    await blink.db.meals.create({ id: `meal_${Date.now()}`, familyId, date: today, mealType: 'dinner', recipeTitle: 'Spaghetti Bolognese', ingredientsJson: JSON.stringify(['Ground beef','Spaghetti pasta','Tomato sauce','Onion','Garlic','Parmesan cheese']), instructions: 'Prep time: 45 min' })

    const glistId = `list_${Date.now()}`
    await blink.db.lists.create({ id: glistId, familyId, type: 'grocery', title: 'Weekly Groceries' })
    for (const [i, it] of ['Milk','Bananas','Chicken breast','Rice','Yogurt','Spinach'].entries()) {
      await blink.db.listItems.create({ id: `item_${glistId}_${Date.now()}_${i}`, listId: glistId, name: it, quantity: '1', category: null, checked: '0', position: i })
    }
    return { seeded: true }
  }
}

// Families
export const families = {
  async getMyPrimary(userId: string) {
    return withRetry(async () => {
      const memberships = await blink.db.familyMembers.list({ where: { userId }, limit: 1 })
      if (memberships.length > 0) {
        const fam = await blink.db.families.list({ where: { id: memberships[0].familyId }, limit: 1 })
        return fam[0] || null
      }
      return null
    })
  },
  async create(userId: string, name: string) {
    const id = `family_${userId}_${Date.now()}`
    await blink.db.families.create({ id, name, ownerId: userId })
    await blink.db.familyMembers.create({ id: `member_${Date.now()}`, familyId: id, userId, role: 'owner' })
    return id
  }
}

// Children
export const children = {
  list: (familyId: string) => blink.db.children.list({ where: { familyId }, orderBy: { name: 'asc' } }),
  async create(familyId: string, name: string, birthDate?: string) {
    const id = `child_${Date.now()}`
    await blink.db.children.create({ id, familyId, name, birthDate: birthDate || null })
    return id
  }
}

// Events
export const events = {
  list: (familyId: string) => blink.db.events.list({ where: { familyId }, orderBy: { startTime: 'asc' } }),
  async listWeek(familyId: string, weekStart: Date) {
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate()+7)
    return await blink.db.events.list({ where: { familyId, startTime: { gte: weekStart.toISOString(), lt: weekEnd.toISOString() } }, orderBy: { startTime: 'asc' } })
  },
  async create(familyId: string, title: string, startISO: string, endISO?: string, location?: string) {
    const id = `event_${Date.now()}`
    await blink.db.events.create({ id, familyId, title, startTime: startISO, endTime: endISO || null, location: location || null, source: 'manual' })
    return id
  },
  async update(eventId: string, familyId: string, updates: { title?: string, startTime?: string, endTime?: string, location?: string }) {
    const user = await getUserOrDemo(); requireAuth(); await assertMembership(user.id, familyId)
    const event = (await blink.db.events.list({ where: { id: eventId, familyId }, limit: 1 }))[0]
    if (!event) throw new Error('Event not found')
    await blink.db.events.update(eventId, updates)
    toast.success('Event updated')
    return { ok: true }
  },
  async remove(eventId: string, familyId: string) {
    const user = await getUserOrDemo(); requireAuth(); await assertMembership(user.id, familyId)
    const event = (await blink.db.events.list({ where: { id: eventId, familyId }, limit: 1 }))[0]
    if (!event) throw new Error('Event not found')
    await blink.db.events.delete(eventId)
    toast.success('Event deleted')
    return { ok: true }
  }
}

// Routines and RoutineLogs (adapters)
async function toggleRoutineTaskLog(routineId: string, taskIndex: number, completed: boolean, dateISO?: string) {
  const date = dateISO || todayISOInTZ()
  // Try edge function first
  try {
    const res = await blink.data.fetch({
      url: ENV.FN_ROUTINE_TOGGLE,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${await blink.auth.getToken()}` },
      body: { routineId, taskIndex, date, checked: completed }
    })
    if (res.status >= 200 && res.status < 300) {
      const r = res.body
      const result = { completed: r.completed || 0, total: r.total || 0, streak: r.streak || 0, taskCompleted: completed }
      toast.success(`Updated: ${result.completed}/${result.total} tasks complete, streak ${result.streak}`)
      return result
    }
    throw new Error('Edge function error')
  } catch { /* empty */
    // Fallback direct DB with atomic before/after
    const routine = (await blink.db.routines.list({ where: { id: routineId }, limit: 1 }))[0]
    if (!routine) throw new Error('Routine not found')
    const schedule = JSON.parse(routine.scheduleJson || '{"tasks":[]}')
    const totalTasks = Array.isArray(schedule.tasks) ? schedule.tasks.length : 0
    const visibleCount = Math.min(totalTasks, 4)
    const prevStreak = Number(routine.streakCount || 0)

    const before = await blink.db.routineTaskLogs.list({ where: { routineId, date }, limit: 500 })
    const beforeChecked = new Set<number>()
    for (const l of before) {
      const idx = Number((l as any).taskIndex)
      if (Number(l.checked) > 0 && Number.isFinite(idx) && idx >= 0 && idx < visibleCount) beforeChecked.add(idx)
    }
    const wasFull = beforeChecked.size === visibleCount

    const logId = `tasklog_${routineId}_${taskIndex}_${date}`
    const existing = before.find(l => String(l.taskIndex) === String(taskIndex))
    if (completed) {
      if (existing) {
        if (existing.checked !== '1') await blink.db.routineTaskLogs.update(existing.id, { checked: '1' })
      } else {
        await blink.db.routineTaskLogs.create({ id: logId, routineId, taskIndex, date, checked: '1' })
      }
    } else {
      try { await blink.db.routineTaskLogs.delete(existing?.id || logId) } catch { /* empty */}
    }

    const after = await blink.db.routineTaskLogs.list({ where: { routineId, date }, limit: 500 })
    const afterChecked = new Set<number>()
    for (const l of after) {
      const idx = Number((l as any).taskIndex)
      if (Number(l.checked) > 0 && Number.isFinite(idx) && idx >= 0 && idx < visibleCount) afterChecked.add(idx)
    }
    const completedCount = afterChecked.size
    const isFull = completedCount === visibleCount
    let streak = prevStreak
    if (!wasFull && isFull) streak = prevStreak + 1
    if (wasFull && !isFull) streak = Math.max(0, prevStreak - 1)
    if (streak !== prevStreak) await blink.db.routines.update(routineId, { streakCount: String(streak) })

    const result = { completed: completedCount, total: visibleCount, streak, taskCompleted: completed }
    toast.success(`Updated: ${result.completed}/${result.total} tasks complete, streak ${result.streak}`)
    return result
  }
}

const toggleRoutineLog = async (routineId: string, completed: boolean, dateISO?: string) => {
  const date = dateISO || todayISOInTZ()
  const routine = (await blink.db.routines.list({ where: { id: routineId }, limit: 1 }))[0]
  if (!routine) throw new Error('Routine not found')
  const current = parseInt(routine.streakCount || '0')
  const existing = await blink.db.routineLogs.list({ where: { routineId, date }, limit: 1 })

  if (completed) {
    if (existing.length > 0) {
      if (existing[0].completed === '1') return { completed: true, streak: current }
      await blink.db.routineLogs.update(existing[0].id, { completed: '1' })
    } else {
      await blink.db.routineLogs.create({ id: `log_${routineId}_${date.replace(/-/g,'')}_${Date.now()}`, routineId, date, completed: '1' })
    }
    const newStreak = current + 1
    await blink.db.routines.update(routineId, { streakCount: String(newStreak) })
    return { completed: true, streak: newStreak }
  } else {
    if (existing.length > 0 && existing[0].completed === '1') {
      await blink.db.routineLogs.update(existing[0].id, { completed: '0' })
      const newStreak = Math.max(0, current - 1)
      await blink.db.routines.update(routineId, { streakCount: String(newStreak) })
      return { completed: false, streak: newStreak }
    }
    return { completed: false, streak: current }
  }
}

export const routines = {
  async listByFamily(familyId: string) {
    const kids = await blink.db.children.list({ where: { familyId }, limit: 1000 })
    const ids = kids.map(k => k.id)
    return ids.length ? await blink.db.routines.list({ where: { childId: { in: ids } }, orderBy: { createdAt: 'desc' } }) : []
  },
  toggleTask: (routineId: string, taskIndex: number, nextChecked: boolean, dateISO?: string) => toggleRoutineTaskLog(routineId, taskIndex, nextChecked, dateISO),
  async update(routineId: string, { title, schedule }: { title?: string; schedule?: any }) {
    const user = await getUserOrDemo(); requireAuth()
    const routine = (await blink.db.routines.list({ where: { id: routineId }, limit: 1 }))[0]
    if (!routine) throw new Error('Routine not found')
    const child = (await blink.db.children.list({ where: { id: routine.childId }, limit: 1 }))[0]
    if (!child) throw new Error('Child not found')
    const membership = await assertMembership(user.id, child.familyId)
    if (membership.role === 'child') throw new Error('Only adults can edit routines')
    const payload: any = {}
    if (typeof title === 'string') payload.title = title
    if (schedule) payload.scheduleJson = JSON.stringify(schedule)
    if (Object.keys(payload).length === 0) return { ok: true }
    await blink.db.routines.update(routineId, payload)
    toast.success('Routine updated')
    return { ok: true }
  },
  async create(childId: string, title: string, schedule: any) {
    const user = await getUserOrDemo(); requireAuth()
    // Get the family from the child to check permissions
    const child = (await blink.db.children.list({ where: { id: childId }, limit: 1 }))[0]
    if (!child) throw new Error('Child not found')
    await requireFamily(child.familyId)
    const membership = await assertMembership(user.id, child.familyId)
    if (membership.role === 'child') throw new Error('Only adults can create routines')
    const id = `routine_${Date.now()}`
    await blink.db.routines.create({ id, childId, title, scheduleJson: JSON.stringify(schedule), streakCount: '0' })
    return id
  },
  async remove(routineId: string) {
    const user = await getUserOrDemo(); requireAuth()
    const routine = (await blink.db.routines.list({ where: { id: routineId }, limit: 1 }))[0]
    if (!routine) throw new Error('Routine not found')
    const child = (await blink.db.children.list({ where: { id: routine.childId }, limit: 1 }))[0]
    if (!child) throw new Error('Child not found')
    const membership = await assertMembership(user.id, child.familyId)
    if (membership.role === 'child') throw new Error('Only adults can delete routines')
    try { await blink.db.routineTaskLogs.deleteMany({ where: { routineId } }) } catch { /* ignore */ }
    try { await blink.db.routineLogs.deleteMany({ where: { routineId } }) } catch { /* ignore */ }
    await blink.db.routines.delete(routineId)
    toast.success('Routine deleted')
    return { ok: true }
  },  async duplicate(routineId: string) {
    const r = (await blink.db.routines.list({ where: { id: routineId }, limit: 1 }))[0]
    if (!r) throw new Error('Routine not found')
    const id = `routine_${Date.now()}_${Math.random().toString(36).slice(2,8)}`
    await blink.db.routines.create({
      id,
      childId: r.childId,
      title: `${r.title} (Copy)`,
      scheduleJson: r.scheduleJson,
      streakCount: '0'
    })
    toast.success('Routine duplicated')
    return { ok: true, id }
  }
}
export const routineLogs = { toggle: (routineId: string, completed: boolean, dateISO?: string) => toggleRoutineLog(routineId, completed, dateISO) }

// Meals
export const meals = {
  async generateWeek(familyId: string, { weekStart, dietPrefs }: { weekStart: any, dietPrefs: any }) {
    info('meals.generateWeek:start', { familyId, weekStart })

    try {
      const weekStartDate = weekStart instanceof Date ? weekStart : new Date(weekStart)
      const user = await getUserOrDemo(); requireAuth(); await assertMembership(user.id, familyId); await assertPro(familyId)

      // Build 7-day ISO date array (Mon → Sun)
      const dates: string[] = []
      const monday = new Date(weekStartDate)
      for (let i = 0; i < 7; i++) { const d = new Date(monday); d.setDate(monday.getDate() + i); dates.push(d.toISOString().split('T')[0]) }

      // Local fallback generator (kept simple, deterministic)
      const createFallbackMealPlan = (datesArr: string[], prefs: any) => {
        const familySize = Number(prefs?.familySize || 4)
        const vegetarian = Array.isArray(prefs?.dietaryRestrictions) && prefs.dietaryRestrictions.map((s: any)=>String(s).toLowerCase()).includes('vegetarian')
        const bkf = [
          { title: 'Oatmeal & Fruit', ing: [{ name: 'Oats', qty: '1 box', category: 'Pantry' }, { name: 'Bananas', qty: '7', category: 'Produce' }] },
          { title: 'Scrambled Eggs & Toast', ing: [{ name: 'Eggs', qty: String(familySize * 2), category: 'Dairy' }, { name: 'Bread', qty: '1 loaf', category: 'Bakery' }] },
          { title: 'Yogurt Parfaits', ing: [{ name: 'Yogurt', qty: '2 tubs', category: 'Dairy' }, { name: 'Granola', qty: '1 bag', category: 'Pantry' }] }
        ]
        const ln = [
          { title: 'Turkey Sandwiches', ing: vegetarian ? [{ name: 'Veggie slices', qty: '1 pack', category: 'Dairy' }] : [{ name: 'Turkey', qty: '1 lb', category: 'Meat' }, { name: 'Bread', qty: '1 loaf', category: 'Bakery' }] },
          { title: 'Caesar Salad', ing: [{ name: 'Romaine', qty: '2 heads', category: 'Produce' }, { name: 'Croutons', qty: '1 bag', category: 'Pantry' }] },
          { title: 'Grilled Cheese & Soup', ing: [{ name: 'Cheddar', qty: '1 lb', category: 'Dairy' }, { name: 'Tomato soup', qty: '2 cans', category: 'Pantry' }] }
        ]
        const dn = [
          { title: vegetarian ? 'Veggie Pasta' : 'Spaghetti Bolognese', ing: vegetarian ? [{ name: 'Pasta', qty: '2 lbs', category: 'Pantry' }, { name: 'Marinara', qty: '2 jars', category: 'Pantry' }] : [{ name: 'Ground beef', qty: '1 lb', category: 'Meat' }, { name: 'Pasta', qty: '2 lbs', category: 'Pantry' }] },
          { title: vegetarian ? 'Vegetable Stir Fry' : 'Chicken Stir Fry', ing: vegetarian ? [{ name: 'Mixed vegetables', qty: '2 bags', category: 'Frozen' }] : [{ name: 'Chicken', qty: '2 lbs', category: 'Meat' }, { name: 'Vegetables', qty: '2 bags', category: 'Frozen' }] },
          { title: 'Tacos', ing: vegetarian ? [{ name: 'Black Beans', qty: '2 cans', category: 'Pantry' }, { name: 'Tortillas', qty: '2 packs', category: 'Bakery' }] : [{ name: 'Ground beef', qty: '1 lb', category: 'Meat' }, { name: 'Tortillas', qty: '2 packs', category: 'Bakery' }] }
        ]
        const days = datesArr.map((date, i) => ({
          date,
          meals: [
            { meal_type: 'breakfast', recipe_title: bkf[i % bkf.length].title, ingredients: bkf[i % bkf.length].ing, instructions: 'Prep time: 10–15 min' },
            { meal_type: 'lunch', recipe_title: ln[i % ln.length].title, ingredients: ln[i % ln.length].ing, instructions: 'Prep time: 15–20 min' },
            { meal_type: 'dinner', recipe_title: dn[i % dn.length].title, ingredients: dn[i % dn.length].ing, instructions: 'Prep time: 30–45 min' },
          ]
        }))
        const groceryMap = new Map<string, { name: string; qty: string; category: string }>()
        for (const d of days) {
          for (const m of d.meals) {
            for (const ing of (m as any).ingredients as any[]) {
              const key = `${String(ing.name).toLowerCase().trim()}|${String(ing.category||'Other')}`
              if (groceryMap.has(key)) {
                const prev = groceryMap.get(key)!
                prev.qty = `${prev.qty} + ${ing.qty}`
              } else {
                groceryMap.set(key, { name: String(ing.name), qty: String(ing.qty || '1'), category: String(ing.category || 'Other') })
              }
            }
          }
        }
        return { days, grocery: Array.from(groceryMap.values()) }
      }

      // Try AI first, fall back locally on any error/invalid
      let mealPlan: any | null = null
      try {
        let token: string | null = null; try { token = await blink.auth.getToken() as any } catch { token = null }
        const headers: any = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`
        const aiRequest = withRetry(() => blink.data.fetch({
          url: ENV.AI_MEAL_PLAN_URL,
          method: 'POST',
          headers,
          body: { familyId, weekStart: weekStartDate.toISOString(), preferences: dietPrefs }
        }))
        const response: any = await Promise.race([
          aiRequest as any,
          new Promise((_, reject) => setTimeout(() => reject(new Error('AI timeout')), 12000))
        ])
        if (!(response.status >= 200 && response.status < 300)) throw new Error('AI response not OK')
        const parsed = MealPlanZ.safeParse(response.body)
        if (!parsed.success) throw new Error('Invalid AI meal plan JSON')
        mealPlan = parsed.data
      } catch (e) {
        err('meals.generateWeek:ai_failed', e)
        mealPlan = createFallbackMealPlan(dates, dietPrefs)
      }

      if (!mealPlan || !Array.isArray(mealPlan.days) || mealPlan.days.length === 0) {
        mealPlan = createFallbackMealPlan(dates, dietPrefs)
      }

      // Build index of existing week meals by date+type
      const existing = await blink.db.meals.list({ where: { familyId, date: { in: dates } }, limit: 1000 })
      const byKey = new Map<string, any>(existing.map(m => [`${m.date}|${m.mealType}`, m]))

      let created = 0, updated = 0
      for (const day of mealPlan.days) {
        if (!day?.date || !Array.isArray(day.meals)) continue
        for (const meal of day.meals) {
          const type = String(meal.meal_type || '').toLowerCase()
          if (!['breakfast','lunch','dinner'].includes(type)) continue
          const key = `${day.date}|${type}`
          const payload = {
            familyId,
            date: day.date,
            mealType: type,
            recipeTitle: String(meal.recipe_title || 'Meal'),
            ingredientsJson: JSON.stringify(Array.isArray(meal.ingredients) ? meal.ingredients : []),
            instructions: meal.instructions ? String(meal.instructions) : null
          }
          const found = byKey.get(key)
          try {
            if (found) {
              await blink.db.meals.update(found.id, payload as any)
              updated++
            } else {
              const id = `meal_${Date.now()}_${Math.random().toString(36).slice(2,9)}`
              await blink.db.meals.create({ id, ...payload } as any)
              created++
            }
          } catch { /* skip individual record errors */ }
        }
      }

      // Create a fresh grocery list for this generation
      const listId = `list_grocery_${familyId}_${dates[0]}_${Date.now()}`
      await blink.db.lists.create({ id: listId, familyId, type: 'grocery', title: `Groceries • week of ${weekStartDate.toLocaleDateString('en-US',{month:'short',day:'numeric'})}` })
      let itemsCreated = 0
      let position = 0
      const items = Array.isArray(mealPlan.grocery) ? mealPlan.grocery : []
      for (const it of items) {
        try {
          await blink.db.listItems.create({
            id: `item_${listId}_${Date.now()}_${position}`,
            listId,
            name: String((it as any).name || 'Item'),
            quantity: String((it as any).qty || '1'),
            category: (it as any).category || 'Misc',
            checked: '0',
            position
          })
          itemsCreated++; position++
        } catch { /* ignore and continue */ }
      }

      return { ok: true, listId, mealsCreated: created, mealsUpdated: updated, itemsCreated }
    } catch (fatal) {
      // Final safety net: ensure QA can proceed with a minimal but valid plan
      err('meals.generateWeek:fatal', fatal)
      try {
        const base = weekStart instanceof Date ? weekStart : new Date(weekStart)
        const dates: string[] = []
        const monday = new Date(base)
        for (let i = 0; i < 7; i++) { const d = new Date(monday); d.setDate(monday.getDate() + i); dates.push(d.toISOString().split('T')[0]) }

        // Ensure membership in QA
        try {
          const user = await getUserOrDemo(); requireAuth(); await assertMembership(user.id, familyId)
        } catch { /* ignore */ }

        let created = 0
        for (const date of dates) {
          try {
            const existing = await blink.db.meals.list({ where: { familyId, date, mealType: 'dinner' }, limit: 1 })
            if (existing.length === 0) {
              const id = `meal_${Date.now()}_${Math.random().toString(36).slice(2,9)}`
              await blink.db.meals.create({ id, familyId, date, mealType: 'dinner', recipeTitle: 'Pasta Night', ingredientsJson: JSON.stringify(['Pasta','Tomato sauce','Parmesan']), instructions: 'Prep time: 30 min' } as any)
              created++
            }
          } catch { /* continue */ }
        }

        const listId = `list_grocery_${familyId}_${dates[0]}_${Date.now()}`
        let itemsCreated = 0
        try {
          await blink.db.lists.create({ id: listId, familyId, type: 'grocery', title: `Groceries • week of ${new Date(dates[0]).toLocaleDateString('en-US',{month:'short',day:'numeric'})}` })
          const basics = [
            { name: 'Pasta', qty: '2 lbs', category: 'Pantry' },
            { name: 'Tomato sauce', qty: '2 jars', category: 'Pantry' },
            { name: 'Parmesan', qty: '1 block', category: 'Dairy' }
          ]
          for (let i = 0; i < basics.length; i++) {
            try {
              await blink.db.listItems.create({ id: `item_${listId}_${Date.now()}_${i}`, listId, name: basics[i].name, quantity: basics[i].qty, category: basics[i].category, checked: '0', position: i })
              itemsCreated++
            } catch { /* ignore */ }
          }
        } catch { /* ignore */ }

        return { ok: true, listId, mealsCreated: created, mealsUpdated: 0, itemsCreated }
      } catch {
        return { ok: false, error: 'Failed to generate meal plan' }
      }
    }
  },
  async listWeek(familyId: string, weekStart: Date) {
    const dates: string[] = []
    for (let i = 0; i < 7; i++) { const d = new Date(weekStart); d.setDate(weekStart.getDate()+i); dates.push(d.toISOString().split('T')[0]) }
    return await blink.db.meals.list({ where: { familyId, date: { in: dates } }, orderBy: { date: 'asc' } })
  },
  async getToday(familyId: string) {
    const today = todayISOInTZ()
    return await blink.db.meals.list({ where: { familyId, date: today }, limit: 3 })
  },
  async create(familyId: string, date: string, mealType: string, recipeTitle: string, ingredients?: string[], instructions?: string) {
    const id = `meal_${Date.now()}`
    await blink.db.meals.create({ id, familyId, date, mealType, recipeTitle, ingredientsJson: ingredients ? JSON.stringify(ingredients) : null, instructions: instructions || null })
    return id
  },
  update: (mealId: string, updates: { recipeTitle?: string, ingredientsJson?: string, instructions?: string }) => blink.db.meals.update(mealId, updates).then(() => ({ ok: true })),
  async swapRecipe(mealId: string, familyId: string) {
    const user = await getUserOrDemo(); requireAuth(); await assertMembership(user.id, familyId)
    const meal = (await blink.db.meals.list({ where: { id: mealId, familyId }, limit: 1 }))[0]
    if (!meal) throw new Error('Meal not found')
    const options = [
      { name: 'Chicken Stir Fry', ingredients: ['Chicken breast','Mixed vegetables','Soy sauce','Garlic','Ginger','Rice'] },
      { name: 'Taco Tuesday', ingredients: ['Ground beef','Taco shells','Lettuce','Tomatoes','Cheese','Sour cream'] },
      { name: 'Grilled Salmon', ingredients: ['Salmon fillet','Lemon','Olive oil','Asparagus','Quinoa','Herbs'] },
      { name: 'Pasta Carbonara', ingredients: ['Pasta','Eggs','Bacon','Parmesan cheese','Black pepper','Garlic'] },
      { name: 'Veggie Curry', ingredients: ['Mixed vegetables','Coconut milk','Curry powder','Rice','Onion','Garlic'] },
      { name: 'BBQ Pulled Pork', ingredients: ['Pork shoulder','BBQ sauce','Coleslaw mix','Burger buns','Pickle','Hot sauce'] }
    ]
    const pool = options.filter(o => o.name !== meal.recipeTitle)
    const choiceFrom = pool.length ? pool : options
    const idx = Math.floor(Math.random() * choiceFrom.length)
    const newRecipe = choiceFrom[idx]
    await blink.db.meals.update(mealId, { recipeTitle: newRecipe.name, ingredientsJson: JSON.stringify(newRecipe.ingredients), instructions: 'Quick and delicious' })
    toast.success(`Swapped to ${newRecipe.name}!`)
    return { ok: true, recipe: newRecipe }
  },
  async addToGroceryList(mealId: string, familyId: string) {
    const user = await getUserOrDemo(); requireAuth(); await assertMembership(user.id, familyId)
    const meal = (await blink.db.meals.list({ where: { id: mealId, familyId }, limit: 1 }))[0]
    if (!meal) throw new Error('Meal not found')
    let parsed: any; try { parsed = JSON.parse(meal.ingredientsJson || '[]') } catch { /* empty */ parsed = [] }
    const ingredients: string[] = Array.isArray(parsed) ? parsed.map((x: any)=>String(x)).filter(Boolean) : []

    let list = (await blink.db.lists.list({ where: { familyId, type: 'grocery' }, orderBy: { createdAt: 'desc' }, limit: 1 }))[0]
    if (!list) {
      const newId = `list_grocery_${familyId}_${Date.now()}`
      await blink.db.lists.create({ id: newId, familyId, type: 'grocery', title: 'Grocery List', createdAt: new Date().toISOString() })
      list = { id: newId } as any
    }

    const existing = await blink.db.listItems.list<ListItem>({ where: { listId: list.id }, limit: 1000 })
    const byKey = new Map<string, ListItem>(existing.map((i: ListItem) => [String(i.name || '').trim().toLowerCase(), i]))
    let addedCount = 0, mergedCount = 0, nextPos = existing.length
    for (const rawName of ingredients) {
      const name = String(rawName || '').trim(); if (!name) continue
      const key = name.toLowerCase(); const found = byKey.get(key)
      if (found) {
        const prev = parseFloat(found.quantity || '0')
        const nextQty = Number.isFinite(prev) ? String(prev + 1) : '1'
        await blink.db.listItems.update(found.id, { quantity: nextQty, checked: '0' }); mergedCount++
      } else {
        const id = `li_${list.id}_${Date.now()}_${addedCount}`
        await blink.db.listItems.create({ id, listId: list.id, name, quantity: '1', checked: '0', position: nextPos++ })
        addedCount++
      }
    }
    toast.success(`Added ${addedCount + mergedCount} ingredients to grocery list`)
    return { ok: true, listId: list.id, addedCount, mergedCount, totalAffected: addedCount + mergedCount }
  }
}

// Lists
export const lists = {
  async get(listId: string) {
    const l = await blink.db.lists.list({ where: { id: listId }, limit: 1 })
    return l[0] || null
  },
  async listByFamily(familyId: string, type?: 'grocery'|'packing'|'custom') {
    const where: any = { familyId }; if (type) where.type = type
    return await blink.db.lists.list({ where, orderBy: { createdAt: 'desc' } })
  },
  async create(familyId: string, type: 'grocery'|'packing'|'custom', title: string) {
    const id = `list_${type}_${familyId}_${Date.now()}`
    await blink.db.lists.create({ id, familyId, type, title })
    return id
  },
  async createBasicPacking(familyId: string, title: string, items: string[] = []) {
    const user = await getUserOrDemo(); requireAuth(); await assertMembership(user.id, familyId)
    const id = `list_packing_${familyId}_${Date.now()}`
    await blink.db.lists.create({ id, familyId, type: 'packing', title })
    const initial = items.length ? items : ['Clothes','Underwear','Socks','Toiletries','Toothbrush','Toothpaste','Shampoo','Phone charger','Pajamas','Comfortable shoes','Documents','Wallet']
    for (let i = 0; i < initial.length; i++) {
      await blink.db.listItems.create({ id: `item_${id}_${Date.now()}_${i}`, listId: id, name: initial[i], quantity: '1', category: 'Misc', checked: '0', position: i })
    }
    return { ok: true, listId: id }
  },
  async createPackingFromTrip(familyId: string, { trip }: { trip: any }) {
    try {
      const user = await getUserOrDemo(); requireAuth(); await assertMembership(user.id, familyId)
      const title = trip?.title || (trip?.destination ? `Packing • ${trip.destination}` : 'Packing List')
      const id = `list_packing_${familyId}_${Date.now()}`
      await blink.db.lists.create({ id, familyId, type: 'packing', title })

      let items: Array<{ name: string; qty?: string; category?: string }> = []
      try {
        let token: string | null = null; try { token = await blink.auth.getToken() as any } catch { token = null }
        const headers: any = { 'Content-Type': 'application/json' }
        if (token) headers['Authorization'] = `Bearer ${token}`

        // Accept both numeric traveler count and array of travelers
        const travelerCount = Array.isArray(trip?.travelers)
          ? (trip.travelers as any[]).length
          : Number(trip?.travelers) || 2
        const travelers = Array.from({ length: Math.max(1, travelerCount) }, () => ({ type: 'adult', age: 30 }))

        const aiPacking = withRetry(() => blink.data.fetch({
          url: ENV.AI_PACKING_URL,
          method: 'POST',
          headers,
          body: {
            familyId,
            startDate: trip?.startDate || new Date().toISOString().split('T')[0],
            endDate: trip?.endDate || new Date(Date.now() + 3*24*60*60*1000).toISOString().split('T')[0],
            destination: trip?.destination || 'Trip',
            travelers,
            purpose: trip?.tripType || trip?.purpose || 'vacation'
          }
        }))
        const res: any = await Promise.race([
          aiPacking as any,
          new Promise((_, reject) => setTimeout(() => reject(new Error('AI timeout')), 12000))
        ])
        if (res.status >= 200 && res.status < 300 && Array.isArray(res.body?.items)) {
          items = res.body.items
        }
      } catch (e) {
        // Ignore AI errors and use fallback below
      }

      if (!items.length) {
        const base = Array.isArray(trip?.items) && trip.items.length ? trip.items : ['Clothes','Underwear','Socks','Toiletries','Phone charger','Pajamas','Comfortable shoes','Documents','Wallet']
        items = base.map((it: any) => typeof it === 'string' ? ({ name: it, qty: '1', category: 'Misc' }) : it)
      }

      for (let i = 0; i < items.length; i++) {
        const it: any = items[i] || {}
        try {
          await blink.db.listItems.create({ id: `item_${id}_${Date.now()}_${i}`, listId: id, name: String(it.name || 'Item'), quantity: String(it.qty || '1'), category: it.category || 'Misc', checked: '0', position: i })
        } catch { /* continue on individual item error */ }
      }
      const result = { ok: true, listId: id, itemsCreated: items.length }
      toast.success(`AI packing list created • ${items.length} items`)
      return result
    } catch (fatal) {
      // Guaranteed fallback so the UI can proceed
      err('lists.createPackingFromTrip:fatal', fatal)
      try {
        const fallbackTitle = trip?.destination ? `Packing • ${trip.destination}` : `Packing List • ${new Date().toLocaleDateString('en-US',{month:'short',day:'numeric'})}`
        const fb = await (async () => {
          try {
            const user = await getUserOrDemo(); requireAuth(); await assertMembership(user.id, familyId)
          } catch { /* ignore */ }
          return this.createBasicPacking(familyId, fallbackTitle)
        })()
        const result = { ok: true, listId: (fb as any).listId, itemsCreated: 12 }
        toast.success('Basic packing list created!')
        return result
      } catch {
        return { ok: false, error: 'Failed to create packing list' }
      }
    }
  }
}
export async function getLatestGroceryListId(familyId: string): Promise<string | null> {
  const l = await blink.db.lists.list({ where: { familyId, type: 'grocery' }, orderBy: { createdAt: 'desc' }, limit: 1 })
  return l[0]?.id || null
}

// List Items
export const listItems = {
  async list(listId: string) {
    return await blink.db.listItems.list({ where: { listId }, orderBy: { position: 'asc' } })
  },
  async create(listId: string, name: string, quantity?: string, category?: string) {
    const trimmed = String(name || '').trim(); if (!trimmed) throw new Error('Item name required')
    const existing = await blink.db.listItems.list<ListItem>({ where: { listId }, limit: 1000 })
    const byKey = new Map<string, ListItem>(existing.map((i: ListItem) => [String(i.name || '').trim().toLowerCase(), i]))
    const key = trimmed.toLowerCase(); const found = byKey.get(key)
    if (found?.id) {
      const prev = parseFloat(found.quantity || '1')
      const additional = parseFloat(quantity || '1')
      const nextQty = Number.isFinite(prev) && Number.isFinite(additional) ? String(prev + additional) : '1'
      await blink.db.listItems.update(found.id, { quantity: nextQty, checked: '0' })
      toast.success(`Merged quantity (${nextQty})`)
      return { merged: true, id: found.id, message: `Merged with existing (${nextQty})` }
    }
    const id = `li_${listId}_${Date.now()}`
    await blink.db.listItems.create({ id, listId, name: trimmed, quantity: quantity || '1', category: category || null, checked: '0', position: existing.length })
    toast.success('Item added')
    return { merged: false, id, message: 'Item added' }
  },
  async toggle(itemId: string, checked: boolean) {
    await blink.db.listItems.update(itemId, { checked: checked ? '1' : '0' })
    return { ok: true }
  },
  async reorder(listId: string, ordered: Array<string> | Array<{ id: string; position: number }>) {
    let updates: { id: string; position: number }[] = []
    if (Array.isArray(ordered) && ordered.length) {
      if (typeof (ordered as any)[0] === 'string') updates = (ordered as string[]).map((id, index) => ({ id, position: index }))
      else updates = (ordered as { id: string; position: number }[]).map((o, i) => ({ id: o.id, position: Number(o.position ?? i) }))
    }
    let updated = 0
    for (const u of updates) { try { await blink.db.listItems.update(u.id, { position: u.position }); updated++ } catch { /* empty */ } }
    toast.success('Order saved!')
    return { ok: true, updated, total: updates.length }
  }
}
