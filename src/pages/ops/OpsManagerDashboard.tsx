import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  Factory,
  Loader2,
  Timer,
  TrendingUp,
  Users,
} from 'lucide-react'
import { KpiCard, PageHeader, Panel, Progress } from '../../components/ui'
import { ProductionTrend } from '../../components/charts'
import { useData } from '../../state/DataContext'
import { fetchDelaysSince, fetchSubmissionsSince } from '../../lib/reports'
import type { DelayRow, SubmissionRow } from '../../lib/reports'
import { fetchTeam, initialsOf } from '../../lib/team'
import type { TeamMember } from '../../lib/team'
import { formatDateLabel } from '../../lib/production'
import { agoLabel, clockTime, isoDaysAgo, todayIso } from '../../lib/dates'

/** How far back each panel looks. */
const ACTIVITY_DAYS = 30
const DELAY_DAYS = 7
const TREND_DAYS = 14

const delayLabels: Record<string, string> = {
  equipment: 'Equipment',
  weather: 'Weather',
  supply: 'Supply',
  power: 'Power',
  labour: 'Labour',
  other: 'Other',
}

/**
 * Operations Manager home. The question this page answers is "are my site
 * supervisors reporting, and what needs me today", so reporting status and
 * supervisor activity lead, and production detail follows.
 */
