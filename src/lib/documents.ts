import { clientDocs, newId } from '../demo/db'

/** Demo implementation of the client documents API over the in-memory store.
 *  Uploaded files are held as object URLs for the life of the tab. */

export type DocType = 'Progress Report' | 'Production Report' | 'Compliance Document' | 'Deliverable'

export interface ClientDocument {
  id: string
  siteId: string
  title: string
  docType: DocType
  fileName: string
  storagePath: string
  documentDate: string
  url: string | null
}

export async function fetchClientDocuments(siteId: string): Promise<ClientDocument[]> {
  return clientDocs
    .filter((d) => d.siteId === siteId)
    .sort((a, b) => (a.documentDate < b.documentDate ? 1 : -1))
    .map((d) => ({
      id: d.id,
      siteId: d.siteId,
      title: d.title,
      docType: d.docType,
      fileName: d.fileName,
      storagePath: d.id,
      documentDate: d.documentDate,
      url: d.url,
    }))
}

export async function uploadClientDocument(input: {
  siteId: string
  title: string
  docType: DocType
  documentDate: string
  file: File
  uploadedById?: string
}): Promise<{ error: string | null }> {
  clientDocs.unshift({
    id: newId('doc'),
    siteId: input.siteId,
    title: input.title,
    docType: input.docType,
    fileName: input.file.name,
    documentDate: input.documentDate,
    url: URL.createObjectURL(input.file),
  })
  return { error: null }
}

export async function deleteClientDocument(id: string, _storagePath: string): Promise<{ error: string | null }> {
  const i = clientDocs.findIndex((d) => d.id === id)
  if (i >= 0) clientDocs.splice(i, 1)
  return { error: null }
}
