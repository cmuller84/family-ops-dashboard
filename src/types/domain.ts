// src/types/domain.ts
export type ISODate = string;      // 'YYYY-MM-DD'
export type ISODateTime = string;  // ISO 8601

export type Role = 'owner' | 'adult' | 'child';
export type MealType = 'breakfast' | 'lunch' | 'dinner';

export interface UserRow { 
  id: string; 
  email: string; 
  display_name?: string | null; 
  avatar?: string | null; 
  created_at?: ISODateTime; 
  updated_at?: ISODateTime; 
}

export interface FamilyRow { 
  id: string; 
  name: string; 
  owner_user_id?: string | null; 
  created_at?: ISODateTime; 
  updated_at?: ISODateTime; 
}

export interface FamilyMemberRow { 
  id: string; 
  family_id: string; 
  user_id: string; 
  role: Role; 
  created_at?: ISODateTime; 
}

export interface ChildRow { 
  id: string; 
  family_id: string; 
  name: string; 
  birth_date?: ISODate | null; 
  created_at?: ISODateTime; 
}

export interface EventRow { 
  id: string; 
  family_id: string; 
  title: string; 
  start_time: ISODateTime; 
  end_time: ISODateTime; 
  location?: string | null; 
  source?: 'local'|'google'|null; 
  source_event_id?: string | null; 
  created_at?: ISODateTime; 
}

export interface Ingredient { 
  name: string; 
  qty: string; 
  category: 'Produce'|'Dairy'|'Meat'|'Pantry'|'Frozen'|'Bakery'|'Beverages'|'Other'; 
}

export interface MealRow { 
  id: string; 
  family_id: string; 
  date: ISODate; 
  meal_type: MealType; 
  recipe_title?: string | null; 
  ingredients_json?: Ingredient[]; 
  instructions?: string | null; 
  created_at?: ISODateTime; 
}

export interface ListRow { 
  id: string; 
  family_id: string; 
  type: 'grocery'|'packing'|'custom'; 
  title: string; 
  created_at?: ISODateTime; 
}

export interface ListItemRow { 
  id: string; 
  list_id: string; 
  name: string; 
  qty?: string | null; 
  category?: string | null; 
  checked?: boolean | null; 
  position?: number | null; 
  created_at?: ISODateTime; 
}

export interface RoutineRow { 
  id: string; 
  child_id: string; 
  title: string; 
  schedule_json: unknown; 
  streak_count?: number | null; 
  created_at?: ISODateTime; 
}

export interface RoutineLogRow { 
  id: string; 
  routine_id: string; 
  date: ISODate; 
  completed: boolean; 
  created_at?: ISODateTime; 
}

export interface SubscriptionRow { 
  id: string; 
  family_id: string; 
  plan?: 'monthly'|'annual'|null; 
  status?: 'active'|'trialing'|'past_due'|'canceled'|'incomplete'|null; 
  stripe_customer_id?: string | null; 
  stripe_sub_id?: string | null; 
  created_at?: ISODateTime; 
  updated_at?: ISODateTime; 
}