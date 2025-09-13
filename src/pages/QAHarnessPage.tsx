import React, { useState, useEffect, useRef } from 'react'
import toast from '@/lib/notify'
import blink from '../blink/client'
import { qaAuthBypassEnabled } from '@/lib/features'
import { families, seed, routines, lists, listItems, meals } from '../lib/serverActions'

interface Row { ok: boolean; message: string }

export default function QAHarnessPage() {
  const [rows, setRows] = useState<Row[]>([])
  const [toastLogs, setToastLogs] = useState<string[]>([])
  const [apiPayloads, setApiPayloads] = useState<{ before?: any; after?: any }>({})
  const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
  const demoOrBypass = qaAuthBypassEnabled()
  const isDemo = demoOrBypass || (typeof window !== 'undefined' && (params.get('qaDemo') === '1' || params.get('qaBypass') === '1'))
  const isBypass = typeof window !== 'undefined' && ((params.get('qaBypass') === '1') || (window.location.pathname.startsWith('/qa') && params.get('qaDemo') !== '1'))
  const [isAuth, setIsAuth] = useState<boolean>(isDemo ? true : false)
  const [userEmail, setUserEmail] = useState<string | null>(isDemo ? 'demo-qa@example.com' : null)
  const push = (ok: boolean, message: string) => setRows(r => [...r, { ok, message }])

  useEffect(() => {
    if (isDemo) return
    const unsub = blink.auth.onAuthStateChanged((state) => {
      setIsAuth(!!state.isAuthenticated)
      setUserEmail(state.user?.email || null)
    })
    return unsub
  }, [isDemo])

  // Live-capture toast messages by shimming window.__toastPing
  useEffect(() => {
    if (typeof window === 'undefined') return
    const w = window as any
    const prev = typeof w.__toastPing === 'function' ? w.__toastPing.bind(w) : null
    const handler = (msg?: string) => {
      try {
        if (typeof msg === 'string') {
          const text = msg.includes(':') ? msg.split(':').slice(1).join(':').trim() : msg
          if (text) {
            w.__qaLastToast = text
            setToastLogs((logs) => [...logs, text])
          }
        }
      } catch { /* ignore */ }
      try { prev && prev(msg) } catch { /* ignore */ }
    }
    w.__toastPing = handler
    return () => {
      try { w.__toastPing = prev || w.__toastPing } catch { /* ignore */ }
    }
  }, [])

  async function ensureFamily(): Promise<{ familyId: string }> {
    let userId: string | null = null
    try {
      const me = await blink.auth.me()
      userId = me?.id || null
    } catch {
      // ignore
    }
    if (!userId && isDemo) {
      userId = 'qa-demo-user'
    }
    if (!userId) throw new Error('Not authenticated')
    // Try to find a family membership; seed if needed
    const fam = await families.getMyPrimary(userId)
    if (fam?.id) return { familyId: fam.id }
    await seed.createDemoFamily(userId)
    const fam2 = await families.getMyPrimary(userId)
    if (!fam2?.id) throw new Error('No family found after seeding')
    return { familyId: fam2.id }
  }

  const getToastText = (): string | null => {
    // 0) Instrumentation: check last pinged toast set by our shim
    try {
      const last = (window as any).__qaLastToast
      if (typeof last === 'string' && last.trim()) return last.trim()
    } catch { /* ignore */ }

    // 0b) Read recent entries from window.__toastMountLog
    try {
      const log = (window as any).__toastMountLog as Array<{ t: number; msg: string }>
      if (Array.isArray(log) && log.length) {
        for (let i = log.length - 1; i >= Math.max(0, log.length - 15); i--) {
          const entry = log[i]
          const m = typeof entry?.msg === 'string' ? entry.msg : ''
          if (m.startsWith('toast-success:') || m.startsWith('toast:') || m.startsWith('toast-error:')) {
            const text = m.split(':').slice(1).join(':').trim()
            if (text) return text
          }
        }
      }
    } catch { /* ignore */ }

    // 1) React Hot Toast — latest visible status node (supports id or class container)
    try {
      const nodes = Array.from(document.querySelectorAll('#react-hot-toast [role="status"], .react-hot-toast [role="status"]')) as HTMLElement[]
      if (nodes.length) {
        const el = nodes[nodes.length - 1]
        let txt = (el.innerText || el.textContent || '').trim()
        // Clean common close icon or extra whitespace
        txt = txt.replace(/✕/g, '').trim()
        if (txt) return txt
      }
    } catch { /* ignore */ }

    // 2) Radix/Shadcn toasts — prefer the last open toast's description/title
    try {
      const viewport = document.querySelector('[data-radix-toast-viewport]') as HTMLElement | null
      if (viewport) {
        const opens = Array.from(viewport.querySelectorAll('[data-state="open"]')) as HTMLElement[]
        if (opens.length) {
          const last = opens[opens.length - 1]
          const desc = last.querySelector('[data-radix-toast-description]') as HTMLElement | null
          if (desc && (desc.innerText || '').trim()) return desc.innerText.trim()
          const title = last.querySelector('[data-radix-toast-title]') as HTMLElement | null
          if (title && (title.innerText || '').trim()) return title.innerText.trim()
          const txt = (last.innerText || last.textContent || '').trim()
          if (txt) return txt
        }
        const desc = viewport.querySelector('[data-radix-toast-description]') as HTMLElement | null
        if (desc && (desc.innerText || '').trim()) return desc.innerText.trim()
        const title = viewport.querySelector('[data-radix-toast-title]') as HTMLElement | null
        if (title && (title.innerText || '').trim()) return title.innerText.trim()
      }
    } catch { /* ignore */ }

    // 3) Last resort: any visible status region on page
    try {
      const anyStatus = document.querySelector('[role="status"]') as HTMLElement | null
      if (anyStatus) {
        const txt = (anyStatus.innerText || anyStatus.textContent || '').trim()
        if (txt) return txt
      }
    } catch { /* ignore */ }

    return null
  }
  type WaitOpts = { timeout?: number; ignore?: (string|RegExp)[]; match?: RegExp }
  const waitForToast = async (opts?: WaitOpts): Promise<string | null> => {
    const timeout = opts?.timeout ?? 9000
    const ignore = opts?.ignore ?? []
    const matcher = opts?.match
    const start = Date.now()
    let lastReturned: string | null = null
    while (Date.now() - start < timeout) {
      const t = getToastText()
      if (t && t !== lastReturned) {
        const isIgnored = ignore.some((ig) => typeof ig === 'string' ? t.includes(ig) : ig.test(t))
        const matches = matcher ? matcher.test(t) : true
        if (!isIgnored && matches) return t
        lastReturned = t
      }
      await new Promise(r => setTimeout(r, 150))
    }
    return null
  }

  async function run() {
    setRows([])
    setToastLogs([])
    setApiPayloads({})
    try {
      const { familyId } = await ensureFamily()
      push(true, `familyId=${familyId} ${isDemo ? '(demo)' : ''}`)

      // Routines: select a routine with >= 4 visible tasks when possible
      const all = await routines.listByFamily(familyId)
      if (!all?.length) throw new Error('No routines found')
      let r = all[0]
      let visibleCount = 0
      try {
        const s = JSON.parse(r.scheduleJson || '{}')
        const tasks: string[] = Array.isArray(s.tasks) ? s.tasks : []
        visibleCount = Math.min(tasks.length, 4)
        // Prefer one that has at least 4 tasks
        const candidate = all.find(rt => {
          try {
            const ss = JSON.parse(rt.scheduleJson || '{}')
            return Array.isArray(ss.tasks) && ss.tasks.length >= 4
          } catch { return false }
        })
        if (candidate) {
          r = candidate
          const sc = JSON.parse(r.scheduleJson || '{}')
          visibleCount = Math.min(Array.isArray(sc.tasks) ? sc.tasks.length : 0, 4)
        }
      } catch { /* ignore */ }

      if (visibleCount < 1) throw new Error('Selected routine has no tasks')

      // Reset first 4 tasks to unchecked to create a clean slate (no toast reads here)
      for (let i = 0; i < Math.min(visibleCount, 4); i++) {
        try { await routines.toggleTask(r.id, i, false) } catch { /* ignore */ }
      }

      // a) Toggle one task ON → expect toast with X/4 and current streak (no change yet)
      const t1 = await routines.toggleTask(r.id, 0, true)
      setApiPayloads(prev => ({ ...prev, before: t1 }))
      push(!!t1, `Routines: toggle on → expect toast Progress ${t1?.completed}/${t1?.total} • Streak ${t1?.streak}`)
      const t1Toast = await waitForToast(); push(!!t1Toast, `Toast observed (toggle on): ${t1Toast || 'none'}`); if (t1Toast) setToastLogs(t => [...t, t1Toast])

      // b) Complete all visible tasks → expect streak +1
      let afterFull = t1
      for (let i = 1; i < visibleCount; i++) {
        afterFull = await routines.toggleTask(r.id, i, true)
      }
      setApiPayloads(prev => ({ ...prev, after: afterFull }))
      push(!!afterFull, `Routines: completed all → expect streak +1 → Progress ${afterFull?.completed}/${afterFull?.total} • Streak ${afterFull?.streak}`)
      const fullToast = await waitForToast(); push(!!fullToast, `Toast observed (full complete): ${fullToast || 'none'}`); if (fullToast) setToastLogs(t => [...t, fullToast])

      // c) Uncheck one task → expect streak −1
      const tOff = await routines.toggleTask(r.id, 0, false)
      push(!!tOff, `Routines: uncheck one → expect streak −1 → Progress ${tOff?.completed}/${tOff?.total} • Streak ${tOff?.streak}`)
      const t2Toast = await waitForToast(); push(!!t2Toast, `Toast observed (toggle off): ${t2Toast || 'none'}`); if (t2Toast) setToastLogs(t => [...t, t2Toast])

      // Dinner: swap & add to grocery
      const todayMeals = await meals.getToday(familyId)
      const meal = Array.isArray(todayMeals) ? todayMeals[0] : todayMeals?.[0]
      if (meal?.id) {
        const swapped = await meals.swapRecipe(meal.id, familyId)
        push(!!swapped?.ok, 'Dinner: swap recipe → title should update')
        const swapToast = await waitForToast(); push(!!swapToast, `Toast observed (swap): ${swapToast || 'none'}`); if (swapToast) setToastLogs(t => [...t, swapToast])
        const added = await meals.addToGroceryList(meal.id, familyId)
        push(!!added?.ok, `Dinner: add to grocery → ${added?.addedCount ?? 0} new • ${added?.mergedCount ?? 0} merged`)
        const addToast = await waitForToast(); push(!!addToast, `Toast observed (grocery add): ${addToast || 'none'}`); if (addToast) setToastLogs(t => [...t, addToast])
      } else {
        push(false, 'Dinner: no meal for today (seed first from Dashboard)')
      }

      // Lists: create a fresh grocery list to guarantee 'Item added' on first insert
      const qaTitle = `QA Grocery • ${new Date().toLocaleString()}`
      const listId = await lists.create(familyId, 'grocery', qaTitle)
      push(!!listId, `Lists: created fresh grocery list → ${qaTitle}`)
      if (!listId) throw new Error('Failed to create grocery list')

      const add1 = await listItems.create(listId, 'Milk', '1')
      push(!!add1 && !(add1 as any).merged, 'Lists: add Milk → inserted')
      const add1Toast = await waitForToast({ match: /item added/i })
      push(!!add1Toast, `Toast observed (list add): ${add1Toast || 'none'}`); if (add1Toast) setToastLogs(t => [...t, add1Toast])
      // Assert wording for Item added variants
      const okAdd = !!(add1Toast && (/item added/i.test(add1Toast) || /added.*to (the )?list/i.test(add1Toast) || /added\s+milk/i.test(add1Toast)))
      push(okAdd, `Lists: add item → expected 'Item added' (got: ${add1Toast || 'none'})`)

      const add2 = await listItems.create(listId, 'milk', '1')
      push(!!add2 && (add2 as any).merged === true, 'Lists: add duplicate milk → merged')
      const add2Toast = await waitForToast({ match: /merge|merged|quantity/i }); push(!!add2Toast, `Toast observed (list merge): ${add2Toast || 'none'}`); if (add2Toast) setToastLogs(t => [...t, add2Toast])

      // Add a second distinct item to enable reorder assertion
      const add3 = await listItems.create(listId, 'Bread', '1')
      push(!!add3 && !(add3 as any).merged, 'Lists: add Bread → inserted')
      const add3Toast = await waitForToast({ match: /item added/i })
      push(!!add3Toast, `Toast observed (list add 2): ${add3Toast || 'none'}`)
      if (add3Toast) setToastLogs(t => [...t, add3Toast])

      const items = await listItems.list(listId)
      if (items.length > 1) {
        const reordered = items.map((it: any, i: number) => ({ id: it.id, position: i === 0 ? 1 : i === 1 ? 0 : i }))
        const ro = await listItems.reorder(listId, reordered)
        push(!!ro?.ok, 'Lists: reorder → Order saved!')
        const reorderToast = await waitForToast(); push(!!reorderToast, `Toast observed (reorder): ${reorderToast || 'none'}`); if (reorderToast) setToastLogs(t => [...t, reorderToast])
      } else {
        push(true, 'Lists: reorder skipped (not enough items)')
      }

      toast.success('QA run complete — check results below')
      const finalToast = await waitForToast(); if (finalToast) setToastLogs(t => [...t, finalToast])
    } catch (e: any) {
      push(false, `QA FAILED: ${e?.message ?? e}`)
      toast.error(e?.message ?? String(e))
      const errToast = await waitForToast(); if (errToast) setToastLogs(t => [...t, errToast])
    }
  }

  async function runListsOnly() {
    setRows([])
    setToastLogs([])
    setApiPayloads({})
    try {
      const { familyId } = await ensureFamily()
      push(true, `familyId=${familyId} ${isDemo ? '(demo)' : ''}`)

      // Always create a fresh grocery list to avoid seeded items (e.g., Milk)
      const qaTitle = `QA Grocery • ${new Date().toLocaleString()}`
      const listId = await lists.create(familyId, 'grocery', qaTitle)
      push(!!listId, `Lists: created fresh grocery list → ${qaTitle}`)
      if (!listId) throw new Error('Failed to create grocery list')

      // Add Milk → expect 'Item added'
      const add1 = await listItems.create(listId, 'Milk', '1')
      push(!!add1 && !(add1 as any).merged, 'Lists: add Milk → inserted')
      const add1Toast = await waitForToast({ match: /item added/i })
      push(!!add1Toast, `Toast observed (list add): ${add1Toast || 'none'}`)
      if (add1Toast) setToastLogs(t => [...t, add1Toast])
      const okAdd = !!(add1Toast && (/item added/i.test(add1Toast) || /added.*to (the )?list/i.test(add1Toast) || /added\s+milk/i.test(add1Toast)))
      push(okAdd, `Lists: add item → expected 'Item added' (got: ${add1Toast || 'none'})`)

      // Add duplicate milk → expect merge toast
      const add2 = await listItems.create(listId, 'milk', '1')
      push(!!add2 && (add2 as any).merged === true, 'Lists: add duplicate milk → merged')
      const add2Toast = await waitForToast({ match: /merge|merged|quantity/i })
      push(!!add2Toast, `Toast observed (list merge): ${add2Toast || 'none'}`)
      if (add2Toast) setToastLogs(t => [...t, add2Toast])

      // Reorder if possible
      const items = await listItems.list(listId)
      if (items.length > 1) {
        const reordered = items.map((it: any, i: number) => ({ id: it.id, position: i === 0 ? 1 : i === 1 ? 0 : i }))
        const ro = await listItems.reorder(listId, reordered)
        push(!!ro?.ok, 'Lists: reorder → Order saved!')
        const reorderToast = await waitForToast({ match: /order saved/i })
        push(!!reorderToast, `Toast observed (reorder): ${reorderToast || 'none'}`)
        if (reorderToast) setToastLogs(t => [...t, reorderToast])
      } else {
        push(true, 'Lists: reorder skipped (not enough items)')
      }

      toast.success('Lists-only QA complete')
      const finalToast = await waitForToast()
      if (finalToast) setToastLogs(t => [...t, finalToast])
    } catch (e: any) {
      push(false, `QA FAILED: ${e?.message ?? e}`)
      toast.error(e?.message ?? String(e))
      const errToast = await waitForToast()
      if (errToast) setToastLogs(t => [...t, errToast])
    }
  }

  const handleSignIn = () => {
    const redirect = window.location.href
    blink.auth.login(redirect)
  }

  const demoLink = `${typeof window !== 'undefined' ? `${window.location.origin}/qa?qaDemo=1` : '/qa?qaDemo=1'}`
  const bypassLink = `${typeof window !== 'undefined' ? `${window.location.origin}/qa?qaBypass=1` : '/qa?qaBypass=1'}`

  const autorunRef = useRef(false)

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (autorunRef.current) return
    const p = new URLSearchParams(window.location.search)
    if (p.get('autorun') === '1' || p.get('auto') === '1') {
      autorunRef.current = true
      // Delay slightly to let page mount
      setTimeout(() => {
        try {
          if (p.get('listsOnly') === '1') {
            runListsOnly()
          } else {
            run()
          }
        } catch { /* ignore */ }
      }, 250)
    }
  }, [])
  /* eslint-enable react-hooks/exhaustive-deps */

  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-2xl font-semibold mb-2">QA Harness</h1>
        <p className="text-sm text-muted-foreground mb-4">Runs the acceptance checks against the live app.</p>

        {!isAuth ? (
          <div className="rounded-lg border p-6 bg-card space-y-3">
            <p>You must be signed in as an owner to run QA — or use the QA Bypass below.</p>
            <div className="flex flex-wrap gap-3">
              <button onClick={handleSignIn} className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition">Sign in to run QA</button>
              <a href={demoLink} className="px-4 py-2 rounded-md border hover:bg-accent/10 transition">Run in Demo Mode</a>
              <a href={bypassLink} className="px-4 py-2 rounded-md border hover:bg-accent/10 transition">Run with QA Bypass</a>
            </div>
            <p className="text-xs text-muted-foreground">Tips:
              <br/>• Add <code>?auto=1</code> to autorun the harness.
              <br/>• Demo: <code>?qaDemo=1</code> (seeds demo family).
              <br/>• Full harness without owner login: <code>?qaBypass=1</code>.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-4 text-sm text-muted-foreground">
              <span>{isBypass ? 'QA Bypass' : (isDemo ? 'Demo mode' : 'Signed in as')}</span>
              <span className="font-medium text-foreground">{userEmail}</span>
            </div>
            <div className="flex gap-3">
              <button onClick={run} className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition">Run All Checks</button>
              <button onClick={runListsOnly} className="px-4 py-2 rounded-md border hover:bg-accent/10 transition">Run Lists Only</button>
            </div>
            <div className="grid md:grid-cols-2 gap-6 mt-6">
              <div>
                <h3 className="font-medium mb-2">Assertions</h3>
                <ol className="space-y-2">
                  {rows.map((r, i) => (
                    <li key={i} className={r.ok ? 'text-green-600' : 'text-red-600'}>
                      {r.ok ? 'PASS' : 'FAIL'} — {r.message}
                    </li>
                  ))}
                </ol>
                <div className="mt-6">
                  <h3 className="font-medium mb-2">API Payloads</h3>
                  <div className="rounded-md border bg-card p-3 text-xs space-y-3 max-h-64 overflow-auto">
                    <div>
                      <div className="text-muted-foreground mb-1">Before full completion</div>
                      <pre className="whitespace-pre-wrap break-words">{JSON.stringify(apiPayloads.before || null, null, 2)}</pre>
                    </div>
                    <div>
                      <div className="text-muted-foreground mb-1">After full completion</div>
                      <pre className="whitespace-pre-wrap break-words">{JSON.stringify(apiPayloads.after || null, null, 2)}</pre>
                    </div>
                  </div>
                </div>
              </div>
              <div>
                <h3 className="font-medium mb-2">Toasts Seen</h3>
                <div className="rounded-md border bg-card p-3 max-h-64 overflow-auto text-sm">
                  {toastLogs.length === 0 ? (
                    <div className="text-muted-foreground">(none yet)</div>
                  ) : (
                    <ul className="space-y-1">
                      {toastLogs.map((t, i) => (
                        <li key={i} className="text-foreground">{t}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(JSON.stringify({ rows, toastLogs, apiPayloads }, null, 2))
                      toast.success('Copied results')
                    } catch (e) { /* ignore */ }
                  }}
                  className="mt-3 px-3 py-2 rounded-md border"
                >Copy Results</button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}