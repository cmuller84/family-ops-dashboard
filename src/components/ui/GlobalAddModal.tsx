import React, { useState } from 'react'
import { Plus, Calendar, User, List, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useFamily } from '@/lib/familyContext'
import { events, children, lists } from '@/lib/serverActions'
import toast from '@/lib/notify'

interface GlobalAddModalProps {
  open: boolean
  onClose: () => void
  defaultTab?: 'event' | 'child' | 'list'
  defaultDate?: Date
  onSuccess?: () => void
}

export function GlobalAddModal({ 
  open, 
  onClose, 
  defaultTab = 'event',
  defaultDate,
  onSuccess 
}: GlobalAddModalProps) {
  const { familyId } = useFamily()
  const [activeTab, setActiveTab] = useState(defaultTab)
  const [pending, setPending] = useState(false)
  
  // Event form state
  const [eventForm, setEventForm] = useState({
    title: '',
    date: defaultDate ? defaultDate.toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '10:00',
    location: ''
  })
  
  // Child form state
  const [childForm, setChildForm] = useState({
    name: '',
    birthDate: ''
  })
  
  // List form state  
  const [listForm, setListForm] = useState<{ type: 'grocery' | 'packing' | 'custom'; title: string }>({
    type: 'grocery',
    title: ''
  })

  const handleEventSubmit = async () => {
    if (!familyId || !eventForm.title) return
    
    setPending(true)
    try {
      const startDateTime = new Date(`${eventForm.date}T${eventForm.startTime}:00`)
      const endDateTime = new Date(`${eventForm.date}T${eventForm.endTime}:00`)
      
      if (endDateTime <= startDateTime) {
        toast.error('End time must be after start time')
        return
      }
      
      await events.create(
        familyId,
        eventForm.title,
        startDateTime.toISOString(),
        endDateTime.toISOString(),
        eventForm.location || undefined
      )
      
      toast.success('Event created successfully!')
      setEventForm({
        title: '',
        date: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '10:00',
        location: ''
      })
      onSuccess?.()
      onClose()
    } catch (error) {
      toast.error('Failed to create event')
      console.error('Event creation error:', error)
    } finally {
      setPending(false)
    }
  }

  const handleChildSubmit = async () => {
    if (!familyId || !childForm.name) return
    
    setPending(true)
    try {
      await children.create(familyId, childForm.name, childForm.birthDate || undefined)
      toast.success('Child added successfully!')
      setChildForm({ name: '', birthDate: '' })
      onSuccess?.()
      onClose()
    } catch (error) {
      toast.error('Failed to add child')
      console.error('Child creation error:', error)
    } finally {
      setPending(false)
    }
  }

  const handleListSubmit = async () => {
    if (!familyId || !listForm.title) return
    
    setPending(true)
    try {
      await lists.create(familyId, listForm.type, listForm.title)
      toast.success('List created successfully!')
      setListForm({ type: 'grocery', title: '' })
      onSuccess?.()
      onClose()
    } catch (error) {
      toast.error('Failed to create list')
      console.error('List creation error:', error)
    } finally {
      setPending(false)
    }
  }

  const handleClose = () => {
    if (!pending) {
      onClose()
      // Reset forms
      setEventForm({
        title: '',
        date: new Date().toISOString().split('T')[0],
        startTime: '09:00',
        endTime: '10:00',
        location: ''
      })
      setChildForm({ name: '', birthDate: '' })
      setListForm({ type: 'grocery', title: '' })
    }
  }

  if (!familyId) return null

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Plus className="w-5 h-5 text-primary" />
            <span>Quick Add</span>
          </DialogTitle>
        </DialogHeader>
        
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as any)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="event" className="flex items-center space-x-1">
              <Calendar className="w-4 h-4" />
              <span>Event</span>
            </TabsTrigger>
            <TabsTrigger value="child" className="flex items-center space-x-1">
              <User className="w-4 h-4" />
              <span>Child</span>
            </TabsTrigger>
            <TabsTrigger value="list" className="flex items-center space-x-1">
              <List className="w-4 h-4" />
              <span>List</span>
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="event" className="space-y-4">
            <div className="space-y-3">
              <div>
                <Label htmlFor="event-title">Event Title</Label>
                <Input
                  id="event-title"
                  value={eventForm.title}
                  onChange={(e) => setEventForm({...eventForm, title: e.target.value})}
                  placeholder="e.g., Soccer practice"
                />
              </div>
              
              <div>
                <Label htmlFor="event-date">Date</Label>
                <Input
                  id="event-date"
                  type="date"
                  value={eventForm.date}
                  onChange={(e) => setEventForm({...eventForm, date: e.target.value})}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="start-time">Start Time</Label>
                  <Input
                    id="start-time"
                    type="time"
                    value={eventForm.startTime}
                    onChange={(e) => setEventForm({...eventForm, startTime: e.target.value})}
                  />
                </div>
                <div>
                  <Label htmlFor="end-time">End Time</Label>
                  <Input
                    id="end-time"
                    type="time"
                    value={eventForm.endTime}
                    onChange={(e) => setEventForm({...eventForm, endTime: e.target.value})}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="event-location">Location (Optional)</Label>
                <Input
                  id="event-location"
                  value={eventForm.location}
                  onChange={(e) => setEventForm({...eventForm, location: e.target.value})}
                  placeholder="e.g., Community Center"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button variant="ghost" onClick={handleClose} disabled={pending}>
                Cancel
              </Button>
              <Button 
                onClick={handleEventSubmit}
                disabled={!eventForm.title || pending}
              >
                {pending ? 'Creating...' : 'Create Event'}
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="child" className="space-y-4">
            <div className="space-y-3">
              <div>
                <Label htmlFor="child-name">Child's Name</Label>
                <Input
                  id="child-name"
                  value={childForm.name}
                  onChange={(e) => setChildForm({...childForm, name: e.target.value})}
                  placeholder="e.g., Alex"
                />
              </div>
              
              <div>
                <Label htmlFor="child-birthdate">Birth Date (Optional)</Label>
                <Input
                  id="child-birthdate"
                  type="date"
                  value={childForm.birthDate}
                  onChange={(e) => setChildForm({...childForm, birthDate: e.target.value})}
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button variant="ghost" onClick={handleClose} disabled={pending}>
                Cancel
              </Button>
              <Button 
                onClick={handleChildSubmit}
                disabled={!childForm.name || pending}
              >
                {pending ? 'Adding...' : 'Add Child'}
              </Button>
            </div>
          </TabsContent>
          
          <TabsContent value="list" className="space-y-4">
            <div className="space-y-3">
              <div>
                <Label htmlFor="list-type">List Type</Label>
                <Select 
                  value={listForm.type} 
                  onValueChange={(value) => setListForm({...listForm, type: value as 'grocery' | 'packing' | 'custom'})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="grocery">Grocery List</SelectItem>
                    <SelectItem value="packing">Packing List</SelectItem>
                    <SelectItem value="custom">Custom List</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label htmlFor="list-title">List Title</Label>
                <Input
                  id="list-title"
                  value={listForm.title}
                  onChange={(e) => setListForm({...listForm, title: e.target.value})}
                  placeholder="e.g., Weekly Groceries"
                />
              </div>
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button variant="ghost" onClick={handleClose} disabled={pending}>
                Cancel
              </Button>
              <Button 
                onClick={handleListSubmit}
                disabled={!listForm.title || pending}
              >
                {pending ? 'Creating...' : 'Create List'}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}