import blink from '../src/blink/client'

export async function createTestFamily() {
  const me = await blink.auth.me() // stubbed when TEST_AUTH_STUB=true
  const fam = await blink.db.families.create({ 
    id: `test_family_${Date.now()}`,
    name: `Test Family ${Date.now()}`, 
    ownerId: me.id 
  })
  await blink.db.familyMembers.create({ 
    id: `test_member_${Date.now()}`,
    familyId: fam.id, 
    userId: me.id, 
    role: 'owner' 
  })
  return { familyId: fam.id, userId: me.id }
}

export async function seedRoutineForToday() {
  const { familyId } = await createTestFamily()
  const child = await blink.db.children.create({ 
    id: `test_child_${Date.now()}`,
    familyId, 
    name: 'Test Kid' 
  })
  const routine = await blink.db.routines.create({
    id: `test_routine_${Date.now()}`,
    childId: child.id, 
    title: 'Homework', 
    scheduleJson: JSON.stringify({ days:['Mon','Tue','Wed','Thu'], time:'16:00' }), 
    streakCount: '0'
  })
  return { familyId, routineId: routine.id }
}

export async function seedFamilyWeek() {
  const { familyId } = await createTestFamily()
  // Monday of current week
  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay()+6)%7))
  const weekStart = monday.toISOString().slice(0,10)
  return { familyId, weekStart }
}

export async function cleanupFamily(familyId: string) {
  try {
    // cascade delete by family_id where possible
    const lists = await blink.db.lists.list({ where: { familyId } })
    for (const list of lists) {
      try {
        await blink.db.listItems.deleteMany({ where: { listId: list.id } })
      } catch (e) {
        // Some rows may already be gone
      }
    }
    try {
      await blink.db.lists.deleteMany({ where: { familyId } })
    } catch (e) {
      // Continue cleanup
    }
    
    try {
      await blink.db.meals.deleteMany({ where: { familyId } })
    } catch (e) {
      // Continue cleanup
    }
    
    const kids = await blink.db.children.list({ where: { familyId } })
    for (const k of kids) {
      const routines = await blink.db.routines.list({ where: { childId: k.id } })
      for (const r of routines) {
        try {
          await blink.db.routineLogs.deleteMany({ where: { routineId: r.id } })
        } catch (e) {
          // Continue cleanup
        }
      }
      try {
        await blink.db.routines.deleteMany({ where: { childId: k.id } })
      } catch (e) {
        // Continue cleanup
      }
    }
    
    try {
      await blink.db.children.deleteMany({ where: { familyId } })
    } catch (e) {
      // Continue cleanup
    }
    
    try {
      await blink.db.familyMembers.deleteMany({ where: { familyId } })
    } catch (e) {
      // Continue cleanup
    }
    
    try {
      await blink.db.families.delete(familyId)
    } catch (e) {
      // Final cleanup attempt
    }
  } catch (error) {
    console.error('Cleanup failed:', error)
    // Don't throw - we want tests to continue even if cleanup fails
  }
}