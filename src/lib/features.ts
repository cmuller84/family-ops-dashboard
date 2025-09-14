export function featuresForcePro(): boolean {
  // TEMPORARY: Enable Pro features for all users during testing phase
  const TEMP_ENABLE_PRO = true
  if (TEMP_ENABLE_PRO) return true

  // Server-side env flags
  if ((globalThis as any)?.process?.env?.FEATURES_FORCE_PRO === 'true') return true;
  if ((globalThis as any)?.process?.env?.VITE_FEATURES_FORCE_PRO === 'true') return true;

  // Client-side test hooks: allow temporary bypass via URL params
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('qaPro') === '1' || params.get('pro') === '1') return true
    } catch { /* ignore */ }
  }
  return false;
}

// TEMPORARY: Allow QA to access all routes without auth during testing
// This returns true for testing purposes
export function qaAuthBypassEnabled(): boolean {
  // TEMPORARY: Always allow QA access during testing phase
  const TEMP_ALLOW_QA = true
  if (TEMP_ALLOW_QA) return true

  if (typeof window === 'undefined') return false
  try {
    const params = new URLSearchParams(window.location.search)
    const path = window.location.pathname || ''

    // Always allow the dedicated QA harness route
    if (path.startsWith('/qa')) return true

    // Explicit query param overrides
    if (params.get('qaDemo') === '1') return true
    if (params.get('qaBypass') === '1') return true
  } catch { /* ignore */ }
  return false
}