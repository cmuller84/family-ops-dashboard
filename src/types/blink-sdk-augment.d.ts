// Augment '@blinkdotnew/sdk' to include our typed BlinkDatabase interface
import './domain.d.ts'

declare module '@blinkdotnew/sdk' {
  interface BlinkDatabase {
    [table: string]: any;

    users?: UserRow;
    families?: FamilyRow;
    familyMembers?: FamilyMemberRow;
    family_members?: FamilyMemberRow;
    children?: ChildRow;
    events?: EventRow;
    meals?: MealRow;
    lists?: ListRow;
    listItems?: ListItemRow;
    list_items?: ListItemRow;
    routines?: RoutineRow;
    routineLogs?: RoutineLogRow;
    routine_logs?: RoutineLogRow;
    subscriptions?: SubscriptionRow;
  }
}

export {}