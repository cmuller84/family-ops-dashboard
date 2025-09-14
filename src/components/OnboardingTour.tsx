import React, { useState, useEffect } from 'react'
import { X, ChevronRight, ChevronLeft, Clock, UtensilsCrossed, ShoppingCart, MapPin, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'

interface TourStep {
  title: string
  description: string
  icon: React.ReactNode
  highlightSelector?: string
  position?: 'center' | 'top' | 'bottom' | 'left' | 'right'
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to Your Family Command Center!",
    description: "One dashboard to replace sticky notes, multiple apps, and morning chaos. Let's show you how it works.",
    icon: <Sparkles className="w-8 h-8 text-primary" />,
    position: 'center'
  },
  {
    title: "Morning Chaos? Solved.",
    description: "Kids check off their own morning routines. No more nagging. Watch streaks build as good habits form.",
    icon: <Clock className="w-8 h-8 text-primary" />,
    highlightSelector: '[data-tour="routines"]',
    position: 'left'
  },
  {
    title: "Dinner Stress? Gone.",
    description: "AI plans your week's meals in seconds. Swap recipes with one click. Never hear 'what's for dinner?' at 5pm again.",
    icon: <UtensilsCrossed className="w-8 h-8 text-primary" />,
    highlightSelector: '[data-tour="meals"]',
    position: 'left'
  },
  {
    title: "Grocery Trips? Optimized.",
    description: "Meal ingredients auto-add to your list. Items merge automatically. Shop once, eat all week.",
    icon: <ShoppingCart className="w-8 h-8 text-primary" />,
    highlightSelector: '[data-tour="groceries"]',
    position: 'left'
  },
  {
    title: "Packing? Automated.",
    description: "AI generates packing lists based on your destination. Never forget swim goggles or phone chargers again.",
    icon: <MapPin className="w-8 h-8 text-primary" />,
    highlightSelector: '[data-tour="trips"]',
    position: 'left'
  },
  {
    title: "Save 5+ Hours Every Week",
    description: "That's 260 hours a year. Time for what matters: being together, not coordinating logistics.",
    icon: <Sparkles className="w-8 h-8 text-primary" />,
    position: 'center'
  }
]

export function OnboardingTour() {
  const [isOpen, setIsOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [hasSeenTour, setHasSeenTour] = useState(false)

  useEffect(() => {
    // Check if user has seen the tour
    const tourSeen = localStorage.getItem('onboarding_tour_completed')
    if (!tourSeen) {
      // Delay tour start to let page load
      setTimeout(() => setIsOpen(true), 1500)
    } else {
      setHasSeenTour(true)
    }
  }, [])

  const handleNext = () => {
    if (currentStep < TOUR_STEPS.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = () => {
    localStorage.setItem('onboarding_tour_completed', 'true')
    setHasSeenTour(true)
    setIsOpen(false)
  }

  const handleSkip = () => {
    localStorage.setItem('onboarding_tour_completed', 'skipped')
    setHasSeenTour(true)
    setIsOpen(false)
  }

  if (!isOpen) return null

  const step = TOUR_STEPS[currentStep]
  const isFirstStep = currentStep === 0
  const isLastStep = currentStep === TOUR_STEPS.length - 1

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-[100] animate-in fade-in duration-300" />

      {/* Tour Card */}
      <div className="fixed inset-0 flex items-center justify-center z-[101] p-4">
        <Card className="relative max-w-md w-full bg-background border-2 border-primary/50 shadow-2xl animate-in zoom-in-95 duration-300">
          {/* Close button */}
          <button
            onClick={handleSkip}
            className="absolute right-4 top-4 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Skip tour"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="p-8 space-y-6">
            {/* Step indicator */}
            <div className="flex items-center justify-center space-x-2">
              {TOUR_STEPS.map((_, index) => (
                <div
                  key={index}
                  className={`h-2 rounded-full transition-all ${
                    index === currentStep
                      ? 'w-8 bg-primary'
                      : index < currentStep
                      ? 'w-2 bg-primary/50'
                      : 'w-2 bg-muted'
                  }`}
                />
              ))}
            </div>

            {/* Icon */}
            <div className="flex justify-center">
              {step.icon}
            </div>

            {/* Content */}
            <div className="text-center space-y-3">
              <h2 className="text-2xl font-bold">{step.title}</h2>
              <p className="text-muted-foreground leading-relaxed">
                {step.description}
              </p>
            </div>

            {/* Value props on last step */}
            {isLastStep && (
              <div className="grid grid-cols-3 gap-4 pt-4 border-t">
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">30min</div>
                  <div className="text-xs text-muted-foreground">saved daily</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">40%</div>
                  <div className="text-xs text-muted-foreground">fewer grocery trips</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">100%</div>
                  <div className="text-xs text-muted-foreground">less chaos</div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-4">
              <Button
                variant="ghost"
                onClick={handlePrev}
                disabled={isFirstStep}
                className={isFirstStep ? 'invisible' : ''}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                Back
              </Button>

              <Button
                onClick={handleNext}
                className="min-w-[100px]"
              >
                {isLastStep ? 'Get Started' : 'Next'}
                {!isLastStep && <ChevronRight className="w-4 h-4 ml-1" />}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </>
  )
}

// Export function to restart tour
export function restartTour() {
  localStorage.removeItem('onboarding_tour_completed')
  window.location.reload()
}