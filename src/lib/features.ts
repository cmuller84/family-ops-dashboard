export function featuresForcePro(): boolean {
  // Default: do NOT force Pro. Enable only via env or explicit URL param.
  const TEMP_DISABLE_PRO = false
  if (TEMP_DISABLE_PRO) return true

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

// TEMPORARY: Allow QA to access Meals and Trips without auth
// This returns true for:
// - /qa routes
// - Any route with ?qaDemo=1
// - /meals, /trips, and /lists routes (temporary until demo owner account is provided)
export function qaAuthBypassEnabled(): boolean {
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