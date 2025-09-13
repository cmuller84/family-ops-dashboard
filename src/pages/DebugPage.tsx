import React, { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-hot-toast'

export default function DebugPage() {
  const [exists, setExists] = useState(false)
  const [logs, setLogs] = useState<Array<{ t: number; msg: string }>>([])

  useEffect(() => {
    const el = document.getElementById('toast-root')
    setExists(!!el)
    try {
      const arr = (window as any).__toastMountLog || []
      setLogs([...arr].slice(-10))
    } catch { /* ignore */ }

    // Auto fire test toast if requested
    try {
      const params = new URLSearchParams(window.location.search)
      if (params.get('auto') === '1' || params.get('fire') === '1') {
        toast.success('Test toast from /debug (auto)')
        ;(window as any).__toastPing?.('auto-fire')
        setTimeout(() => {
          try {
            const arr2 = (window as any).__toastMountLog || []
            setLogs([...arr2].slice(-10))
          } catch { /* ignore */ }
        }, 250)
      }
    } catch { /* ignore */ }
  }, [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify({ exists, logs }, null, 2))
      toast.success('Copied debug info')
    } catch (e) {
      toast.error('Copy failed')
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-semibold">Debug</h1>
        <div className="rounded-lg border bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-muted-foreground">#toast-root present</div>
              <div className="font-medium">{String(exists)}</div>
            </div>
            <button className="px-3 py-2 rounded-md bg-primary text-primary-foreground" onClick={() => toast.success('Test toast from /debug')}>Fire Test Toast</button>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-2">Mount log (last 10)</div>
            <pre className="text-xs bg-muted rounded-md p-3 overflow-auto max-h-64">{JSON.stringify(logs, null, 2)}</pre>
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-2 rounded-md border" onClick={copy}>Copy Results</button>
            <a className="px-3 py-2 rounded-md border" href="/?toast=1">Open Home with ?toast=1</a>
          </div>
        </div>
      </div>
    </div>
  )
}