import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Plus, Calendar, Users, Sparkles, List } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useFamily } from '@/lib/familyContext'
import { lists, events } from '@/lib/serverActions'
import type { List as ListType, Event } from '@/types'
import toast from '@/lib/notify'
import { featuresForcePro } from '@/lib/features'

export function TripsPage() {
  const { family, familyId, isSubscribed } = useFamily()
  const navigate = useNavigate()
  const [packingLists, setPackingLists] = useState<ListType[]>([])
  const [upcomingTrips, setUpcomingTrips] = useState<Event[]>([])
  const [loading, setLoading] = useState(false)
  const [creatingList, setCreatingList] = useState<string | null>(null)
  const [showTripForm, setShowTripForm] = useState(false)
  const [tripForm, setTripForm] = useState({
    destination: '',
    startDate: '',
    endDate: '',
    travelers: 2,
    tripType: 'vacation'
  })

  const loadData = React.useCallback(async () => {
    if (!family) return
    
    try {
      setLoading(true)
      
      // Load packing lists
      const packingListsData = await lists.listByFamily(family.id, 'packing')
      
      // Remove duplicates by ID and title (prevent duplicate cards)
      const seenIds = new Set<string>()
      const seenTitles = new Set<string>()
      const uniqueLists = packingListsData.filter(list => {
        const titleKey = list.title.toLowerCase().trim()
        if (seenIds.has(list.id) || seenTitles.has(titleKey)) {
          console.log('Filtered duplicate packing list:', list.title, list.id)
          return false
        }
        seenIds.add(list.id)
        seenTitles.add(titleKey)
        return true
      })
      
      setPackingLists(uniqueLists)
      
      // Load upcoming events that might be trips
      const eventsData = await events.list(family.id)
      const tripKeywords = ['trip', 'vacation', 'travel', 'flight', 'hotel', 'cruise', 'conference']
      const tripEvents = eventsData.filter(event => {
        const eventText = `${event.title} ${event.location || ''}`.toLowerCase()
        return tripKeywords.some(keyword => eventText.includes(keyword))
      })
      setUpcomingTrips(tripEvents)
    } catch (error) {
      console.error('Failed to load trips data:', error)
      toast.error('Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [family])

  useEffect(() => {
    if (family) {
      loadData()
    }
  }, [loadData, family])

  const createBasicPackingList = async () => {
    if (!family || creatingList === 'basic') return
    
    setCreatingList('basic')
    try {
      // Generate unique title by checking existing titles and adding counter if needed
      const existingLists = await lists.listByFamily(family.id, 'packing')
      const baseTitle = `Packing List • ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
      
      let title = baseTitle
      let counter = 1
      
      while (existingLists.find(list =>
        list.title.toLowerCase().trim() === title.toLowerCase().trim()
      )) {
        counter++
        title = `${baseTitle} (${counter})`
      }      
      const result = await lists.createBasicPacking(family.id, title)
      
      if (result.ok) {
        toast.success('Basic packing list created!')
        if ('listId' in result) {
          navigate(`/lists/${(result as any).listId}`)
        }
        await loadData() // Refresh the list
      } else {
        toast.error('Failed to create packing list')
      }
    } catch (error) {
      console.error('Failed to create basic packing list:', error)
      toast.error('Failed to create packing list')
    } finally {
        // Generate unique fallback title
        const existingLists = await lists.listByFamily(family.id, 'packing')
        let fallbackTitle = `Packing List • ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
        let counter = 1
        
        while (existingLists.find(list =>
          list.title.toLowerCase().trim() === fallbackTitle.toLowerCase().trim()
        )) {
          counter++
          fallbackTitle = `Packing List • ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} (${counter})`
        }
        
        const fallback = await lists.createBasicPacking(family.id, fallbackTitle)    
    // Check Pro access
    const hasProAccess = isSubscribed || featuresForcePro()
    if (!hasProAccess) {
      toast('AI packing lists require Pro subscription')
      return
    }

    // Destination optional in QA; default to generic when empty
    // Dates optional; server defaults when missing
    
    setCreatingList('ai')
    try {
      const tripData = {
        destination: tripForm.destination.trim() || 'Trip',
        startDate: tripForm.startDate || undefined,
        endDate: tripForm.endDate || undefined,
        travelers: Array.from({ length: tripForm.travelers }, (_, i) => ({ 
          name: `Traveler ${i + 1}`, 
          age: 'adult' 
        })),
        tripType: tripForm.tripType
      }
      
      const result = await lists.createPackingFromTrip(family.id, { trip: tripData })
      
      if (result.ok) {
        const count = Number((result as any).itemsCreated || 0)
        // Toast moved to serverActions.ts
        if ('listId' in result) {
          navigate(`/lists/${(result as any).listId}`)
        }
        setShowTripForm(false)
        setTripForm({
          destination: '',
          startDate: '',
          endDate: '',
          travelers: 2,
          tripType: 'vacation'
        })
      } else {
        toast.error('Failed to create AI packing list')
      }
    } catch (error) {
      console.error('Failed to create AI packing list:', error)
      try {
        // Fallback: create a basic packing list so QA can proceed
        const fallbackTitle = `Packing List • ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
        const fallback = await lists.createBasicPacking(family.id, fallbackTitle)
        if (fallback.ok) {
          toast.success('AI unavailable — created a basic packing list')
          if ('listId' in fallback) {
            navigate(`/lists/${(fallback as any).listId}`)
          }
          setShowTripForm(false)
        } else {
          if ((error as any)?.message?.includes('Pro subscription required')) {
            toast('AI packing lists require Pro subscription')
          } else {
            toast.error('Failed to create AI packing list')
          }
        }
      } catch (fallbackError) {
        console.error('Fallback packing list creation failed:', fallbackError)
        toast.error('Failed to create packing list')
      }
    } finally {
      setCreatingList(null)
    }
  }

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">Trips & Packing Lists</h1>
          <p className="text-muted-foreground">Organize your family travels and packing</p>
        </div>
        <div className="flex items-center space-x-3">
          <Button 
            onClick={createBasicPackingList}
            disabled={creatingList === 'basic'}
            variant="outline"
            className="flex items-center space-x-2"
          >
            {creatingList === 'basic' ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
            ) : (
              <List className="w-4 h-4" />
            )}
            <span>{creatingList === 'basic' ? 'Creating...' : 'Basic Packing List'}</span>
          </Button>
          <Button 
            onClick={() => setShowTripForm(true)}
            className="flex items-center space-x-2"
          >
            <Sparkles className="w-4 h-4" />
            <span>AI Packing List</span>
          </Button>
        </div>
      </div>

      {/* AI Trip Form Modal */}
      {showTripForm && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span>AI Packing List Generator</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Destination (optional)</label>
                <input
                  type="text"
                  value={tripForm.destination}
                  onChange={(e) => setTripForm({...tripForm, destination: e.target.value})}
                  placeholder="e.g., San Diego, CA"
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Trip Type</label>
                <select 
                  value={tripForm.tripType}
                  onChange={(e) => setTripForm({...tripForm, tripType: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background"
                >
                  <option value="vacation">Vacation</option>
                  <option value="business">Business</option>
                  <option value="camping">Camping</option>
                  <option value="beach">Beach</option>
                  <option value="skiing">Skiing</option>
                  <option value="city">City Break</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Start Date (optional)</label>
                <input
                  type="date"
                  value={tripForm.startDate}
                  onChange={(e) => setTripForm({...tripForm, startDate: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">End Date (optional)</label>
                <input
                  type="date"
                  value={tripForm.endDate}
                  onChange={(e) => setTripForm({...tripForm, endDate: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Number of Travelers</label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={tripForm.travelers}
                  onChange={(e) => setTripForm({...tripForm, travelers: parseInt(e.target.value)})}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background"
                />
              </div>
            </div>
            <div className="flex items-center justify-end space-x-3 pt-4">
              <Button 
                variant="ghost" 
                onClick={() => setShowTripForm(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={createAIPackingList}
                disabled={creatingList === 'ai'}
                className="flex items-center space-x-2"
              >
                {creatingList === 'ai' ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
                ) : (
                  <Sparkles className="w-4 h-4" />
                )}
                <span>{creatingList === 'ai' ? 'Creating...' : 'Generate AI Packing List'}</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Packing Lists */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Your Packing Lists</h2>
        {packingLists.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {packingLists.map((list) => (
              <Card 
                key={list.id} 
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/lists/${list.id}`)}
              >
                <CardHeader>
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <List className="w-5 h-5 text-primary" />
                    <span>{list.title}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    <p>Created {new Date(list.createdAt).toLocaleDateString()}</p>
                    <p className="capitalize">{list.type} list</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center">
              <List className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No packing lists yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first packing list to get organized for your next trip.
              </p>
              <div className="flex justify-center space-x-3">
                <Button 
                  onClick={createBasicPackingList}
                  variant="outline"
                  disabled={creatingList === 'basic'}
                >
                  {creatingList === 'basic' ? 'Creating...' : 'Basic List'}
                </Button>
                <Button onClick={() => setShowTripForm(true)}>
                  AI List
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Upcoming Trips */}
      {upcomingTrips.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Upcoming Trips</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {upcomingTrips.map((trip) => (
              <Card key={trip.id}>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center space-x-2">
                    <MapPin className="w-5 h-5 text-accent" />
                    <span>{trip.title}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center space-x-2">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                      <span>{new Date(trip.startTime).toLocaleDateString()}</span>
                    </div>
                    {trip.location && (
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-muted-foreground" />
                        <span>{trip.location}</span>
                      </div>
                    )}
                  </div>
                  <div className="pt-3">
                    <Button 
                      size="sm" 
                      className="w-full"
                      onClick={() => {
                        const tripData = {
                          destination: trip.location || trip.title,
                          startDate: trip.startTime.split('T')[0],
                          endDate: trip.endTime ? trip.endTime.split('T')[0] : trip.startTime.split('T')[0],
                          travelers: 2,
                          tripType: 'vacation'
                        }
                        setTripForm(tripData)
                        setShowTripForm(true)
                      }}
                    >
                      Create Packing List
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Quick Stats */}
      {packingLists.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-3">
                <List className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{packingLists.length}</p>
                  <p className="text-sm text-muted-foreground">Packing lists</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-3">
                <MapPin className="w-8 h-8 text-accent" />
                <div>
                  <p className="text-2xl font-bold">{upcomingTrips.length}</p>
                  <p className="text-sm text-muted-foreground">Upcoming trips</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center space-x-3">
                <Sparkles className="w-8 h-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">AI</p>
                  <p className="text-sm text-muted-foreground">Smart lists</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}