export function matchesStatus(itemStatus: string, statusFilter: string): boolean {
  const f = statusFilter.trim()
  if (!f || f === 'all') return true
  return itemStatus === f
}

function isDateFilterActive(from: string, to: string): boolean {
  return Boolean(from.trim() || to.trim())
}

function parseLocalStartOfDay(dateString: string): Date | null {
  const s = dateString.trim()
  if (!s) return null
  const d = new Date(`${s}T00:00:00`)
  if (Number.isNaN(d.getTime())) return null
  return d
}

function parseLocalEndOfDay(dateString: string): Date | null {
  const s = dateString.trim()
  if (!s) return null
  const d = new Date(`${s}T23:59:59.999`)
  if (Number.isNaN(d.getTime())) return null
  return d
}

export function isWithinLocalDateRange(
  processedAt: string | null | undefined,
  from: string,
  to: string,
): boolean {
  if (!isDateFilterActive(from, to)) return true
  if (!processedAt) return false

  const t = new Date(processedAt)
  if (Number.isNaN(t.getTime())) return false

  const start = parseLocalStartOfDay(from)
  const end = parseLocalEndOfDay(to)

  if (start && t.getTime() < start.getTime()) return false
  if (end && t.getTime() > end.getTime()) return false
  return true
}

