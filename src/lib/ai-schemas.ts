import { z } from 'zod';

export const IngredientZ = z.object({
  name: z.string().min(1),
  qty: z.string().min(1),
  category: z.enum(['Produce','Dairy','Meat','Pantry','Frozen','Bakery','Beverages','Other'])
});

export const MealZ = z.object({
  meal_type: z.enum(['breakfast','lunch','dinner']),
  recipe_title: z.string().min(1),
  ingredients: z.array(IngredientZ).nonempty(),
  instructions: z.string().min(1)
});

export const DayPlanZ = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meals: z.array(MealZ).nonempty()
});

export const MealPlanZ = z.object({
  days: z.array(DayPlanZ).nonempty(),
  grocery: z.array(IngredientZ).nonempty()
});

export const PackingItemZ = z.object({
  name: z.string().min(1),
  qty: z.string().min(1),
  category: z.enum(['Clothes','Toiletries','Health','Electronics','Documents','Misc'])
});

export const PackingListZ = z.object({
  items: z.array(PackingItemZ).nonempty()
});