// Stripe configuration and utilities
export const STRIPE_PLANS = {
  MONTHLY: {
    id: 'monthly',
    name: 'Monthly Plan',
    price: '$9.99/month',
    priceId: 'price_monthly',
    amount: 999,
    interval: 'month'
  },
  ANNUAL: {
    id: 'annual',
    name: 'Annual Plan',
    price: '$79/year',
    priceId: 'price_annual',
    amount: 7900,
    interval: 'year',
    savings: '34% off'
  }
}

export const TRIAL_DAYS = 14

export const PREMIUM_FEATURES = [
  'AI meal planning',
  'Smart packing lists',
  'Unlimited family members',
  'Advanced routine tracking',
  'Email reminders',
  'Calendar sync',
  'Export capabilities'
]

export function formatPrice(amountCents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amountCents / 100)
}

export function isTrialExpired(trialEndsAt: string | null): boolean {
  if (!trialEndsAt) return true
  return new Date() > new Date(trialEndsAt)
}

export function getDaysUntilExpiration(dateStr: string | null): number {
  if (!dateStr) return 0
  const expirationDate = new Date(dateStr)
  const now = new Date()
  const diffMs = expirationDate.getTime() - now.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}
