import React, { useState, useEffect } from 'react'
import { Crown, CreditCard, Users, Bell, Calendar, LogOut, Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useFamily } from '@/lib/familyContext'
import { subscriptions, seed, meals, lists } from '@/lib/serverActions'
import { STRIPE_PLANS, PREMIUM_FEATURES, getDaysUntilExpiration } from '@/lib/stripeUtils'
import blink from '@/blink/client'
import toast from '@/lib/notify'

interface Subscription {
  id: string
  familyId: string
  plan: string
  status: string
  trialEndsAt: string | null
  currentPeriodEnd: string | null
  createdAt: string
  updatedAt: string
}

export function SettingsPage() {
  const { user, family, isSubscribed, refreshFamily, role } = useFamily()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [loading, setLoading] = useState(true)
  const [processingCheckout, setProcessingCheckout] = useState(false)

  const loadSubscription = React.useCallback(async () => {
    if (!family) return
    
    try {
      setLoading(true)
      const sub = await subscriptions.getByFamily(family.id)
      setSubscription(sub)
    } catch (error) {
      console.error('Failed to load subscription:', error)
    } finally {
      setLoading(false)
    }
  }, [family])

  useEffect(() => {
    if (family) {
      loadSubscription()
    }
  }, [loadSubscription, family])

  const handleUpgrade = async (plan: 'monthly' | 'annual') => {
    if (!family || !user) return
    
    setProcessingCheckout(true)
    try {
      // Skip auth token for testing
      const token = 'demo-token'
      const response = await fetch('https://68kj0g31--stripe-checkout.functions.blink.new', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          plan,
          familyId: family.id,
          successUrl: `${window.location.origin}/settings?success=true`,
          cancelUrl: `${window.location.origin}/settings`
        })
      })

      if (!response.ok) {
        throw new Error('Failed to create checkout session')
      }

      const { url } = await response.json()
      // Open checkout in new tab due to iframe restrictions
      window.open(url, '_blank')
    } catch (error) {
      console.error('Failed to start checkout:', error)
    } finally {
      setProcessingCheckout(false)
    }
  }

  const handleLogout = () => {
    // Skip logout for testing
    // blink.auth.logout()
  }

  const getSubscriptionStatus = () => {
    if (!subscription) return { text: 'Free Plan', color: 'text-muted-foreground' }
    
    if (subscription.status === 'active') {
      return { text: 'Pro Plan', color: 'text-green-600' }
    }
    
    if (subscription.status === 'trialing') {
      const daysLeft = getDaysUntilExpiration(subscription.trialEndsAt)
      return { 
        text: `Trial (${daysLeft} days left)`, 
        color: 'text-blue-600' 
      }
    }
    
    return { text: subscription.status, color: 'text-muted-foreground' }
  }

  const status = getSubscriptionStatus()

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
      <div>
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">Manage your family and subscription</p>
      </div>

      {/* Success Message */}
      {window.location.search.includes('success=true') && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center space-x-3">
              <Check className="w-6 h-6 text-green-600" />
              <div>
                <h3 className="font-semibold text-green-800">Subscription Activated!</h3>
                <p className="text-green-700">Welcome to Family Ops Pro. Enjoy your premium features!</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Subscription Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Crown className="w-5 h-5" />
              <span>Subscription</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Current Plan</h3>
                <p className={`text-sm ${status.color}`}>{status.text}</p>
              </div>
              {subscription && subscription.status === 'active' && (
                <div className="text-right">
                  <p className="text-sm font-medium capitalize">{subscription.plan} Plan</p>
                  <p className="text-xs text-muted-foreground">
                    Renews {new Date(subscription.currentPeriodEnd!).toLocaleDateString()}
                  </p>
                </div>
              )}
            </div>

            {!isSubscribed && (
              <div className="space-y-4">
                <div>
                  <h4 className="font-medium mb-2">Premium Features</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {PREMIUM_FEATURES.map((feature, index) => (
                      <div key={index} className="flex items-center space-x-2 text-sm">
                        <Check className="w-4 h-4 text-green-600" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="border-2">
                    <CardHeader className="pb-4">
                      <div>
                        <h4 className="font-semibold">{STRIPE_PLANS.MONTHLY.name}</h4>
                        <p className="text-2xl font-bold">{STRIPE_PLANS.MONTHLY.price}</p>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Button 
                        onClick={() => handleUpgrade('monthly')}
                        disabled={processingCheckout}
                        className="w-full"
                      >
                        {processingCheckout ? 'Loading...' : 'Start Free Trial'}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card className="border-2 border-primary">
                    <CardHeader className="pb-4">
                      <div>
                        <div className="flex items-center space-x-2">
                          <h4 className="font-semibold">{STRIPE_PLANS.ANNUAL.name}</h4>
                          <span className="text-xs bg-primary text-primary-foreground px-2 py-1 rounded-full">
                            {STRIPE_PLANS.ANNUAL.savings}
                          </span>
                        </div>
                        <p className="text-2xl font-bold">{STRIPE_PLANS.ANNUAL.price}</p>
                        <p className="text-sm text-muted-foreground">$6.58/month</p>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Button 
                        onClick={() => handleUpgrade('annual')}
                        disabled={processingCheckout}
                        className="w-full"
                      >
                        {processingCheckout ? 'Loading...' : 'Start Free Trial'}
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  14-day free trial • Cancel anytime • No setup fees
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Account Info */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="w-5 h-5" />
                <span>Family</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="font-medium">{family?.name}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
              {role === 'owner' ? (
                <Button variant="outline" size="sm" className="w-full" disabled>
                  Manage Members (Coming Soon)
                </Button>
              ) : (
                <p className="text-xs text-muted-foreground text-center">
                  Only family owners can manage members
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="w-5 h-5" />
                <span>Notifications</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm">Email reminders</span>
                <input type="checkbox" className="rounded" defaultChecked disabled />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Daily agenda</span>
                <input type="checkbox" className="rounded" defaultChecked disabled />
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Notification settings coming soon
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="w-5 h-5" />
                <span>Integrations</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="outline" size="sm" className="w-full mb-3" disabled>
                Connect Google Calendar (Coming Soon)
              </Button>
              <Button variant="outline" size="sm" className="w-full" disabled>
                Connect Outlook (Coming Soon)
              </Button>
              <p className="text-xs text-muted-foreground text-center mt-2">
                Calendar integration is in development
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <Button 
                variant="outline" 
                onClick={handleLogout}
                className="w-full flex items-center justify-center space-x-2"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </Button>
            </CardContent>
          </Card>

          {/* Debug Panel for Owners - Hidden in production */}
          {family && role === 'owner' && import.meta.env.DEV && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Debug Panel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1 text-xs">
                  <p><strong>Family ID:</strong> {family.id}</p>
                  <p><strong>Pro Status:</strong> {isSubscribed ? 'Active' : 'Inactive'}</p>
                  <p><strong>Force Pro:</strong> {import.meta.env.VITE_FEATURES_FORCE_PRO || 'false'}</p>
                  <p><strong>Node Env:</strong> {import.meta.env.NODE_ENV || 'production'}</p>
                </div>
                <div className="space-y-2">
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full text-xs"
                    onClick={async () => {
                      try {
                        await seed.createDemoFamily(user.id)
                        toast.success('Demo data re-seeded')
                        await refreshFamily()
                      } catch (error) {
                        toast.error('Failed to re-seed demo data')
                      }
                    }}
                  >
                    Re-seed Demo Data
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full text-xs"
                    onClick={async () => {
                      try {
                        const weekMeals = await meals.listWeek(family.id, new Date())
                        console.log('Week meals:', weekMeals)
                        toast.success('Check console for meals data')
                      } catch (error) {
                        toast.error('Failed to dump meals')
                      }
                    }}
                  >
                    Dump Week Meals
                  </Button>
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="w-full text-xs"
                    onClick={async () => {
                      try {
                        const groceryLists = await lists.listByFamily(family.id, 'grocery')
                        if (groceryLists.length > 0) {
                          window.open(`/lists/${groceryLists[0].id}`, '_blank')
                        } else {
                          toast('No grocery lists found')
                        }
                      } catch (error) {
                        toast.error('Failed to open grocery list')
                      }
                    }}
                  >
                    Open Latest Grocery List
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}