export default function OpsManagerDashboard() {
  const { siteViews, groupProduction, reloadSites } = useData()

  const [team, setTeam] = useState<TeamMember[]>([])
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([])
  const [delays, setDelays] = useState<DelayRow[]>([])
  const [loading, setLoading] = useState(true)
  // Distinct from `loading`: siteViews arrives from DataContext and is already
  // populated on a remount, so the panel must wait for THIS page's fetches
  // before judging who has reported or who is unstaffed. Without it, coming
  // back to this page briefly claims every site has no supervisor.
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [members, subs, dels] = await Promise.all([
      fetchTeam(['supervisor']),
      fetchSubmissionsSince(isoDaysAgo(ACTIVITY_DAYS)),
      fetchDelaysSince(isoDaysAgo(DELAY_DAYS)),
    ])
    setTeam(members)
    setSubmissions(subs)
    setDelays(dels)
    setLoading(false)
    setLoaded(true)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { reloadSites() }, [reloadSites])

  const today = todayIso()

  // Only sites that are actually operating are expected to report.
  const activeSites = useMemo(
    () => siteViews.filter((v) => v.opStatus === 'active'),
    [siteViews],
  )
  const dormantCount = siteViews.length - activeSites.length

  const reporting = useMemo(() => {
    const todays = submissions.filter((s) => s.reportDate === today)
    return activeSites
      .map((site) => ({
        site,
        supervisors: team.filter((m) => m.siteId === site.id),
        submission: todays.find((s) => s.siteId === site.id) ?? null,
      }))
      // Sites nobody is assigned to sink to the bottom: they are a staffing
      // problem, not a reporting one.
      .sort((a, b) => Number(b.supervisors.length > 0) - Number(a.supervisors.length > 0))
  }, [activeSites, team, submissions, today])

  // Only a site with a supervisor can report, so only those count towards the
  // daily tally. Unstaffed sites are surfaced separately rather than sitting
  // permanently overdue.
  const expected = reporting.filter((r) => r.supervisors.length > 0)
  const reported = expected.filter((r) => r.submission).length
  const awaiting = expected.filter((r) => !r.submission)
  const unstaffed = reporting.filter((r) => r.supervisors.length === 0)

  const todayActual = reporting.reduce((sum, r) => sum + (r.submission?.actual ?? 0), 0)
  const todayTarget = reporting.reduce((sum, r) => sum + (r.submission?.target ?? 0), 0)
  const todayVariance = todayTarget
    ? Math.round(((todayActual - todayTarget) / todayTarget) * 100)
    : 0
  const belowTarget = reporting.filter(
    (r) => r.submission && r.submission.target > 0 && r.submission.actual < r.submission.target,
  ).length

  const delayHours = delays.reduce((sum, d) => sum + d.hours, 0)

  // Group actual against target over the trend window.
  const trend = useMemo(
    () =>
      Array.from({ length: TREND_DAYS }, (_, i) => {
        const iso = isoDaysAgo(TREND_DAYS - 1 - i)
        const rows = groupProduction.filter((r) => r.report_date === iso)
        return {
          date: formatDateLabel(iso),
          actual: rows.reduce((s, r) => s + r.production_tonnes_actual, 0),
          target: rows.reduce((s, r) => s + r.production_tonnes_target, 0),
        }
      }),
    [groupProduction],
  )
  const trendHasData = trend.some((d) => d.actual > 0 || d.target > 0)

  // Every supervisor, quietest first, so the ones who need chasing are on top.
  const activity = useMemo(() => {
    return team
      .map((member) => {
        const mine = submissions.filter((s) => s.supervisorId === member.id)
        return {
          member,
          count: mine.length,
          last: mine[0]?.reportDate ?? null,
          reportedToday: mine.some((s) => s.reportDate === today),
        }
      })
      .sort((a, b) => a.count - b.count || a.member.name.localeCompare(b.member.name))
  }, [team, submissions, today])

  const unattributed = submissions.filter((s) => !s.supervisorId).length

  return (
    <>
      <PageHeader
        title="Operations Manager"
        subtitle="Daily reporting from every site supervisor, as it comes in"
        action={
          <button onClick={load} disabled={loading} className="btn-outline text-sm disabled:opacity-60">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
            Refresh
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <KpiCard
          label="Reported Today"
          value={`${reported}/${expected.length}`}
          icon={<CalendarDays className="h-5 w-5" />}
          accent={expected.length && reported === expected.length ? 'green' : 'billnick'}
          sub={
            expected.length
              ? `${awaiting.length} still outstanding`
              : activeSites.length
                ? 'No supervisors assigned yet'
                : 'No active sites yet'
          }
          delay={0}
        />
        <KpiCard
          label="Output Today"
          value={todayActual.toLocaleString()}
          unit="t"
          delta={todayTarget ? todayVariance : undefined}
          icon={<TrendingUp className="h-5 w-5" />}
          accent={todayVariance >= 0 ? 'green' : 'red'}
          sub={todayTarget ? `Target ${todayTarget.toLocaleString()}t` : 'No target reported yet'}
          delay={50}
        />
        <KpiCard
          label={`Delays (${DELAY_DAYS} days)`}
          value={delays.length}
          icon={<Timer className="h-5 w-5" />}
          accent={delays.length ? 'red' : 'green'}
          sub={`${delayHours.toLocaleString()} hours lost`}
          delay={100}
        />
        <KpiCard
          label="Below Target Today"
          value={belowTarget}
          icon={<AlertTriangle className="h-5 w-5" />}
          accent={belowTarget ? 'red' : 'green'}
          sub={belowTarget ? 'Sites under plan' : 'All reported sites on plan'}
          delay={150}
        />
      </div>

      <Panel
        className="mb-6"
        title="Today's reporting"
        icon={<ClipboardList className="h-4 w-4 text-billnick-500" />}
        action={
          <Link to="/ops-manager/reports" className="flex items-center gap-1 text-xs font-semibold text-billnick-600 hover:text-billnick-700">
            All reports <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        }
      >
        {!loaded ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-ink-300" /></div>
        ) : reporting.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-400">
            No active sites yet. An executive adds them in Site Management, then each site's
            supervisor reports here daily.
          </p>
        ) : (
          <div className="space-y-2">
            {reporting.map(({ site, supervisors, submission }) => {
              const variance = submission && submission.target
                ? Math.round(((submission.actual - submission.target) / submission.target) * 100)
                : null
              return (
                <div key={site.id} className="rounded-xl border border-ink-100 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate font-semibold text-ink-800">{site.name}</span>
                      {submission ? (
                        <span className="pill bg-emerald-100 text-emerald-700">
                          <CheckCircle2 className="h-3 w-3" /> Submitted {clockTime(submission.createdAt)}
                        </span>
                      ) : supervisors.length === 0 ? (
                        <span className="pill bg-ink-100 text-ink-500">
                          <Users className="h-3 w-3" /> No supervisor assigned
                        </span>
                      ) : (
                        <span className="pill bg-amber-100 text-amber-700">
                          <Clock className="h-3 w-3" /> Not submitted
                        </span>
                      )}
                    </div>
                    {submission && (
                      <Link
                        to={`/ops-manager/reports?report=${submission.id}`}
                        className="flex shrink-0 items-center gap-1 text-xs font-semibold text-billnick-600 hover:text-billnick-700"
                      >
                        View report <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                    <div className="min-w-0">
                      <p className="text-ink-400">Supervisor</p>
                      <p className="truncate font-semibold text-ink-700">
                        {supervisors.length
                          ? supervisors.map((s) => s.name).join(', ')
                          : <span className="text-amber-600">None assigned</span>}
                      </p>
                    </div>
                    <div>
                      <p className="text-ink-400">Output</p>
                      <p className="font-semibold text-ink-700">
                        {submission
                          ? `${submission.actual.toLocaleString()}t / ${submission.target.toLocaleString()}t`
                          : 'Awaiting report'}
                      </p>
                    </div>
                    <div>
                      <p className="text-ink-400">Variance</p>
                      <p className="font-semibold text-ink-700">
                        {variance === null ? (
                          'Awaiting report'
                        ) : (
                          <span className={`pill ${variance >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {variance >= 0 ? '+' : ''}{variance}%
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {submission && submission.target > 0 && (
                    <div className="mt-2">
                      <Progress
                        value={(submission.actual / submission.target) * 100}
                        color={variance !== null && variance >= 0 ? 'green' : 'billnick'}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {loaded && (dormantCount > 0 || unstaffed.length > 0) && (
          <div className="mt-3 space-y-1.5">
            {unstaffed.length > 0 && (
              <p className="rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-500">
                Not counted above, because no supervisor is assigned and so no one can report{' '}
                {unstaffed.length === 1 ? 'it' : 'them'}:{' '}
                <span className="font-semibold text-ink-700">{unstaffed.map((r) => r.site.name).join(', ')}</span>.
                An executive either assigns a supervisor in User Management, or sets the site to
                inactive in Site Management if it is not a reporting site.
              </p>
            )}
            {dormantCount > 0 && (
              <p className="text-xs text-ink-400">
                {dormantCount} site{dormantCount === 1 ? '' : 's'} not currently operating
                {dormantCount === 1 ? ' is' : ' are'} excluded from today's count.
              </p>
            )}
          </div>
        )}
      </Panel>

      <div className="mb-6 grid gap-4 lg:grid-cols-5">
        <Panel
          title={`Group production, last ${TREND_DAYS} days`}
          className="lg:col-span-3"
          icon={<TrendingUp className="h-4 w-4 text-billnick-500" />}
        >
          {trendHasData ? (
            <ProductionTrend data={trend} />
          ) : (
            <p className="py-10 text-center text-sm text-ink-400">
              No production reported in this window. The trend fills in as supervisors submit
              their daily reports.
            </p>
          )}
        </Panel>

        <Panel
          title="Supervisor activity"
          className="lg:col-span-2"
          icon={<Users className="h-4 w-4 text-billnick-500" />}
        >
          {activity.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-400">
              No site supervisors yet. An executive invites them in User Management.
            </p>
          ) : (
            <div className="space-y-2">
              {activity.map(({ member, count, last, reportedToday }) => (
                <div key={member.id} className="flex items-center gap-3 rounded-xl border border-ink-100 p-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ink-100 text-xs font-bold text-ink-600">
                    {initialsOf(member.name)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-800">{member.name}</p>
                    <p className="truncate text-xs text-ink-400">
                      {count === 0
                        ? `No reports in ${ACTIVITY_DAYS} days`
                        : `${count} report${count === 1 ? '' : 's'}, last ${last ? agoLabel(last) : 'unknown'}`}
                    </p>
                  </div>
                  <span
                    className={`pill shrink-0 ${
                      reportedToday
                        ? 'bg-emerald-100 text-emerald-700'
                        : count === 0
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {reportedToday ? 'In today' : count === 0 ? 'Silent' : 'Pending'}
                  </span>
                </div>
              ))}
              {unattributed > 0 && (
                <p className="pt-1 text-xs text-ink-400">
                  {unattributed} report{unattributed === 1 ? '' : 's'} in this window
                  {unattributed === 1 ? ' has' : ' have'} no supervisor recorded, usually because
                  the account was removed after submitting.
                </p>
              )}
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title={`Delays and stoppages, last ${DELAY_DAYS} days`} icon={<Timer className="h-4 w-4 text-amber-500" />}>
          {delays.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-400">
              No delays logged in this window. Supervisors record them on the daily report.
            </p>
          ) : (
            <div className="space-y-2">
              {delays.slice(0, 8).map((d) => (
                <div key={d.id} className="flex items-start justify-between gap-3 rounded-xl border border-ink-100 p-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink-800">{d.description || delayLabels[d.type] || d.type}</p>
                    <p className="text-xs text-ink-400">
                      {d.siteName} · {delayLabels[d.type] ?? d.type} · {agoLabel(d.reportDate)}
                    </p>
                  </div>
                  <span className="pill shrink-0 bg-amber-100 text-amber-700">{d.hours}h</span>
                </div>
              ))}
              {delays.length > 8 && (
                <p className="pt-1 text-xs text-ink-400">
                  Showing the 8 longest of {delays.length}. Open a report to see its full delay log.
                </p>
              )}
            </div>
          )}
        </Panel>

        <Panel title="Latest submissions" icon={<Factory className="h-4 w-4 text-billnick-500" />}>
          {submissions.length === 0 ? (
            <p className="py-8 text-center text-sm text-ink-400">
              Nothing submitted in the last {ACTIVITY_DAYS} days yet.
            </p>
          ) : (
            <div className="space-y-2">
              {submissions.slice(0, 8).map((s) => {
                const variance = s.target ? Math.round(((s.actual - s.target) / s.target) * 100) : 0
                return (
                  <Link
                    key={s.id}
                    to={`/ops-manager/reports?report=${s.id}`}
                    className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 p-3 transition-colors hover:bg-ink-50/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-billnick-400"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-800">{s.siteName}</p>
                      <p className="truncate text-xs text-ink-400">
                        {s.supervisorName ?? 'Supervisor not recorded'} · {agoLabel(s.reportDate)}
                      </p>
                    </div>
                    <span className={`pill shrink-0 ${variance >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                      {variance >= 0 ? '+' : ''}{variance}%
                    </span>
                  </Link>
                )
              })}
            </div>
          )}
        </Panel>
      </div>
    </>
  )
}
