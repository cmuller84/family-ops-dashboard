import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Check, X, Edit3, Trash2, GripVertical } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useFamily } from '@/lib/familyContext'
import { lists, listItems } from '@/lib/serverActions'
import type { List, ListItem } from '@/types'
import toast from '@/lib/notify'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core'
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

function SortableListItem({ item, onToggle }: { item: ListItem; onToggle: (itemId: string, checked: boolean) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className="flex items-center space-x-3 p-3 rounded-lg hover:bg-muted/50 transition-colors group"
    >
      <div 
        className="cursor-grab active:cursor-grabbing p-2 rounded hover:bg-muted/60"
        aria-label="Drag to reorder"
        title="Drag to reorder"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-5 h-5 text-muted-foreground" />
      </div>
      <label className="flex items-center cursor-pointer p-2 rounded transition-colors hover:bg-muted/30 min-h-[44px] min-w-[44px] justify-center">
        <input
          type="checkbox"
          checked={Number(item.checked) > 0}
          onChange={(e) => onToggle(item.id, e.target.checked)}
          className="w-5 h-5 text-primary border-2 rounded focus:ring-primary cursor-pointer disabled:opacity-50"
        />
      </label>
      <div className="flex-1">
        <p className={`text-sm font-medium ${
          Number(item.checked) > 0 ? 'line-through text-muted-foreground' : 'text-foreground'
        }`}>
          {item.name}
        </p>
        {item.category && (
          <p className="text-xs text-muted-foreground capitalize">{item.category}</p>
        )}
      </div>
      <div className="flex items-center space-x-2">
        <span className="text-sm text-muted-foreground">{item.quantity}</span>
        {Number(item.checked) > 0 && (
          <Check className="w-4 h-4 text-green-600" />
        )}
      </div>
    </div>
  )
}

