// Simple client-side rate limiter for AI features
const RATE_LIMIT_KEY = 'ai_usage_tracker'
const MAX_REQUESTS_PER_DAY = 50 // Generous for testing
const MAX_REQUESTS_PER_HOUR = 10

interface UsageData {
  daily: { count: number; date: string }
  hourly: { count: number; hour: string }
}

export function checkRateLimit(): { allowed: boolean; message?: string } {
  const now = new Date()
  const today = now.toDateString()
  const currentHour = `${today}-${now.getHours()}`

  const stored = localStorage.getItem(RATE_LIMIT_KEY)
  const usage: UsageData = stored ? JSON.parse(stored) : {
    daily: { count: 0, date: today },
    hourly: { count: 0, hour: currentHour }
  }

  // Reset daily counter if new day
  if (usage.daily.date !== today) {
    usage.daily = { count: 0, date: today }
  }

  // Reset hourly counter if new hour
  if (usage.hourly.hour !== currentHour) {
    usage.hourly = { count: 0, hour: currentHour }
  }

  // Check limits
  if (usage.daily.count >= MAX_REQUESTS_PER_DAY) {
    return {
      allowed: false,
      message: `Daily limit reached (${MAX_REQUESTS_PER_DAY} requests). Try again tomorrow!`
    }
  }

  if (usage.hourly.count >= MAX_REQUESTS_PER_HOUR) {
    return {
      allowed: false,
      message: `Hourly limit reached (${MAX_REQUESTS_PER_HOUR} requests). Try again next hour!`
    }
  }

  return { allowed: true }
}

export function incrementUsage() {
  const now = new Date()
  const today = now.toDateString()
  const currentHour = `${today}-${now.getHours()}`

  const stored = localStorage.getItem(RATE_LIMIT_KEY)
  const usage: UsageData = stored ? JSON.parse(stored) : {
    daily: { count: 0, date: today },
    hourly: { count: 0, hour: currentHour }
  }

  // Reset counters if needed
  if (usage.daily.date !== today) {
    usage.daily = { count: 1, date: today }
    usage.hourly = { count: 1, hour: currentHour }
  } else if (usage.hourly.hour !== currentHour) {
    usage.hourly = { count: 1, hour: currentHour }
    usage.daily.count++
  } else {
    usage.daily.count++
    usage.hourly.count++
  }

  localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(usage))
}

export function getRemainingRequests() {
  const check = checkRateLimit()
  if (!check.allowed) return 0

  const stored = localStorage.getItem(RATE_LIMIT_KEY)
  if (!stored) return MAX_REQUESTS_PER_HOUR

  const usage: UsageData = JSON.parse(stored)
  const now = new Date()
  const currentHour = `${now.toDateString()}-${now.getHours()}`

  if (usage.hourly.hour !== currentHour) return MAX_REQUESTS_PER_HOUR
  return Math.max(0, MAX_REQUESTS_PER_HOUR - usage.hourly.count)
}