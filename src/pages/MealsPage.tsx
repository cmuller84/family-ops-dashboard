import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { UtensilsCrossed, Plus, Sparkles, ShoppingCart, Clock, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useFamily } from '@/lib/familyContext'
import { meals, lists, listItems, getLatestGroceryListId } from '@/lib/serverActions'
import blink from '@/blink/client'
import type { Meal } from '@/types'
import toast from '@/lib/notify'
import { featuresForcePro } from '@/lib/features'
import { checkRateLimit, incrementUsage } from '@/lib/rateLimiter'

interface MealPlan {
  meals: Array<{
    day: string
    breakfast: { title: string; prepTime: string; ingredients: string[] }
    lunch: { title: string; prepTime: string; ingredients: string[] }  
    dinner: { title: string; prepTime: string; ingredients: string[] }
  }>
  groceryList: {
    produce: string[]
    meat: string[]
    dairy: string[]
    pantry: string[]
  }
}

export function MealsPage() {
  const { family, familyId, isSubscribed, loading: familyLoading } = useFamily()
  const navigate = useNavigate()
  const [weekMeals, setWeekMeals] = useState<Meal[]>([])
  const [loading, setLoading] = useState(false)
  const [generatingPlan, setGeneratingPlan] = useState(false)
  const [showPreferences, setShowPreferences] = useState(false)
  const [groceryListId, setGroceryListId] = useState<string | null>(null)
  const [preferences, setPreferences] = useState({
    dietaryRestrictions: [],
    cookingTime: 45,
    budget: 'medium',
    familySize: 4,
    dislikes: []
  })

  const daysOfWeek = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const today = new Date()
  const weekStart = React.useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() - d.getDay() + 1)
    return d
  }, [])

  const loadWeekMeals = React.useCallback(async () => {
    if (!family) return
    
    try {
      setLoading(true)
      const mealsData = await meals.listWeek(family.id, weekStart)
      setWeekMeals(mealsData)
    } catch (error) {
      console.error('Failed to load week meals:', error)
      toast.error('Failed to load meals data')
    } finally {
      setLoading(false)
    }
  }, [family, weekStart])

  // Load grocery list ID on mount and when familyId changes
  useEffect(() => {
    if (familyId && !groceryListId) {
      getLatestGroceryListId(familyId)
        .then(setGroceryListId)
        .catch(() => {})
    }
  }, [familyId, groceryListId])

  useEffect(() => {
    if (family) {
      loadWeekMeals()
    }
  }, [loadWeekMeals, family])

  const [showPaywall, setShowPaywall] = useState(false)
  const [addingMeal, setAddingMeal] = useState<string | null>(null)
  const [showMealModal, setShowMealModal] = useState<{day: string, mealType: 'breakfast'|'lunch'|'dinner'} | null>(null)
  const [mealModalInput, setMealModalInput] = useState('')

  if (familyLoading || !familyId) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  const requireProBypass = () => featuresForcePro()

  const generateAIMealPlan = async () => {
    if (!family) {
      toast.error('No family found')
      return
    }

    // Check rate limit first
    const rateCheck = checkRateLimit()
    if (!rateCheck.allowed) {
      toast.error(rateCheck.message || 'Rate limit exceeded')
      return
    }

    // Check Pro status with bypass
    const hasProAccess = isSubscribed || requireProBypass()
    if (!hasProAccess) {
      setShowPaywall(true)
      return
    }

    setGeneratingPlan(true)
    incrementUsage() // Track usage
    try {
      console.log('Starting AI meal plan generation...')
      const result = await meals.generateWeek(family.id, { weekStart, dietPrefs: preferences })
      console.log('AI meal plan result:', result)
      
      if (result.ok) {
        // Reload meals and update state immediately
        await loadWeekMeals()
        setShowPreferences(false)
        
        const mealsCreated = Number((result as any).mealsCreated || 0)
        const mealsUpdated = Number((result as any).mealsUpdated || 0)
        const itemsCreated = Number((result as any).itemsCreated || 0)
        if (result.listId) {
          setGroceryListId(result.listId)
        }
        toast.success(`AI meal plan ready: ${mealsCreated + mealsUpdated} meals (${mealsCreated} new, ${mealsUpdated} updated) • ${itemsCreated} grocery items`)
      } else {
        console.error('Meal plan generation failed:', result)
        toast.error('Failed to generate meal plan - please try again')
      }
    } catch (error: any) {
      console.error('Failed to generate AI meal plan:', error)
      if (error?.message?.includes('Pro subscription required')) {
        setShowPaywall(true)
      } else if (error?.message?.includes('Rate limit') || error?.code === 429) {
        toast.error('AI service is busy. Please try again in a moment.')
      } else {
        toast.error(`Failed to generate meal plan: ${error.message || 'Unknown error'}`)
      }
    } finally {
      setGeneratingPlan(false)
    }
  }

  const handleAIMealPlanClick = () => {
    const hasProAccess = isSubscribed || requireProBypass()
    if (!hasProAccess) {
      setShowPaywall(true)
      return
    }
    setShowPreferences(true)
  }

  const getMealForDay = (day: string, mealType: 'breakfast'|'lunch'|'dinner') => {
    const dayIndex = daysOfWeek.indexOf(day)
    const mealDate = new Date(weekStart)
    mealDate.setDate(weekStart.getDate() + dayIndex)
    const dateStr = mealDate.toISOString().split('T')[0]
    
    return weekMeals.find(m => m.date === dateStr && m.mealType === mealType)
  }

  const addMealManually = async (day: string, mealType: 'breakfast'|'lunch'|'dinner') => {
    if (!family) return
    
    setShowMealModal({day, mealType})
    setMealModalInput('')
  }

  const submitMealModal = async () => {
    if (!family || !showMealModal || !mealModalInput.trim()) return
    
    const {day, mealType} = showMealModal
    const mealKey = `${day}-${mealType}`
    setAddingMeal(mealKey)
    
    try {
      const dayIndex = daysOfWeek.indexOf(day)
      const mealDate = new Date(weekStart)
      mealDate.setDate(weekStart.getDate() + dayIndex)
      const dateStr = mealDate.toISOString().split('T')[0]
      
      const mealId = await meals.create(family.id, dateStr, mealType, mealModalInput.trim())
      toast.success('Meal added successfully!')
      
      // Optimistic update with real ID
      const newMeal: Meal = {
        id: mealId,
        familyId: family.id,
        date: dateStr,
        mealType,
        recipeTitle: mealModalInput.trim(),
        ingredientsJson: undefined,
        instructions: undefined,
        createdAt: new Date().toISOString()
      }
      setWeekMeals(prev => [...prev, newMeal])
      
      setShowMealModal(null)
      setMealModalInput('')
      
      // Sync with server after brief delay
      setTimeout(() => {
        loadWeekMeals()
      }, 500)
    } catch (error) {
      console.error('Failed to add meal:', error)
      toast.error('Failed to add meal')
    } finally {
      setAddingMeal(null)
    }
  }

  const mealTypes = ['breakfast','lunch','dinner'] as const

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Meal Planning</h1>
          <p className="text-muted-foreground">Plan your family's meals for the week</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button 
            onClick={handleAIMealPlanClick}
            disabled={generatingPlan}
            className="flex items-center space-x-2"
          >
            {generatingPlan ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>{generatingPlan ? 'Generating...' : 'AI Meal Plan'}</span>
          </Button>
          <Button 
            variant="outline" 
            className="flex items-center space-x-2"
            onClick={() => {
              if (groceryListId) {
                navigate(`/lists/${groceryListId}`)
              } else {
                toast('Generate a meal plan first to create a grocery list')
              }
            }}
            disabled={!groceryListId}
          >
            <ShoppingCart className="w-4 h-4" />
            <span>Grocery List</span>
          </Button>
        </div>
      </div>

      {/* AI Preferences Modal */}
      {showPreferences && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span>AI Meal Plan Preferences</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Max cooking time</label>
                <select 
                  value={preferences.cookingTime}
                  onChange={(e) => setPreferences({...preferences, cookingTime: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background"
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>1 hour</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Budget</label>
                <select 
                  value={preferences.budget}
                  onChange={(e) => setPreferences({...preferences, budget: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background"
                >
                  <option value="low">Budget-friendly</option>
                  <option value="medium">Medium</option>
                  <option value="high">Premium</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Family size</label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={preferences.familySize}
                  onChange={(e) => setPreferences({...preferences, familySize: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Dietary restrictions</label>
                <input
                  type="text"
                  placeholder="e.g., vegetarian, gluten-free"
                  onChange={(e) => setPreferences({
                    ...preferences, 
                    dietaryRestrictions: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                  })}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background"
                />
              </div>
            </div>
            <div className="flex items-center justify-end space-x-3 pt-4">
              <Button 
                variant="ghost" 
                onClick={() => setShowPreferences(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={generateAIMealPlan}
                disabled={generatingPlan}
                className="flex items-center space-x-2"
              >
                <Sparkles className="w-4 h-4" />
                <span>{generatingPlan ? 'Generating...' : 'Generate Plan'}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Meal Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-4">
        {daysOfWeek.map((day) => (
          <Card key={day} className="flex flex-col">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg text-center">{day}</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              {mealTypes.map((mealType) => {
                const meal = getMealForDay(day, mealType)
                return (
                  <div key={mealType} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-medium capitalize">{mealType}</h4>
                      {!meal && (
                        <Button 
                          size="sm" 
                          variant="ghost"
                          onClick={() => addMealManually(day, mealType)}
                          disabled={!familyId || addingMeal === `${day}-${mealType}`}
                          className="h-6 w-6 p-0"
                        >
                          {addingMeal === `${day}-${mealType}` ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-b border-current" />
                          ) : (
                            <Plus className="w-3 h-3" />
                          )}
                        </Button>
                      )}
                    </div>
                    {meal ? (
                      <div className="p-3 rounded-lg bg-muted/30 space-y-2">
                        <h5 className="text-sm font-medium">{meal.recipeTitle}</h5>
                        {meal.instructions && (
                          <p className="text-xs text-muted-foreground flex items-center">
                            <Clock className="w-3 h-3 mr-1" />
                            {meal.instructions}
                          </p>
                        )}
                        {meal.ingredientsJson && (
                          <div className="text-xs text-muted-foreground">
                            {JSON.parse(meal.ingredientsJson).length} ingredients
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="p-3 rounded-lg border-2 border-dashed border-muted text-center">
                        <p className="text-xs text-muted-foreground">Not planned</p>
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <UtensilsCrossed className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{weekMeals.length}</p>
                <p className="text-sm text-muted-foreground">Meals planned</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <Clock className="w-8 h-8 text-accent" />
              <div>
                <p className="text-2xl font-bold">~{Math.round(weekMeals.length * 35)}</p>
                <p className="text-sm text-muted-foreground">Minutes saved</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <Users className="w-8 h-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{preferences.familySize}</p>
                <p className="text-sm text-muted-foreground">Family size</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Manual Meal Modal */}
      {showMealModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle>Add {showMealModal.mealType} for {showMealModal.day}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <input
                type="text"
                value={mealModalInput}
                onChange={(e) => setMealModalInput(e.target.value)}
                placeholder="Enter meal name..."
                className="w-full px-3 py-2 rounded-lg border border-input bg-background"
                onKeyPress={(e) => e.key === 'Enter' && submitMealModal()}
                autoFocus
              />
              <div className="flex items-center justify-end space-x-3">
                <Button variant="ghost" onClick={() => setShowMealModal(null)}>
                  Cancel
                </Button>
                <Button 
                  onClick={submitMealModal}
                  disabled={!mealModalInput.trim()}
                >
                  Add Meal
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Paywall Modal */}
      {showPaywall && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <Card className="w-full max-w-md mx-4">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <span>Pro Feature</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                AI meal planning requires a Pro subscription. Upgrade to unlock:
              </p>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-primary rounded-full" />
                  <span>AI-powered meal suggestions</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-primary rounded-full" />
                  <span>Automatic grocery lists</span>
                </li>
                <li className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-primary rounded-full" />
                  <span>Smart packing lists for trips</span>
                </li>
              </ul>
              <div className="flex items-center justify-end space-x-3 pt-4">
                <Button variant="ghost" onClick={() => setShowPaywall(false)}>
                  Cancel
                </Button>
                <Button onClick={() => { setShowPaywall(false); toast('Subscription management coming soon!'); }}>
                  Upgrade to Pro
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}