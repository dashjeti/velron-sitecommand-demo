/**
 * Date helpers for the oversight dashboards.
 *
 * Report and record dates are stored as plain YYYY-MM-DD strings produced by
 * toISOString(), so they are UTC calendar days. Everything here stays in that
 * same space on purpose: comparing a date-only string against a local
 * timestamp makes a report submitted this afternoon read as "yesterday".
 */

/** Today as the app stores it. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/** The date `days` before today, as YYYY-MM-DD. */
export function isoDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().slice(0, 10)
}

/** "today", "yesterday" or "5 days ago" for a YYYY-MM-DD string. */
export function agoLabel(isoDate: string): string {
  const days = Math.round((Date.parse(todayIso()) - Date.parse(isoDate)) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days} days ago`
}

/** Wall-clock time of a full timestamp, for "Submitted 14:32". */
export function clockTime(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

/** "17 Aug 2026" for a YYYY-MM-DD string. */
export function prettyDay(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}
