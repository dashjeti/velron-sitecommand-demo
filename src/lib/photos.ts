import { reports } from '../demo/db'

/** Demo implementation of the site photos API over the in-memory store. */

export interface SitePhoto {
  path: string
  url: string
  caption: string | null
  date: string
}

export async function fetchSitePhotos(siteId: string, limit = 8): Promise<SitePhoto[]> {
  return reports
    .filter((r) => r.siteId === siteId && r.photoUrl)
    .sort((a, b) => (a.date < b.date ? 1 : -1))
    .slice(0, limit)
    .map((r) => ({
      path: `${r.id}-photo`,
      url: r.photoUrl!,
      caption: r.photoCaption,
      date: r.date,
    }))
}
