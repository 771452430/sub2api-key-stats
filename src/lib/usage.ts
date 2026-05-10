import { getPool } from "@/lib/db";

export type UsageLookupResponse = {
  key: {
    name: string;
    maskedKey: string;
    createdAt: string;
    lastUsedAt: string | null;
    expiresAt: string | null;
  };
  summary: {
    totalRequests: number;
    activeDays: number;
    modelCount: number;
    endpointCount: number;
    imageRequests: number;
    totalCostUsd: number;
    firstRequestAt: string | null;
    lastRequestAt: string | null;
  };
  daily: Array<{
    date: string;
    requests: number;
    imageRequests: number;
  }>;
  models: Array<{
    model: string;
    requests: number;
    imageRequests: number;
  }>;
  endpoints: Array<{
    endpoint: string;
    requests: number;
  }>;
  recent: Array<{
    createdAt: string;
    model: string;
    endpoint: string;
    stream: boolean;
    imageCount: number;
    imageSize: string | null;
    serviceTier: string | null;
  }>;
};

type ApiKeyRow = {
  id: string;
  name: string;
  status: string;
  created_at: Date;
  last_used_at: Date | null;
  expires_at: Date | null;
};

type CountRow = Record<string, string | number | null>;

const PUBLIC_ERROR = "这个 API Key 不可用或不存在";

export function maskApiKey(apiKey: string) {
  if (apiKey.length <= 14) {
    return "sk-****";
  }

  return `${apiKey.slice(0, 6)}...${apiKey.slice(-6)}`;
}

export function validateApiKeyShape(apiKey: unknown) {
  if (typeof apiKey !== "string") {
    return null;
  }

  const trimmed = apiKey.trim();
  if (!/^sk-[A-Za-z0-9_-]{16,}$/.test(trimmed)) {
    return null;
  }

  return trimmed;
}

function toNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined) {
    return 0;
  }

  return Number(value);
}

function toIso(value: Date | string | null) {
  if (!value) {
    return null;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function assertUsableKey(row: ApiKeyRow | undefined): asserts row is ApiKeyRow {
  if (!row) {
    throw new Error(PUBLIC_ERROR);
  }

  if (row.status !== "active") {
    throw new Error(PUBLIC_ERROR);
  }

  if (row.expires_at && row.expires_at.getTime() <= Date.now()) {
    throw new Error(PUBLIC_ERROR);
  }
}

export function isPublicLookupError(error: unknown) {
  return error instanceof Error && error.message === PUBLIC_ERROR;
}

export async function lookupUsageByApiKey(apiKey: string): Promise<UsageLookupResponse> {
  const pool = getPool();

  const keyResult = await pool.query<ApiKeyRow>(
    `
      select id, name, status, created_at, last_used_at, expires_at
      from api_keys
      where key = $1
        and deleted_at is null
      limit 1
    `,
    [apiKey]
  );

  const key = keyResult.rows[0];
  assertUsableKey(key);

  const queryParams = [key.id];

  const [summaryResult, dailyResult, modelResult, endpointResult, recentResult] =
    await Promise.all([
      pool.query<CountRow>(
        `
          select
            count(*)::bigint as total_requests,
            count(distinct date(created_at at time zone 'Asia/Shanghai'))::bigint as active_days,
            count(distinct coalesce(nullif(requested_model, ''), model))::bigint as model_count,
            count(distinct coalesce(nullif(inbound_endpoint, ''), 'unknown'))::bigint as endpoint_count,
            coalesce(sum(actual_cost), 0)::numeric as total_cost_usd,
            count(*) filter (
              where coalesce(image_count, 0) > 0
                 or coalesce(model, '') ilike '%image%'
            )::bigint as image_requests,
            min(created_at) as first_request_at,
            max(created_at) as last_request_at
          from usage_logs
          where api_key_id = $1
        `,
        queryParams
      ),
      pool.query<CountRow>(
        `
          select
            to_char(date(created_at at time zone 'Asia/Shanghai'), 'YYYY-MM-DD') as date,
            count(*)::bigint as requests,
            count(*) filter (
              where coalesce(image_count, 0) > 0
                 or coalesce(model, '') ilike '%image%'
            )::bigint as image_requests
          from usage_logs
          where api_key_id = $1
          group by 1
          order by 1 asc
        `,
        queryParams
      ),
      pool.query<CountRow>(
        `
          select
            coalesce(nullif(requested_model, ''), model, 'unknown') as model,
            count(*)::bigint as requests,
            count(*) filter (
              where coalesce(image_count, 0) > 0
                 or coalesce(model, '') ilike '%image%'
            )::bigint as image_requests
          from usage_logs
          where api_key_id = $1
          group by 1
          order by requests desc
          limit 12
        `,
        queryParams
      ),
      pool.query<CountRow>(
        `
          select
            coalesce(nullif(inbound_endpoint, ''), 'unknown') as endpoint,
            count(*)::bigint as requests
          from usage_logs
          where api_key_id = $1
          group by 1
          order by requests desc
          limit 8
        `,
        queryParams
      ),
      pool.query<{
        created_at: Date;
        model: string | null;
        requested_model: string | null;
        inbound_endpoint: string | null;
        stream: boolean;
        image_count: number | null;
        image_size: string | null;
        service_tier: string | null;
      }>(
        `
          select
            created_at,
            model,
            requested_model,
            inbound_endpoint,
            stream,
            image_count,
            image_size,
            service_tier
          from usage_logs
          where api_key_id = $1
          order by created_at desc
          limit 20
        `,
        queryParams
      )
    ]);

  const summary = summaryResult.rows[0] ?? {};

  return {
    key: {
      name: key.name,
      maskedKey: maskApiKey(apiKey),
      createdAt: key.created_at.toISOString(),
      lastUsedAt: toIso(key.last_used_at),
      expiresAt: toIso(key.expires_at)
    },
    summary: {
      totalRequests: toNumber(summary.total_requests),
      activeDays: toNumber(summary.active_days),
      modelCount: toNumber(summary.model_count),
      endpointCount: toNumber(summary.endpoint_count),
      imageRequests: toNumber(summary.image_requests),
      totalCostUsd: toNumber(summary.total_cost_usd),
      firstRequestAt: toIso(summary.first_request_at as Date | string | null),
      lastRequestAt: toIso(summary.last_request_at as Date | string | null)
    },
    daily: dailyResult.rows.map((row) => ({
      date: String(row.date),
      requests: toNumber(row.requests),
      imageRequests: toNumber(row.image_requests)
    })),
    models: modelResult.rows.map((row) => ({
      model: String(row.model),
      requests: toNumber(row.requests),
      imageRequests: toNumber(row.image_requests)
    })),
    endpoints: endpointResult.rows.map((row) => ({
      endpoint: String(row.endpoint),
      requests: toNumber(row.requests)
    })),
    recent: recentResult.rows.map((row) => ({
      createdAt: row.created_at.toISOString(),
      model: row.requested_model || row.model || "unknown",
      endpoint: row.inbound_endpoint || "unknown",
      stream: row.stream,
      imageCount: row.image_count ?? 0,
      imageSize: row.image_size,
      serviceTier: row.service_tier
    }))
  };
}
