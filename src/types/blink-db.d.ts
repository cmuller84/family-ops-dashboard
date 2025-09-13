// src/types/blink-db.d.ts

export {}

declare global {
  interface BlinkDatabase {
    // Common table accessors (both snake_case and camelCase)

    // Users
    users: UserRow;

    // Families
    families: FamilyRow;
    familyMembers: FamilyMemberRow;
    family_members: FamilyMemberRow;

    // Children
    children: ChildRow;

    // Events
    events: EventRow;

    // Meals
    meals: MealRow;

    // Lists & Items
    lists: ListRow;
    listItems: ListItemRow;
    list_items: ListItemRow;

    // Routines & Logs
    routines: RoutineRow;
    routineLogs: RoutineLogRow;
    routine_logs: RoutineLogRow;

    // Subscriptions
    subscriptions: SubscriptionRow;
  }
}