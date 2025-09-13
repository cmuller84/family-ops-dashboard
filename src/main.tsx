import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// QA Ready Promise initializer: exposes window.__qaReadyPromise(name?) that resolves when window.__qaReady(name) is called.
;(function setupQAReady() {
  if (typeof window === 'undefined') return
  const w = window as any
  if (w.__qaReadyPromiseInitialized) return

  const resolved = new Set<string>()
  const resolvers = new Map<string, (value: boolean) => void>()

  // Promise API used by harness/tests
  w.__qaReadyPromise = (name: string = 'app'): Promise<boolean> => {
    if (resolved.has(name)) return Promise.resolve(true)
    return new Promise<boolean>((resolve) => {
      resolvers.set(name, resolve)
    })
  }

  // Wrap existing __qaReady if present so both behaviors work
  const prev = typeof w.__qaReady === 'function' ? w.__qaReady.bind(w) : null
  w.__qaReady = (name: string = 'app') => {
    try {
      resolved.add(name)
      const r = resolvers.get(name)
      if (r) {
        r(true)
        resolvers.delete(name)
      }
    } catch {/* ignore */}
    try { prev && prev(name) } catch {/* ignore */}
  }

  w.__qaReadyPromiseInitialized = true
})()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <App />
) 