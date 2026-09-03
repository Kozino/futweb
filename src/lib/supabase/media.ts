import { supabase } from '@/lib/supabase'

export type MediaKind = 'highlight' | 'full_match' | 'photo'

export interface MediaAssetRow {
  id: string
  player_id: string
  kind: MediaKind
  storage_path: string
  title: string
  duration_s: number | null
  size_bytes: number | null
  recorded_at: string | null
  recorded_location: string | null
  verified: boolean
  uploaded_at: string
  url?: string
}

export interface CreateMediaAssetInput {
  playerId: string
  file: File
  kind: MediaKind
  title: string
  recordedAt?: string | null
  recordedLocation?: string | null
}

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured.')
  }

  return supabase
}

export async function getPlayerMedia(playerId: string) {
  const client = requireSupabase()

  const { data, error } = await client
    .from('media_assets')
    .select('*')
    .eq('player_id', playerId)
    .order('uploaded_at', { ascending: false })

  if (error) throw error

  const assets = (data ?? []) as MediaAssetRow[]

  const withUrls = await Promise.all(
    assets.map(async asset => {
      const { data: signed, error: signedError } =
        await client.storage
          .from('media')
          .createSignedUrl(asset.storage_path, 60 * 60)

      if (signedError) {
        return asset
      }

      return {
        ...asset,
        url: signed.signedUrl,
      }
    }),
  )

  return withUrls
}

export async function createMediaAsset(input: CreateMediaAssetInput) {
  const client = requireSupabase()

  if (input.file.size > 500 * 1024 * 1024) {
    throw new Error('Media files must be 500MB or smaller.')
  }

  const allowedTypes = new Set([
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'image/jpeg',
    'image/png',
    'image/webp',
  ])

  if (!allowedTypes.has(input.file.type)) {
    throw new Error(
      'Unsupported file type. Use MP4, MOV, WebM, JPEG, PNG or WebP.',
    )
  }

  const extension =
    input.file.name.split('.').pop()?.toLowerCase() || 'bin'

  const storagePath = `${input.playerId}/${crypto.randomUUID()}.${extension}`

  const { error: uploadError } = await client.storage
    .from('media')
    .upload(storagePath, input.file, {
      cacheControl: '3600',
      upsert: false,
      contentType: input.file.type,
    })

  if (uploadError) throw uploadError

  const { data, error } = await client
    .from('media_assets')
    .insert({
      player_id: input.playerId,
      kind: input.kind,
      storage_path: storagePath,
      title: input.title.trim(),
      size_bytes: input.file.size,
      recorded_at: input.recordedAt || null,
      recorded_location: input.recordedLocation?.trim() || null,
      verified: false,
    })
    .select('*')
    .single()

  if (error) {
    await client.storage.from('media').remove([storagePath])
    throw error
  }

  const asset = data as MediaAssetRow

  const { data: signed, error: signedError } = await client.storage
    .from('media')
    .createSignedUrl(storagePath, 60 * 60)

  if (!signedError) {
    asset.url = signed.signedUrl
  }

  return asset
}

export async function deleteMediaAsset(asset: MediaAssetRow) {
  const client = requireSupabase()

  const { error: deleteError } = await client
    .from('media_assets')
    .delete()
    .eq('id', asset.id)
    .eq('player_id', asset.player_id)

  if (deleteError) throw deleteError

  const { error: storageError } = await client.storage
    .from('media')
    .remove([asset.storage_path])

  if (storageError) {
    console.error('Media storage cleanup failed:', storageError)
  }
}
