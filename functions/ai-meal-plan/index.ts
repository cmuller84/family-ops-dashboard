import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "npm:@blinkdotnew/sdk";

const blink = createClient({
  projectId: "family-ops-dashboard-68kj0g31",
  authRequired: false
});

// Fallback meal plan template
function createFallbackMealPlan(dates: string[], preferences: any) {
  const familySize = preferences.familySize || 4;
  const isVegetarian = preferences.dietaryRestrictions?.includes('vegetarian');
  
  const mealTemplates = {
    breakfast: [
      { title: "Scrambled Eggs & Toast", ingredients: [{"name": "Eggs", "qty": `${familySize * 2}`, "category": "Dairy"}, {"name": "Bread", "qty": "1 loaf", "category": "Bakery"}] },
      { title: "Oatmeal with Berries", ingredients: [{"name": "Oats", "qty": "1 box", "category": "Pantry"}, {"name": "Berries", "qty": "2 cups", "category": "Produce"}] },
      { title: "Pancakes", ingredients: [{"name": "Pancake Mix", "qty": "1 box", "category": "Pantry"}, {"name": "Milk", "qty": "1 gallon", "category": "Dairy"}] }
    ],
    lunch: [
      { title: "Grilled Cheese & Soup", ingredients: [{"name": "Cheese", "qty": "1 lb", "category": "Dairy"}, {"name": "Soup", "qty": "2 cans", "category": "Pantry"}] },
      { title: "Caesar Salad", ingredients: [{"name": "Lettuce", "qty": "2 heads", "category": "Produce"}, {"name": "Croutons", "qty": "1 bag", "category": "Pantry"}] },
      { title: "Turkey Sandwiches", ingredients: isVegetarian ? [{"name": "Veggie Slices", "qty": "1 pack", "category": "Dairy"}] : [{"name": "Turkey", "qty": "1 lb", "category": "Meat"}] }
    ],
    dinner: [
      { title: isVegetarian ? "Veggie Pasta" : "Spaghetti Bolognese", ingredients: isVegetarian ? [{"name": "Pasta", "qty": "2 lbs", "category": "Pantry"}, {"name": "Marinara", "qty": "2 jars", "category": "Pantry"}] : [{"name": "Ground Beef", "qty": "1 lb", "category": "Meat"}, {"name": "Pasta", "qty": "2 lbs", "category": "Pantry"}] },
      { title: isVegetarian ? "Vegetable Stir Fry" : "Chicken Stir Fry", ingredients: isVegetarian ? [{"name": "Mixed Vegetables", "qty": "2 bags", "category": "Frozen"}] : [{"name": "Chicken", "qty": "2 lbs", "category": "Meat"}, {"name": "Vegetables", "qty": "2 bags", "category": "Frozen"}] },
      { title: "Tacos", ingredients: isVegetarian ? [{"name": "Black Beans", "qty": "2 cans", "category": "Pantry"}] : [{"name": "Ground Beef", "qty": "1 lb", "category": "Meat"}], extra: [{"name": "Tortillas", "qty": "2 packs", "category": "Bakery"}] }
    ]
  };

  const days = dates.map((date, i) => {
    const dayName = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][i] || 'Day';
    return {
      date,
      meals: [
        { meal_type: "breakfast", recipe_title: mealTemplates.breakfast[i % 3].title, ingredients: mealTemplates.breakfast[i % 3].ingredients, instructions: "Prep time: 15 min" },
        { meal_type: "lunch", recipe_title: mealTemplates.lunch[i % 3].title, ingredients: mealTemplates.lunch[i % 3].ingredients, instructions: "Prep time: 20 min" },
        { meal_type: "dinner", recipe_title: mealTemplates.dinner[i % 3].title, ingredients: [...mealTemplates.dinner[i % 3].ingredients, ...(mealTemplates.dinner[i % 3].extra || [])], instructions: "Prep time: 45 min" }
      ]
    };
  });

  // Generate grocery list from all ingredients
  const groceryMap = new Map();
  days.forEach(day => {
    day.meals.forEach(meal => {
      meal.ingredients.forEach((ing: any) => {
        const key = `${ing.name}_${ing.category}`;
        if (groceryMap.has(key)) {
          const existing = groceryMap.get(key);
          existing.qty = `${existing.qty} + ${ing.qty}`;
        } else {
          groceryMap.set(key, { ...ing });
        }
      });
    });
  });

  return {
    days,
    grocery: Array.from(groceryMap.values())
  };
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  try {
    const { familyId, weekStart, preferences, retry } = await req.json();

    if (!familyId) {
      return new Response(JSON.stringify({ error: 'familyId required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Extract auth token and set it
    const authHeader = req.headers.get('authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      blink.auth.setToken(token);
    }

    const weekStartDate = new Date(weekStart);
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStartDate);
      date.setDate(weekStartDate.getDate() + i);
      dates.push(date.toISOString().split('T')[0]);
    }

    // Build AI prompt
    const basePrompt = `Generate a 7-day meal plan for a family of ${preferences.familySize || 4}.
    
    Requirements:
    - Max cooking time: ${preferences.cookingTime || 45} minutes per meal
    - Budget: ${preferences.budget || 'medium'}
    - Dietary restrictions: ${preferences.dietaryRestrictions?.join(', ') || 'none'}
    - Avoid: ${preferences.dislikes?.join(', ') || 'none'}
    
    Return ONLY valid JSON in this exact format:
    {
      "days": [
        {
          "date": "YYYY-MM-DD",
          "meals": [
            {
              "meal_type": "breakfast",
              "recipe_title": "Scrambled Eggs with Toast",
              "ingredients": [
                {"name": "Eggs", "qty": "6", "category": "Dairy"},
                {"name": "Bread", "qty": "1 loaf", "category": "Bakery"}
              ],
              "instructions": "Prep time: 10 min"
            }
          ]
        }
      ],
      "grocery": [
        {"name": "Eggs", "qty": "12", "category": "Dairy"},
        {"name": "Bread", "qty": "2 loaves", "category": "Bakery"}
      ]
    }
    
    Categories must be: Produce, Dairy, Meat, Pantry, Frozen, Bakery, Beverages, Other
    Generate meals for dates: ${dates.join(', ')}
    Include breakfast, lunch, and dinner for each day.`;

    const systemPrompt = retry 
      ? "Return valid JSON only. No prose. Follow the exact schema provided."
      : "You are a meal planning assistant. Generate realistic, family-friendly meals.";

    // Try AI generation with fallback to template
    let mealPlan;
    try {
      // Generate meal plan using AI with shorter timeout
      const { text } = await Promise.race([
        blink.ai.generateText({
          prompt: `Create a simple 7-day meal plan JSON for ${preferences.familySize || 4} people. Return valid JSON only:
          {"days":[{"date":"${dates[0]}","meals":[{"meal_type":"breakfast","recipe_title":"Scrambled Eggs","ingredients":[{"name":"Eggs","qty":"6","category":"Dairy"}],"instructions":"Prep time: 10 min"}]}],"grocery":[{"name":"Eggs","qty":"12","category":"Dairy"}]}`,
          maxTokens: 1500
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('AI timeout')), 15000)
        )
      ]);

      // Parse the response
      try {
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        const jsonStr = jsonMatch ? jsonMatch[0] : text;
        mealPlan = JSON.parse(jsonStr);
      } catch (parseError) {
        console.log('AI parse failed, using fallback template');
        mealPlan = createFallbackMealPlan(dates, preferences);
      }
    } catch (error) {
      console.log('AI generation failed, using fallback template:', error.message);
      mealPlan = createFallbackMealPlan(dates, preferences);
    }

    // Validate response structure
    if (!mealPlan.days || !Array.isArray(mealPlan.days)) {
      console.log('Invalid structure, using fallback template');
      mealPlan = createFallbackMealPlan(dates, preferences);
    }

    console.log('Generated meal plan for family:', familyId);
    
    return new Response(JSON.stringify(mealPlan), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('AI meal plan error:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Failed to generate meal plan',
      message: error.message 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
});