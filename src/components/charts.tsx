import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const ORANGE = '#1d4ed8' // primary accent (dark blue in SiteCommand)
const NAVY = '#2a3142'
const BLUE = '#1b46c2'
const GREEN = '#10b981'
const GRID = '#eef1f6'
const AXIS = '#9aa3b5'

const tooltipStyle = {
  borderRadius: 12,
  border: '1px solid #eceef2',
  boxShadow: '0 10px 25px -5px rgba(16,24,40,0.12)',
  fontSize: 12,
  padding: '8px 12px',
}

// ---------------------------------------------------------------------------
// Production trend: actual vs target
// ---------------------------------------------------------------------------
export function ProductionTrend({
  data,
  height = 260,
}: {
  data: { date: string; actual: number; target: number }[]
  height?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <defs>
          <linearGradient id="gActual" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={ORANGE} stopOpacity={0.35} />
            <stop offset="100%" stopColor={ORANGE} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} width={44} />
        <Tooltip contentStyle={tooltipStyle} />
        <Area
          type="monotone"
          dataKey="target"
          name="Target (t)"
          stroke={AXIS}
          strokeDasharray="5 4"
          strokeWidth={2}
          fill="none"
        />
        <Area
          type="monotone"
          dataKey="actual"
          name="Actual (t)"
          stroke={ORANGE}
          strokeWidth={2.5}
          fill="url(#gActual)"
        />
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="plainline" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Weekly trend line (multi-site)
// ---------------------------------------------------------------------------
export function WeeklyTrend({
  data,
  series,
  height = 260,
}: {
  data: Record<string, number | string>[]
  series: { key: string; name: string; color?: string }[]
  height?: number
}) {
  const palette = [ORANGE, BLUE, GREEN, NAVY, '#a855f7']
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} width={44} />
        <Tooltip contentStyle={tooltipStyle} />
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stroke={s.color ?? palette[i % palette.length]}
            strokeWidth={2.5}
            dot={false}
            activeDot={{ r: 4 }}
          />
        ))}
        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} iconType="plainline" />
      </LineChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Horizontal site ranking bar
// ---------------------------------------------------------------------------
export function RankingBars({
  data,
  height = 260,
}: {
  data: { name: string; value: number; fill?: string }[]
  height?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 4, right: 16, left: 8, bottom: 0 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} horizontal={false} />
        <XAxis type="number" tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 11, fill: NAVY }}
          tickLine={false}
          axisLine={false}
          width={92}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f7f8fa' }} />
        <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.fill ?? ORANGE} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Generic vertical bars
// ---------------------------------------------------------------------------
export function VBars({
  data,
  dataKey = 'value',
  color = ORANGE,
  height = 240,
}: {
  data: Record<string, number | string>[]
  dataKey?: string
  color?: string
  height?: number
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={GRID} vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} />
        <YAxis tick={{ fontSize: 11, fill: AXIS }} tickLine={false} axisLine={false} width={40} />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#f7f8fa' }} />
        <Bar dataKey={dataKey} fill={color} radius={[6, 6, 0, 0]} barSize={26} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ---------------------------------------------------------------------------
// Donut
// ---------------------------------------------------------------------------
export function Donut({
  data,
  height = 220,
  centerLabel,
  centerValue,
}: {
  data: { name: string; value: number; color: string }[]
  height?: number
  centerLabel?: string
  centerValue?: string
}) {
  return (
    <div className="relative">
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius="62%"
            outerRadius="90%"
            paddingAngle={2}
            stroke="none"
          >
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} />
            ))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            iconType="circle"
            verticalAlign="bottom"
          />
        </PieChart>
      </ResponsiveContainer>
      {centerValue && (
        <div
          className="pointer-events-none absolute inset-x-0 flex flex-col items-center"
          style={{ top: height / 2 - 34 }}
        >
          <span className="text-2xl font-extrabold text-ink-900">{centerValue}</span>
          {centerLabel && (
            <span className="text-xs text-ink-400">{centerLabel}</span>
          )}
        </div>
      )}
    </div>
  )
}

export const chartColors = { ORANGE, NAVY, BLUE, GREEN }
