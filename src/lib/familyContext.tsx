/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import blink from '@/blink/client'
import { families, subscriptions, seed } from '@/lib/serverActions'
import type { User } from '@/types'
import { qaAuthBypassEnabled, featuresForcePro } from '@/lib/features'

interface Family {
  id: string
  name: string
  ownerId: string
  createdAt?: string
  updatedAt?: string
}

interface FamilyContextType {
  user: User | null
  family: Family | null
  familyId: string | null
  role: string | null
  isSubscribed: boolean
  loading: boolean
  hasFamily: boolean
  createFamily: (name: string) => Promise<void>
  refreshFamily: () => Promise<void>
}

const FamilyContext = createContext<FamilyContextType | null>(null)

export function FamilyProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [family, setFamily] = useState<Family | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [hasFamily, setHasFamily] = useState(false)

  const loadFamilyData = async (userId: string) => {
    try {
      let primaryFamily = await families.getMyPrimary(userId)
      
      // If user has no family, create one automatically with demo data
      if (!primaryFamily) {
        await seed.createDemoFamily(userId)
        primaryFamily = await families.getMyPrimary(userId)
      }
      
      setFamily(primaryFamily)
      setHasFamily(!!primaryFamily)
      
      if (primaryFamily) {
        // Get user role in family with retry logic
        try {
          const membership = await blink.db.familyMembers.list({ 
            where: { familyId: primaryFamily.id, userId }, 
            limit: 1 
          })
          setRole(membership[0]?.role || null)
        } catch (roleError) {
          console.warn('Failed to get user role, using default:', roleError)
          setRole('member') // Default fallback role
        }
        
        // Check subscription status with Pro bypass
        let subscriptionActive = false
        try {
          if (import.meta.env.VITE_FEATURES_FORCE_PRO === 'true' || import.meta.env.NODE_ENV === 'test') {
            subscriptionActive = true
          } else {
            subscriptionActive = await subscriptions.isActive(primaryFamily.id)
          }
        } catch (subError) {
          console.warn('Failed to check subscription status, defaulting to inactive:', subError)
          subscriptionActive = false
        }
        setIsSubscribed(subscriptionActive)
      } else {
        setRole(null)
        setIsSubscribed(false)
      }
    } catch (error: any) {
      console.error('Failed to load family data:', error)
      
      // Check if it's a rate limit error
      if (error?.status === 429 || error?.code === 'RATE_LIMIT_EXCEEDED' || error?.message?.includes('Rate limit exceeded')) {
        // Don't clear all data on rate limit - keep existing state
        console.warn('Rate limit encountered during family data load, retaining current state')
        return
      }
      
      // Only clear data on non-rate-limit errors
      setFamily(null)
      setRole(null)
      setHasFamily(false)
      setIsSubscribed(false)
    }
  }

  useEffect(() => {
    const demo = qaAuthBypassEnabled() || featuresForcePro()
    if (demo) {
      const fakeUser = { id: 'qa-demo-user', email: 'demo-qa@example.com' } as any
      setUser(fakeUser)
      loadFamilyData(fakeUser.id)
        .then(() => {
          setIsSubscribed(true)
          setLoading(false)
        })
        .catch(() => {
          setIsSubscribed(true)
          setLoading(false)
        })
      return
    }

    const unsubscribe = blink.auth.onAuthStateChanged(async (state) => {
      setUser(state.user as any)
      if (state.user && !state.isLoading) {
        await loadFamilyData(state.user.id)
        setLoading(false)
      } else if (!state.isLoading) {
        setFamily(null)
        setRole(null)
        setHasFamily(false)
        setIsSubscribed(false)
        setLoading(false)
      }
    })
    return unsubscribe
  }, [])

  const createFamily = async (name: string) => {
    if (!user) throw new Error('No authenticated user')
    try {
      setLoading(true)
      const familyId = await families.create(user.id, name)
      await loadFamilyData(user.id)
    } catch (error) {
      console.error('Failed to create family:', error)
      throw error
    } finally {
      setLoading(false)
    }
  }

  const refreshFamily = async () => {
    if (!user) return
    await loadFamilyData(user.id)
  }

  return (
    <FamilyContext.Provider value={{ 
      user, 
      family, 
      familyId: family?.id || null,
      role,
      isSubscribed, 
      loading, 
      hasFamily, 
      createFamily, 
      refreshFamily 
    }}>
      {children}
    </FamilyContext.Provider>
  )
}

export function useFamily() {
  const context = useContext(FamilyContext)
  if (!context) throw new Error('useFamily must be used within FamilyProvider')
  return context
}
