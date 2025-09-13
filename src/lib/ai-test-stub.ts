// src/lib/ai-test-stub.ts
const SAMPLE_MEAL_PLAN = {
  days: Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(); 
    d.setDate(d.getDate() - (d.getDay() - 1) + i); // Monday-start week
    const date = d.toISOString().slice(0,10);
    return {
      date,
      meals: [
        { 
          meal_type: 'breakfast', 
          recipe_title: 'Oatmeal & Fruit',
          ingredients: [
            {name:'oats',qty:'1 lb',category:'Pantry'},
            {name:'bananas',qty:'7',category:'Produce'}
          ],
          instructions: 'Cook oats. Add sliced banana.' 
        },
        { 
          meal_type: 'dinner', 
          recipe_title: 'Sheet Pan Veg + Chicken',
          ingredients: [
            {name:'chicken thighs',qty:'2 lb',category:'Meat'},
            {name:'broccoli',qty:'2 heads',category:'Produce'}
          ],
          instructions: 'Roast at 400°F for 25–30 min.' 
        }
      ]
    };
  }),
  grocery: [
    {name:'oats',qty:'1 lb',category:'Pantry'},
    {name:'bananas',qty:'7',category:'Produce'},
    {name:'chicken thighs',qty:'2 lb',category:'Meat'},
    {name:'broccoli',qty:'2 heads',category:'Produce'}
  ]
};

const SAMPLE_PACKING = {
  items: [
    {name:'t-shirts',qty:'5 per person',category:'Clothes'},
    {name:'toothbrush',qty:'1 per person',category:'Toiletries'},
    {name:'chargers',qty:'1 set',category:'Electronics'}
  ]
};

export function aiGenerateObjectStub(kind: 'meal'|'packing') {
  return kind === 'meal' ? SAMPLE_MEAL_PLAN : SAMPLE_PACKING;
}