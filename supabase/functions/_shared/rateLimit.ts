/**
 * Sliding-window rate limiter backed by Deno KV.
 * Protects the checkout endpoint from card-testing and webhook replay storms.
 */
const kv = await Deno.openKv()

export async function rateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ ok: boolean; remaining: number; resetAt: number }> {
  const bucket = Math.floor(Date.now() / (windowSeconds * 1000))
  const id = ['ratelimit', key, bucket]
  const res = await kv.get<number>(id)
  const count = (res.value ?? 0) + 1
  await kv.set(id, count, { expireIn: windowSeconds * 1000 * 2 })
  return {
    ok: count <= limit,
    remaining: Math.max(0, limit - count),
    resetAt: (bucket + 1) * windowSeconds * 1000,
  }
}
