import { supabase } from '@/lib/supabase'

export interface VerificationRequestRow {
  id: string
  subject_id: string
  club_id: string | null
  kind: 'identity' | 'entity' | 'liveness' | 'references'
  status: 'pending' | 'in_review' | 'verified' | 'rejected' | 'none' | 'expired'
  reviewer_note: string | null
  payload: Record<string, unknown>
  submitted_at: string
  decided_at: string | null
}

const BUCKET = 'verification'

function requireSupabase() {
  if (!supabase) throw new Error('Supabase is not configured.')
  return supabase
}

export async function getMyVerificationRequests(
  subjectId: string,
): Promise<VerificationRequestRow[]> {
  const client = requireSupabase()
  const { data, error } = await client
    .from('verification_requests')
    .select('*')
    .eq('subject_id', subjectId)
    .order('submitted_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as VerificationRequestRow[]
}

/**
 * Upload a verification file (identity scan, CAC cert, FA letter, liveness
 * selfie clip). Files are private and auto-purged after 90 days.
 * Storage layout: verification/<owner_id>/<kind>/<uuid>.<ext>
 */
export async function uploadVerificationFile(
  ownerId: string,
  kind: string,
  file: File,
): Promise<string> {
  const client = requireSupabase()
  const ext = file.name.split('.').pop()?.toLowerCase() || 'bin'
  const storagePath = `${ownerId}/${kind}/${crypto.randomUUID()}.${ext}`
  const { error } = await client.storage
    .from(BUCKET)
    .upload(storagePath, file, { contentType: file.type, cacheControl: '3600', upsert: false })
  if (error) throw error
  return storagePath
}

/**
 * Submit a verification check. Uploads any attached files first, then records
 * a pending verification_request. Only an admin can later raise the tier.
 */
export async function submitVerificationCheck(input: {
  subjectId: string
  kind: 'identity' | 'entity' | 'liveness' | 'references'
  payload?: Record<string, unknown>
  files?: Array<{ kind: string; file: File }>
}): Promise<string> {
  const client = requireSupabase()

  const docPaths: Array<{ kind: string; storage_path: string }> = []
  for (const f of input.files ?? []) {
    const path = await uploadVerificationFile(input.subjectId, f.kind, f.file)
    docPaths.push({ kind: f.kind, storage_path: path })
  }

  const { data, error } = await client.rpc('submit_verification_request', {
    p_kind: input.kind,
    p_payload: input.payload ?? {},
    p_docs: docPaths,
  })
  if (error) {
    // Roll back uploaded files on RPC failure.
    if (docPaths.length) {
      await client.storage.from(BUCKET).remove(docPaths.map(d => d.storage_path)).catch(() => undefined)
    }
    throw error
  }
  return String(data)
}
