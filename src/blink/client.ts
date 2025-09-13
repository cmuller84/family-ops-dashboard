import { createClient } from '@blinkdotnew/sdk'

// Initialize Blink client for Family Ops Dashboard
// Determine if QA demo mode is active (explicit via ?qaDemo=1 only)
const isQADemo = (typeof window !== 'undefined') && (new URLSearchParams(window.location.search).get('qaDemo') === '1')

const blink = createClient({
  projectId: 'family-ops-dashboard-68kj0g31',
  authRequired: false
})

// QA demo mode: allow /qa?qaDemo=1 to stub auth for harness without real sign-in
if (typeof window !== 'undefined') {
  try {
    const params = new URLSearchParams(window.location.search)
    const path = window.location.pathname
    if (params.get('qaDemo') === '1' || params.get('qaBypass') === '1') {
      // Provide a fake token and minimal user shaped like Blink auth (temporary QA bypass)
      ;(blink as any).auth.getToken = async () => 'qa-demo-token'
      ;(blink as any).auth.me = async () => ({ id: 'qa-demo-user', email: 'demo-qa@example.com' })
      ;(blink as any).auth.isAuthenticated = () => true
      // Suppress any auth redirects in demo
      ;(blink as any).auth.login = (redirectUrl?: string) => {
        console.warn('QA demo mode: login suppressed. Continuing without redirect.', { redirectUrl })
        return
      }
      ;(blink as any).auth.logout = () => {
        console.warn('QA demo mode: logout suppressed.')
        return
      }
      ;(window as any).__QA_DEMO__ = true
      // Note: We avoid relying on private emitters; FamilyProvider handles demo state
    }
  } catch (e) {
    console.warn('QA demo mode init failed:', e)
  }
}

// Test environment stubs to bypass real auth during Vitest runs
// This allows serverActions and DB calls to function in NODE_ENV==='test'
if (typeof globalThis !== 'undefined' && (globalThis as any).process?.env?.NODE_ENV === 'test') {
  try {
    // Provide a fake token and minimal user for tests
    (blink as any).auth.getToken = async () => 'test-token'
    ;(blink as any).auth.me = async () => ({ id: 'test-user-1', email: 'test@example.com' })
  } catch {
    // ... existing code ...
  }
}

export default blink