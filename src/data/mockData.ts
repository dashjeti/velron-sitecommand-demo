// Small date helpers shared across the dashboards. All demo data itself lives
// in src/demo/db.ts.

export function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10)
}

export function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return isoDay(d)
}

export function prettyDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
  })
}
