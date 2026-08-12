/** SiteCommand wordmark: pure text, no logo image, per the white-label brief. */
export function SiteCommandLogo({
  height = 24,
  light = false,
}: {
  height?: number
  light?: boolean
}) {
  return (
    <span
      className="inline-flex items-baseline font-extrabold tracking-tight"
      style={{ fontSize: height, color: light ? '#ffffff' : '#0f1b3d', lineHeight: 1 }}
    >
      Site<span style={{ color: light ? '#93c5fd' : '#1d4ed8' }}>Command</span>
    </span>
  )
}

/** Velron developer logo (real PNG). Set `link` to link to the Velron site. */
export function VelronLogo({
  height = 18,
  light = false,
  link = false,
}: {
  height?: number
  light?: boolean
  link?: boolean
}) {
  const mark = (
    <img
      src="/velron-powered-by.png"
      alt="Velron Digital"
      style={{
        height,
        width: 'auto',
        objectFit: 'contain',
        filter: light ? 'brightness(0) invert(1)' : 'none',
      }}
      draggable={false}
    />
  )

  if (!link) return mark

  return (
    <a
      href="https://velrondigital.online"
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-baseline transition-opacity hover:opacity-80"
      aria-label="Velron Digital, opens in a new tab"
    >
      {mark}
    </a>
  )
}
