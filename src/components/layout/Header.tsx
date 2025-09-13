import React, { useState } from 'react'
import { Plus, Menu, ChevronDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { GlobalAddModal } from '@/components/ui/GlobalAddModal'
import { useFamily } from '@/lib/familyContext'
import { cn } from '@/lib/utils'

interface HeaderProps {
  onToggleSidebar?: () => void
  onMenuClick?: () => void
  className?: string
}

export function Header({ onToggleSidebar, onMenuClick, className }: HeaderProps) {
  const { family, familyId } = useFamily()
  const [showAddModal, setShowAddModal] = useState(false)
  
  const handleAddClick = () => {
    if (familyId) {
      setShowAddModal(true)
    }
  }
  return (
    <header className={cn(
      'h-16 border-b bg-card flex items-center justify-between px-6',
      className
    )}>
      {/* Left side - Menu toggle for mobile */}
      <div className="flex items-center space-x-4">
        {onMenuClick && (
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 hover:bg-muted rounded-lg"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            className="hidden lg:block p-2 hover:bg-muted rounded-lg"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}
        
        {/* Family Switcher - Hidden until OAuth is fully implemented */}
        {/* Family Switcher hidden until OAuth is implemented */}
      </div>

      {/* Right side - Actions */}
      <div className="flex items-center space-x-3">
        <Button 
          size="sm" 
          onClick={handleAddClick}
          disabled={!familyId}
          className="flex items-center space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add</span>
        </Button>
        
        {/* User menu placeholder */}
        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
          <span className="text-primary-foreground text-sm font-medium">U</span>
        </div>
      </div>
      
      <GlobalAddModal 
        open={showAddModal} 
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          // Trigger page refresh - can be handled by parent component
          window.location.reload()
        }}
      />
    </header>
  )
}