export function ListPage() {
  const { listId } = useParams<{ listId: string }>()
  const navigate = useNavigate()
  const { familyId } = useFamily()
  const [list, setList] = useState<List | null>(null)
  const [items, setItems] = useState<ListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [newItemName, setNewItemName] = useState('')
  const [addingItem, setAddingItem] = useState(false)

  const loadListData = React.useCallback(async () => {
    if (!listId) return
    
    try {
      setLoading(true)
      const [listData, itemsData] = await Promise.all([
        lists.get(listId),
        listItems.list(listId)
      ])
      
      setList(listData)
      setItems(itemsData)
    } catch (error) {
      console.error('Failed to load list data:', error)
      toast.error('Failed to load list')
    } finally {
      setLoading(false)
    }
  }, [listId])

  useEffect(() => {
    if (listId) {
      loadListData()
    }
  }, [loadListData, listId])

  const [togglingItems, setTogglingItems] = useState<Set<string>>(new Set())

  const toggleItem = async (itemId: string, checked: boolean) => {
    if (togglingItems.has(itemId)) return
    
    const newTogglingItems = new Set(togglingItems)
    newTogglingItems.add(itemId)
    setTogglingItems(newTogglingItems)
    
    try {
      // Optimistic update
      setItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, checked: checked ? '1' : '0' } : item
      ))
      
      await listItems.toggle(itemId, checked)
      // Force progress recalculation by triggering a state update
      setItems(prev => [...prev])
      // Don't show success toast for item toggle - it's obvious from UI
    } catch (error) {
      console.error('Failed to toggle item:', error)
      toast.error('Failed to update item')
      // Revert optimistic update
      setItems(prev => prev.map(item => 
        item.id === itemId ? { ...item, checked: checked ? '0' : '1' } : item
      ))
    } finally {
      const updatedTogglingItems = new Set(togglingItems)
      updatedTogglingItems.delete(itemId)
      setTogglingItems(updatedTogglingItems)
    }
  }

  const addItem = async () => {
    if (!newItemName.trim() || !listId) return
    
    setAddingItem(true)
    try {
      const result = await listItems.create(listId, newItemName.trim())
      const itemName = newItemName.trim()
      setNewItemName('')
      
      console.log('Add item result:', result)
      
      if (result.merged) {
        // Item was merged with existing - reload to get updated quantities
        toast.success('Merged quantity')
        await loadListData()
      } else {
        // New item was created - add to current state optimistically
        const newItem = {
          id: result.id,
          listId,
          name: itemName,
          quantity: '1',
          category: null,
          checked: '0',
          createdAt: new Date().toISOString(),
          position: items.length
        }
        console.log('Adding new item to UI:', newItem)
        setItems(prev => [...prev, newItem])
        toast.success('Item added')
      }
    } catch (error) {
      console.error('Failed to add item:', error)
      toast.error(error?.message || 'Failed to add item')
    } finally {
      setAddingItem(false)
    }
  }

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  const [reordering, setReordering] = useState(false)

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event

    if (active.id !== over?.id && !reordering && over) {
      const oldIndex = items.findIndex((item) => item.id === active.id)
      const newIndex = items.findIndex((item) => item.id === over.id)
      
      if (oldIndex !== -1 && newIndex !== -1) {
        const newItems = arrayMove(items, oldIndex, newIndex)
        const originalItems = [...items]
        
        // Optimistic update
        setItems(newItems)
        setReordering(true)
        
        try {
          console.log('Reordering items:', newItems.length, 'positions')
          
          // Send reorder request with position updates
          const reorderData = newItems.map((item, index) => ({
            id: item.id,
            position: index
          }))
          
          console.log('Sending reorder data:', reorderData)
          
          const result = await listItems.reorder(listId!, reorderData)
          
          if (result.ok) {
            toast.success('Order saved!')
            console.log(`Successfully reordered ${result.updated}/${result.total} items`)
            
            // Update local state with correct positions to ensure persistence
            setItems(prev => prev.map((item, index) => ({
              ...item,
              position: index
            })))
            
            // Re-fetch from server to ensure order persists across refresh
            await loadListData()
          } else {
            throw new Error('Failed to save item order')
          }
        } catch (error) {
          console.error('Failed to reorder items:', error)
          toast.error('Failed to save order')
          // Revert optimistic update
          setItems(originalItems)
        } finally {
          setReordering(false)
        }
      }
    }
  }

  const getProgress = () => {
    const completed = items.filter(item => Number(item.checked) > 0).length
    const total = items.length
    return { completed, total, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!list) {
    return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
        <h2 className="text-xl font-semibold">List not found</h2>
        <Button onClick={() => navigate(-1)} variant="outline">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Go Back
        </Button>
      </div>
    )
  }

  const progress = getProgress()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate(-1)}
            className="flex items-center space-x-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{list.title}</h1>
            <p className="text-muted-foreground capitalize">
              {list.type} list • {progress.completed} of {progress.total} items completed
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <div className="text-right">
            <p className="text-2xl font-bold">{progress.percentage}%</p>
            <p className="text-sm text-muted-foreground">Complete</p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      {progress.total > 0 && (
        <div className="w-full bg-muted rounded-full h-3">
          <div 
            className="bg-primary h-3 rounded-full transition-all duration-300"
            style={{ width: `${progress.percentage}%` }}
          />
        </div>
      )}

      {/* Add Item Form */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-3">
            <input
              type="text"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              placeholder="Add new item..."
              className="flex-1 px-3 py-2 rounded-lg border border-input bg-background"
              onKeyDown={(e) => e.key === 'Enter' && addItem()}
              disabled={addingItem}
            />
            <Button 
              onClick={addItem}
              disabled={addingItem || !newItemName.trim()}
              className="flex items-center space-x-2"
            >
              <Plus className="w-4 h-4" />
              <span>{addingItem ? 'Adding...' : 'Add'}</span>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* List Items */}
      <Card>
        <CardHeader>
          <CardTitle>Items ({items.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length > 0 ? (
            <DndContext 
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={items.map(item => item.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-3">
                  {items.map((item) => (
                    <SortableListItem
                      key={item.id}
                      item={item}
                      onToggle={toggleItem}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <Plus className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No items yet</h3>
              <p className="text-muted-foreground mb-4">
                Add your first item to get started with this list.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Stats */}
      {items.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">{progress.completed}</p>
                <p className="text-sm text-muted-foreground">Completed</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-muted-foreground">{progress.total - progress.completed}</p>
                <p className="text-sm text-muted-foreground">Remaining</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <p className="text-2xl font-bold">{progress.total}</p>
                <p className="text-sm text-muted-foreground">Total Items</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-primary">{progress.percentage}%</p>
                <p className="text-sm text-muted-foreground">Progress</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}