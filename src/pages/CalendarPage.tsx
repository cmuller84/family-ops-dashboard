import React, { useState, useEffect, useCallback } from 'react'
import { Plus, Calendar as CalendarIcon, MapPin, Clock, Edit2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { GlobalAddModal } from '@/components/ui/GlobalAddModal'
import { useFamily } from '@/lib/familyContext'
import { events } from '@/lib/serverActions'
import type { Event } from '@/types'
import { formatDate, formatTime, getWeekDates } from '@/lib/utils'
import toast from '@/lib/notify'

export function CalendarPage() {
  const [eventsData, setEventsData] = useState<Event[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [eventForm, setEventForm] = useState({
    title: '',
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    location: ''
  })
  const { familyId, loading: familyLoading } = useFamily()
  const weekDates = getWeekDates()

  const loadEvents = useCallback(async () => {
    if (!familyId) return

    try {
      setLoading(true)
      const eventsResult = await events.list(familyId)
      setEventsData(eventsResult)
    } catch (error) {
      console.error('Failed to load events:', error)
    } finally {
      setLoading(false)
    }
  }, [familyId])

  useEffect(() => {
    if (familyId) {
      loadEvents()
    }
  }, [familyId, loadEvents])

  const handleEventClick = (event: Event) => {
    setEditingEvent(event)
    const startDate = new Date(event.startTime)
    const endDate = event.endTime ? new Date(event.endTime) : startDate

    // Format date and time for form inputs (using local time zone)
    const formatDateForInput = (date: Date) => {
      const year = date.getFullYear()
      const month = String(date.getMonth() + 1).padStart(2, '0')
      const day = String(date.getDate()).padStart(2, '0')
      return `${year}-${month}-${day}`
    }

    const formatTimeForInput = (date: Date) => {
      const hours = String(date.getHours()).padStart(2, '0')
      const minutes = String(date.getMinutes()).padStart(2, '0')
      return `${hours}:${minutes}`
    }

    setEventForm({
      title: event.title,
      startDate: formatDateForInput(startDate),
      startTime: formatTimeForInput(startDate),
      endDate: formatDateForInput(endDate),
      endTime: formatTimeForInput(endDate),
      location: event.location || ''
    })
    setShowEditModal(true)
  }

  const handleUpdateEvent = async () => {
    if (!editingEvent || !familyId) return

    try {
      // Create local date objects and convert to ISO string properly
      const startLocal = new Date(`${eventForm.startDate}T${eventForm.startTime}:00`)
      const startDateTime = startLocal.toISOString()

      const endDateTime = eventForm.endDate && eventForm.endTime ?
        new Date(`${eventForm.endDate}T${eventForm.endTime}:00`).toISOString() : undefined

      await events.update(editingEvent.id, familyId, {
        title: eventForm.title,
        startTime: startDateTime,
        endTime: endDateTime,
        location: eventForm.location || undefined
      })

      setShowEditModal(false)
      setEditingEvent(null)
      await loadEvents()
    } catch (error) {
      console.error('Failed to update event:', error)
      toast.error('Failed to update event')
    }
  }

  const handleDeleteEvent = async () => {
    if (!editingEvent || !familyId) return

    try {
      await events.remove(editingEvent.id, familyId)
      setShowEditModal(false)
      setEditingEvent(null)
      await loadEvents()
    } catch (error) {
      console.error('Failed to delete event:', error)
      toast.error('Failed to delete event')
    }
  }

  if (familyLoading || !familyId) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  const todaysEvents = eventsData.filter(event => {
    const eventDate = new Date(event.startTime)
    const today = new Date()
    return eventDate.toDateString() === today.toDateString()
  })

  const upcomingEvents = eventsData.filter(event => {
    const eventDate = new Date(event.startTime)
    const today = new Date()
    return eventDate > today
  }).slice(0, 5)

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
          <h1 className="text-3xl font-bold mb-2">Calendar</h1>
          <p className="text-muted-foreground">Manage your family's schedule and events</p>
        </div>
        <Button className="flex items-center space-x-2" onClick={() => setShowAddModal(true)}>
          <Plus className="w-4 h-4" />
          <span>Add Event</span>
        </Button>
      </div>

      {/* Week View */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CalendarIcon className="w-5 h-5 text-primary" />
            <span>This Week</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-4">
            {weekDates.map((date, index) => {
              const dayEvents = eventsData.filter(event => {
                const eventDate = new Date(event.startTime)
                return eventDate.toDateString() === date.toDateString()
              })

              const isToday = date.toDateString() === new Date().toDateString()

              return (
                <div
                  key={index}
                  className={`p-3 rounded-lg border-2 transition-colors cursor-pointer relative ${
                    isToday ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    setSelectedDate(date)
                    setShowAddModal(true)
                  }}
                  style={{ pointerEvents: 'auto' }}
                >
                  <div className="text-center mb-2">
                    <p className="text-xs font-medium text-muted-foreground">
                      {date.toLocaleDateString('en-US', { weekday: 'short' })}
                    </p>
                    <p className={`text-lg font-semibold ${
                      isToday ? 'text-primary' : 'text-foreground'
                    }`}>
                      {date.getDate()}
                    </p>
                  </div>
                  <div className="space-y-1">
                    {dayEvents.slice(0, 2).map((event, eventIndex) => (
                      <div
                        key={eventIndex}
                        className="text-xs p-1.5 bg-accent/20 text-accent-foreground rounded truncate cursor-pointer hover:bg-accent/30 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleEventClick(event)
                        }}
                      >
                        {new Date(event.startTime).toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                          hour12: true
                        })} {event.title}
                      </div>
                    ))}
                    {dayEvents.length > 2 && (
                      <div className="text-xs text-muted-foreground text-center">
                        +{dayEvents.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Today's Events */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-accent" />
              <span>Today's Events</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todaysEvents.length > 0 ? (
              <div className="space-y-3">
                {todaysEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start space-x-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => handleEventClick(event)}
                  >
                    <div className="text-center min-w-[60px]">
                      <p className="text-sm font-medium">
                        {formatTime(new Date(event.startTime))}
                      </p>
                      {event.endTime && (
                        <p className="text-xs text-muted-foreground">
                          {formatTime(new Date(event.endTime))}
                        </p>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{event.title}</p>
                      {event.location && (
                        <p className="text-sm text-muted-foreground flex items-center space-x-1">
                          <MapPin className="w-3 h-3" />
                          <span>{event.location}</span>
                        </p>
                      )}
                    </div>
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0">
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CalendarIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No events today</p>
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setShowAddModal(true)}>
                  Add your first event
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upcoming Events */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CalendarIcon className="w-5 h-5 text-primary" />
              <span>Upcoming</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {upcomingEvents.length > 0 ? (
              <div className="space-y-3">
                {upcomingEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-start space-x-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => handleEventClick(event)}
                  >
                    <div className="text-center min-w-[60px]">
                      <p className="text-xs text-muted-foreground">
                        {new Date(event.startTime).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </p>
                      <p className="text-sm font-medium">
                        {formatTime(new Date(event.startTime))}
                      </p>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{event.title}</p>
                      {event.location && (
                        <p className="text-sm text-muted-foreground flex items-center space-x-1">
                          <MapPin className="w-3 h-3" />
                          <span>{event.location}</span>
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CalendarIcon className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="text-muted-foreground">No upcoming events</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <GlobalAddModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        defaultTab="event"
        defaultDate={selectedDate}
        onSuccess={() => {
          setShowAddModal(false)
          loadEvents()
        }}
      />

      {/* Edit Event Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowEditModal(false)}>
          <div className="bg-background p-6 rounded-lg w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Edit Event</h2>
              <Button variant="ghost" size="sm" onClick={() => setShowEditModal(false)}>×</Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Event Title</label>
                <input
                  type="text"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({...eventForm, title: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background"
                  placeholder="Event title"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Start Date</label>
                  <input
                    type="date"
                    value={eventForm.startDate}
                    onChange={(e) => setEventForm({...eventForm, startDate: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Start Time</label>
                  <input
                    type="time"
                    value={eventForm.startTime}
                    onChange={(e) => setEventForm({...eventForm, startTime: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">End Date (optional)</label>
                  <input
                    type="date"
                    value={eventForm.endDate}
                    onChange={(e) => setEventForm({...eventForm, endDate: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">End Time (optional)</label>
                  <input
                    type="time"
                    value={eventForm.endTime}
                    onChange={(e) => setEventForm({...eventForm, endTime: e.target.value})}
                    className="w-full px-3 py-2 rounded-lg border border-input bg-background"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Location (optional)</label>
                <input
                  type="text"
                  value={eventForm.location}
                  onChange={(e) => setEventForm({...eventForm, location: e.target.value})}
                  className="w-full px-3 py-2 rounded-lg border border-input bg-background"
                  placeholder="Event location"
                />
              </div>
            </div>

            <div className="flex items-center justify-between mt-6">
              <Button
                variant="destructive"
                onClick={handleDeleteEvent}
                className="flex items-center space-x-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Event</span>
              </Button>
              <div className="flex items-center space-x-3">
                <Button variant="ghost" onClick={() => setShowEditModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleUpdateEvent}>
                  Update Event
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}