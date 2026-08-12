/**
 * Production forecasting, kept deliberately simple and honest.
 *
 * This is a run-rate projection, not a statistical model: it takes the recent
 * daily run-rate and extends it across the month. It does not model seasonality,
 * planned maintenance, or weather. The UI must label it as a projection so no
 * one mistakes it for a prediction with more rigour than it has. When the client
 * have a longer history in the platform, this can be upgraded to a real model.
 */

export interface ProductionForecast {
  avgDailyActual: number
  avgDailyTarget: number
  runRateDays: number
  daysInMonth: number
  projectedMonth: number
  projectedTarget: number
  variancePct: number
}

export function forecastFromDaily(
  daily: { Actual: number; Target: number }[],
  now: Date = new Date(),
): ProductionForecast | null {
  const days = daily.filter((d) => d.Actual > 0 || d.Target > 0)
  if (days.length === 0) return null

  const avgDailyActual = days.reduce((s, d) => s + d.Actual, 0) / days.length
  const avgDailyTarget = days.reduce((s, d) => s + d.Target, 0) / days.length
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()

  const projectedMonth = Math.round(avgDailyActual * daysInMonth)
  const projectedTarget = Math.round(avgDailyTarget * daysInMonth)
  const variancePct = projectedTarget
    ? Math.round(((projectedMonth - projectedTarget) / projectedTarget) * 100)
    : 0

  return {
    avgDailyActual: Math.round(avgDailyActual),
    avgDailyTarget: Math.round(avgDailyTarget),
    runRateDays: days.length,
    daysInMonth,
    projectedMonth,
    projectedTarget,
    variancePct,
  }
}
