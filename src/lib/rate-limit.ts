type HitBucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, HitBucket>();

export function checkRateLimit(identifier: string) {
  const limit = Number(process.env.USAGE_LOOKUP_RATE_LIMIT ?? "30");
  const windowSeconds = Number(process.env.USAGE_LOOKUP_WINDOW_SECONDS ?? "60");
  const now = Date.now();
  const resetAt = now + windowSeconds * 1000;
  const existing = buckets.get(identifier);

  if (!existing || existing.resetAt <= now) {
    buckets.set(identifier, { count: 1, resetAt });
    return { allowed: true, remaining: Math.max(limit - 1, 0), resetAt };
  }

  if (existing.count >= limit) {
    return { allowed: false, remaining: 0, resetAt: existing.resetAt };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: Math.max(limit - existing.count, 0),
    resetAt: existing.resetAt
  };
}
