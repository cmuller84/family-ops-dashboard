import React from 'react'
import { OnboardingTour } from '@/components/OnboardingTour'
import { DashboardPage } from './DashboardPage'

// Direct test page that bypasses all authentication
export function TestPage() {
  return (
    <div>
      <OnboardingTour />
      <DashboardPage />
    </div>
  )
}