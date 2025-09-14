import React, { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import blink from './blink/client'
import { AppLayout } from './components/layout/AppLayout'
import { DashboardPage } from './pages/DashboardPage'
import { CalendarPage } from './pages/CalendarPage'
import { MealsPage } from './pages/MealsPage'
import { TripsPage } from './pages/TripsPage'
import { RoutinesPage } from './pages/RoutinesPage'
import RoutineEditPage from './pages/RoutineEditPage'
import { SettingsPage } from './pages/SettingsPage'
import { ListPage } from './pages/ListPage'
import ListsIndexPage from './pages/ListsIndexPage'
import QAHarnessPage from './pages/QAHarnessPage'
import DebugPage from './pages/DebugPage'
import { TestPage } from './pages/TestPage'
import { StandaloneTestPage } from './pages/StandaloneTestPage'
import { FamilyProvider, useFamily } from './lib/familyContext'
import type { User } from './types'
import { qaAuthBypassEnabled, featuresForcePro } from './lib/features'
// Radix Toaster disabled for this build (react-hot-toast only)
import notify from '@/lib/notify'
import { Toaster as RHTToaster, toast as rht } from 'react-hot-toast'
import { createPortal } from 'react-dom'
import { OnboardingTour } from './components/OnboardingTour'

function ToastPortal() {
  useEffect(() => {
    try { (window as any).__toastPing?.('toaster-mounted') } catch (e) { /* ignore */ }
  }, [])
  const el = typeof document !== 'undefined' ? document.getElementById('toast-root') : null
  if (!el) return null
  return createPortal(<RHTToaster position="top-center" toastOptions={{ duration: 5000 }} containerStyle={{ zIndex: 2147483647 }} />, el)
}

function AppContent() {
  const { user, loading, familyId } = useFamily()

  // DEBUG: Force bypass for testing - TEMPORARY
  const FORCE_TESTING_BYPASS = true
  if (FORCE_TESTING_BYPASS) {
    console.log('[DEBUG] Forcing testing bypass - no auth required')
  }

  // Toast diagnostics: debug param and startup smoke toast once per tab
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('toast') === '1' || params.get('testToast') === '1') {
        notify.success('Toast layer OK — notifications are visible')
        rht.success('React Hot Toast OK')
        ;(window as any).__toastPing?.('debug-toast-fired')
      }
      if (!sessionStorage.getItem('smokeToastShown')) {
        rht('Toast pipeline OK')
        sessionStorage.setItem('smokeToastShown', '1')
      }
    } catch {/* ignore */}
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Loading Family Ops...</p>
        </div>
      </div>
    )
  }

  // QA demo bypass: allow select routes without real auth (temporary)
  const isQABypass = qaAuthBypassEnabled()
  const path = typeof window !== 'undefined' ? window.location.pathname : ''
  const allowPublic = isQABypass || featuresForcePro() || path.startsWith('/qa') || path.startsWith('/meals') || path.startsWith('/trips') || path.startsWith('/lists')

  // For QA testing: also check URL params directly here as fallback
  const hasQAParam = typeof window !== 'undefined' && (
    window.location.search.includes('qaDemo=1') ||
    window.location.search.includes('qaBypass=1') ||
    window.location.search.includes('qaPro=1')
  )

  // DEBUG: Skip auth check entirely if force bypass is enabled
  if (FORCE_TESTING_BYPASS) {
    // Skip all authentication - proceed directly to app
  }
  // Require sign-in for member areas unless QA demo mode or public-allowed route
  else if (!user && !allowPublic && !hasQAParam) {
    const handleSignIn = () => {
      const redirect = window.location.href
      blink.auth.login(redirect)
    }
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-semibold mb-2">Sign in required</h1>
          <p className="text-sm text-muted-foreground mb-6">Please sign in to access your Family Ops Dashboard.</p>
          <button onClick={handleSignIn} className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition">Sign in</button>
          <div className="mt-4 text-xs text-muted-foreground">Or run the QA harness in demo mode: add <code>?qaDemo=1</code> to the /qa URL.</div>
        </div>
      </div>
    )
  }

  if (!familyId && typeof window !== 'undefined' && !FORCE_TESTING_BYPASS) {
    const bypass = qaAuthBypassEnabled() || featuresForcePro()
    const isQADemo = window.location.pathname.startsWith('/qa') || new URLSearchParams(window.location.search).get('qaDemo') === '1'
    if (!bypass && !isQADemo && !hasQAParam) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Initializing your family...</p>
          </div>
        </div>
      )
    }
  }


  return (
    <Router>
      <AppLayout>
        <OnboardingTour />
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/meals" element={<MealsPage />} />
          <Route path="/trips" element={<TripsPage />} />
          <Route path="/routines" element={<RoutinesPage />} />
          <Route path="/routines/:routineId" element={<RoutineEditPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/lists" element={<ListsIndexPage />} />
          <Route path="/lists/:listId" element={<ListPage />} />
          <Route path="/qa" element={<QAHarnessPage />} />
          <Route path="/test" element={<TestPage />} />
          <Route path="/debug" element={<DebugPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </Router>
  )
}

function App() {
  // Check if we're on the standalone test route - bypass everything
  if (typeof window !== 'undefined' && window.location.pathname === '/standalone') {
    return (
      <>
        <StandaloneTestPage />
        <ToastPortal />
      </>
    )
  }

  return (
    <FamilyProvider>
      <>
        <AppContent />
        <ToastPortal />
      </>
    </FamilyProvider>
  )
}

export default App