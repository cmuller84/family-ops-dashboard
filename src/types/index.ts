export interface User {
  id: string
  email: string
  displayName?: string
  avatar?: string
}

export interface Family {
  id: string
  name: string
  ownerId: string
  createdAt: string
  updatedAt: string
}

export interface FamilyMember {
  id: string
  familyId: string
  userId: string
  role: 'owner' | 'adult' | 'child'
  createdAt: string
}

export interface Child {
  id: string
  familyId: string
  name: string
  birthDate?: string
  createdAt: string
}

export interface Event {
  id: string
  familyId: string
  title: string
  startTime: string
  endTime?: string
  location?: string
  source: string
  sourceEventId?: string
  createdAt: string
}

export interface Meal {
  id: string
  familyId: string
  date: string
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack'
  recipeTitle: string
  ingredientsJson?: string
  instructions?: string
  createdAt: string
}

export interface List {
  id: string
  familyId: string
  type: 'grocery' | 'packing' | 'custom'
  title: string
  createdAt: string
  updatedAt: string
}

export interface ListItem {
  id: string
  listId: string
  name: string
  quantity: string
  category?: string
  checked: string
  position?: number
  createdAt: string
}

export interface Routine {
  id: string
  childId: string
  title: string
  scheduleJson: string
  streakCount: string
  createdAt: string
}

export interface RoutineLog {
  id: string
  routineId: string
  date: string
  completed: string
  createdAt: string
}

export interface Subscription {
  id: string
  familyId: string
  plan: 'free' | 'monthly' | 'annual'
  status: 'active' | 'trialing' | 'past_due' | 'canceled' | 'incomplete'
  stripeCustomerId?: string
  stripeSubscriptionId?: string
  trialEndsAt?: string
  currentPeriodEnd?: string
  createdAt: string
  updatedAt: string
}
