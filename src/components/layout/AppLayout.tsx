import React, { useState, useEffect } from 'react'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { cn } from '@/lib/utils'

interface AppLayoutProps {
  children: React.ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const toggleCollapsed = () => setIsCollapsed(!isCollapsed)
  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="min-h-screen bg-background">
      {!isMobile ? (
        // Desktop: h-screen flex container
        <div className="flex h-screen">
          <Sidebar isCollapsed={isCollapsed} />
          <div className="flex-1 flex flex-col overflow-hidden">
            <Header onToggleSidebar={toggleCollapsed} />
            <main className="flex-1 overflow-auto p-6">
              {children}
            </main>
          </div>
        </div>
      ) : (
        // Mobile: separate layout with overlay
        <div className="flex flex-col h-screen">
          <Header onMenuClick={() => setSidebarOpen(true)} />
          {sidebarOpen && (
            <div className="fixed inset-0 z-50">
              <div 
                className="fixed inset-0 bg-black/50" 
                onClick={closeSidebar} 
              />
              <div className="fixed inset-y-0 left-0 w-64 bg-card">
                <Sidebar onClose={closeSidebar} />
              </div>
            </div>
          )}
          <main className="flex-1 overflow-auto p-4">
            {children}
          </main>
        </div>
      )}
    </div>
  )
}
