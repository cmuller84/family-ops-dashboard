// tests/setup.ts
process.env.NODE_ENV = 'test'
process.env.FEATURES_FORCE_PRO = 'true'
process.env.VITE_FEATURES_FORCE_PRO = 'true'
process.env.APP_TIMEZONE = 'America/New_York'

// Only stub auth when explicitly enabled
const SHOULD_STUB = process.env.TEST_AUTH_STUB === 'true'

if (SHOULD_STUB) {
  const TEST_USER_ID = 'test-user-1'
  const TEST_USER_EMAIL = 'test@example.com'

  // Import blink and patch it directly
  import('../src/blink/client').then((blinkModule) => {
    const blink = blinkModule.default
    
    // Patch auth methods used by serverActions in tests
    if (blink?.auth) {
      // @ts-expect-error: dynamic patching for tests only
      blink.auth.me = async () => ({ id: TEST_USER_ID, email: TEST_USER_EMAIL })
      // @ts-expect-error: dynamic patching for tests only  
      blink.auth.getToken = async () => 'test-token'
    }
  })

  // No DB upsert for a users table (doesn't exist in your schema)
}