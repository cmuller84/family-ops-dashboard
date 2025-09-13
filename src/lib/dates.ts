export function todayISOInTZ(tz = ((globalThis as any)?.process?.env?.APP_TIMEZONE as string) || 'America/New_York'): string {
  const parts = new Intl.DateTimeFormat('en-CA', { 
    timeZone: tz, 
    year: 'numeric', 
    month: '2-digit', 
    day: '2-digit' 
  }).formatToParts(new Date());
  
  const y = parts.find(p => p.type === 'year')!.value;
  const m = parts.find(p => p.type === 'month')!.value;
  const d = parts.find(p => p.type === 'day')!.value;
  
  return `${y}-${m}-${d}`;
}