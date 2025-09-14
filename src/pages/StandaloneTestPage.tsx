import React from 'react'
import { OnboardingTour } from '@/components/OnboardingTour'
import { Calendar, UtensilsCrossed, Clock, MapPin, CheckCircle, Plus } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

// Completely standalone test page - no authentication, no family context required
export function StandaloneTestPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Include the onboarding tour */}
      <OnboardingTour />

      <div className="container mx-auto p-6 space-y-6">
        <div className="text-center space-y-4 mb-8">
          <h1 className="text-4xl font-bold">Family Ops Dashboard - Test Mode</h1>
          <p className="text-xl text-muted-foreground">Testing onboarding tour and core features</p>
          <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
            <p className="text-sm text-primary font-medium">
              🎯 The onboarding tour should auto-start in 1.5 seconds.
              If it doesn't appear, there may be an issue with the tour component.
            </p>
          </div>
        </div>

        {/* Sample Dashboard Content */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

          {/* This Week Card */}
          <Card className="md:col-span-2" data-tour="calendar">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-semibold flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-primary" />
                <span>This Week</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start space-x-4">
                  <div className="text-center min-w-[60px]">
                    <p className="text-sm font-medium">Mon</p>
                    <p className="text-xs text-muted-foreground">Sep 16</p>
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm text-foreground">Dentist appointment - 2:00 PM</p>
                    <p className="text-sm text-foreground">Soccer practice - 4:30 PM</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="text-center min-w-[60px]">
                    <p className="text-sm font-medium">Wed</p>
                    <p className="text-xs text-muted-foreground">Sep 18</p>
                  </div>
                  <div className="flex-1 space-y-1">
                    <p className="text-sm text-foreground">Parent-teacher conference - 3:00 PM</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tonight's Dinner Card */}
          <Card data-tour="meals">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center space-x-2">
                <UtensilsCrossed className="w-5 h-5 text-accent" />
                <span>Tonight's Dinner</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium mb-1">Chicken Teriyaki</h3>
                  <p className="text-sm text-muted-foreground">Quick and delicious</p>
                </div>
                <div className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full">
                    Swap Recipe
                  </Button>
                  <Button variant="ghost" size="sm" className="w-full">
                    Add to Grocery List
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Today's Routines */}
          <Card data-tour="routines">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center space-x-2">
                <Clock className="w-5 h-5 text-secondary" />
                <span>Today's Routines</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">Morning Routine</h4>
                    <span className="text-sm text-muted-foreground">Emma</span>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="line-through text-muted-foreground">Brush teeth</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="line-through text-muted-foreground">Get dressed</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <div className="w-4 h-4 border-2 border-muted rounded" />
                      <span>Make bed</span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm">
                      <div className="w-4 h-4 border-2 border-muted rounded" />
                      <span>Eat breakfast</span>
                    </div>
                  </div>
                  <div className="mt-2">
                    <div className="w-full bg-secondary rounded-full h-2">
                      <div className="bg-primary h-2 rounded-full" style={{width: '50%'}}></div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">2/4 complete • Streak: 3 days</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Grocery List */}
          <Card data-tour="groceries">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center space-x-2">
                <div className="w-5 h-5 bg-green-500 rounded flex items-center justify-center">
                  <span className="text-white text-xs">🛒</span>
                </div>
                <span>Grocery List</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex items-center space-x-2 text-sm">
                  <div className="w-4 h-4 border-2 border-muted rounded" />
                  <span>Chicken breast</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <CheckCircle className="w-4 h-4 text-green-500" />
                  <span className="line-through text-muted-foreground">Teriyaki sauce</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <div className="w-4 h-4 border-2 border-muted rounded" />
                  <span>Rice</span>
                </div>
                <div className="flex items-center space-x-2 text-sm">
                  <div className="w-4 h-4 border-2 border-muted rounded" />
                  <span>Broccoli</span>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-3">1/4 complete</p>
            </CardContent>
          </Card>

          {/* Trips Card */}
          <Card data-tour="trips">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg font-semibold flex items-center space-x-2">
                <MapPin className="w-5 h-5 text-orange-500" />
                <span>Upcoming Trip</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium">Beach Vacation</h4>
                  <p className="text-sm text-muted-foreground">San Diego, CA • Oct 15-20</p>
                </div>
                <div className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Create Packing List
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

        </div>

        {/* Test Status */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Testing Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p>✅ Standalone page loaded successfully</p>
              <p>🎯 Onboarding tour should auto-start (watch for modal)</p>
              <p>📱 All tour data-tour attributes are in place</p>
              <p>🚀 No authentication or family context required</p>
              <p className="text-muted-foreground mt-4">
                If you can see this page, the deployment is working. The tour should appear automatically.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}