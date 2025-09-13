import hotToast from 'react-hot-toast'
import { toast as shadToast } from '@/hooks/use-toast'

// Unified toast helper: calls both react-hot-toast and Radix toast
// Usage: toast('Message'); toast.success('Great'); toast.error('Oops')

type Message = string
const DEFAULT_DURATION = 7000
const ping = (note: string, message: string) => { try { (window as any).__toastPing?.(`${note}:${message}`) } catch (_) { /* noop */ } }

function base(message: Message) {
  try { hotToast(message, { duration: DEFAULT_DURATION }) } catch (e) { /* ignore */ }
  try { shadToast({ title: 'Notice', description: message, variant: 'default' as any }) } catch (e) { /* ignore */ }
  try { ping('toast', message) } catch (e) { /* ignore */ }
}

base.success = (message: Message) => {
  try { hotToast.success(message, { duration: DEFAULT_DURATION }) } catch (e) { /* ignore */ }
  try { shadToast({ title: 'Success', description: message, variant: 'default' as any }) } catch (e) { /* ignore */ }
  try { ping('toast-success', message) } catch (e) { /* ignore */ }
}

base.error = (message: Message) => {
  try { hotToast.error(message, { duration: DEFAULT_DURATION }) } catch (e) { /* ignore */ }
  try { shadToast({ title: 'Error', description: message, variant: 'destructive' as any }) } catch (e) { /* ignore */ }
  try { ping('toast-error', message) } catch (e) { /* ignore */ }
}

export default base
