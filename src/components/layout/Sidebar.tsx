import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Calendar, Home, UtensilsCrossed, MapPin, Clock, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SidebarProps {
  isCollapsed?: boolean
  className?: string
  onClose?: () => void
}

const navigation = [
  { name: 'Dashboard', icon: Home, path: '/', tourId: 'dashboard' },
  { name: 'Calendar', icon: Calendar, path: '/calendar', tourId: 'calendar' },
  { name: 'Meals', icon: UtensilsCrossed, path: '/meals', tourId: 'meals' },
  { name: 'Trips & Lists', icon: MapPin, path: '/trips', tourId: 'trips' },
  { name: 'Routines', icon: Clock, path: '/routines', tourId: 'routines' },
  { name: 'Settings', icon: Settings, path: '/settings', tourId: 'settings' },
]

export function Sidebar({ isCollapsed = false, className, onClose }: SidebarProps) {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <div className={cn(
      'bg-card border-r flex flex-col h-full transition-all duration-200',
      isCollapsed ? 'w-16' : 'w-64',
      className
    )}>
      {/* Header */}
      <div className="border-b flex-shrink-0 p-6">
        <div className={cn(
          'flex items-center',
          isCollapsed ? 'justify-center' : 'space-x-3'
        )}>
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Home className="w-5 h-5 text-primary-foreground" />
          </div>
          {!isCollapsed && (
            <div>
              <h1 className="font-semibold text-lg">Family Ops</h1>
              <p className="text-sm text-muted-foreground">Dashboard</p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-2">
        {navigation.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.path
          
          return (
            <button
              key={item.path}
              data-tour={item.tourId}
              onClick={() => {
                navigate(item.path)
                onClose?.()
              }}
              className={cn(
                'w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted',
                isCollapsed ? 'justify-center' : 'justify-start'
              )}
            >
              <Icon className="w-5 h-5 flex-shrink-0" />
              {!isCollapsed && <span>{item.name}</span>}
            </button>
          )
        })}
      </nav>

      {/* User Section */}
      <div className="border-t flex-shrink-0 p-4">
        <div className={cn(
          'flex items-center space-x-3',
          isCollapsed ? 'justify-center' : ''
        )}>
          <div className="w-8 h-8 bg-accent rounded-full flex items-center justify-center">
            <span className="text-accent-foreground text-sm font-medium">U</span>
          </div>
          {!isCollapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">User</p>
              <p className="text-xs text-muted-foreground truncate">Family Member</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
