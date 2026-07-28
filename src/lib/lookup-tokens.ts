import { createHmac, randomBytes } from "crypto";

import { getAppPool } from "@/lib/db";

export type LookupTokenRecord = {
  apiKeyId: string;
  maskedApiKey: string;
  tokenHint: string;
  label: string | null;
  expiresAt: string | null;
};

export type CreatedLookupToken = LookupTokenRecord & {
  lookupSecret: string;
  createdAt: string;
};

type LookupTokenRow = {
  api_key_id: string;
  masked_api_key: string;
  token_hint: string;
  label: string | null;
  expires_at: Date | null;
};

type CreatedLookupTokenRow = LookupTokenRow & {
  created_at: Date;
};

const LOOKUP_SECRET_PATTERN = /^usage_[A-Za-z0-9_-]{32,}$/;

let ensureTablePromise: Promise<void> | undefined;

function getLookupTokenPepper() {
  const pepper = process.env.LOOKUP_TOKEN_PEPPER;

  if (!pepper) {
    throw new Error("LOOKUP_TOKEN_PEPPER is not configured");
  }

  return pepper;
}

function lookupSecretHash(lookupSecret: string) {
  return createHmac("sha256", getLookupTokenPepper()).update(lookupSecret).digest("hex");
}

function maskLookupSecret(lookupSecret: string) {
  return `${lookupSecret.slice(0, 12)}...${lookupSecret.slice(-6)}`;
}

function toIso(value: Date | null) {
  return value ? value.toISOString() : null;
}

function normalizeLabel(label: string | null | undefined) {
  const trimmed = label?.trim();
  return trimmed ? trimmed.slice(0, 120) : null;
}

export function generateLookupSecret() {
  return `usage_${randomBytes(32).toString("base64url")}`;
}

export function validateLookupSecretShape(lookupSecret: unknown) {
  if (typeof lookupSecret !== "string") {
    return null;
  }

  const trimmed = lookupSecret.trim();
  return LOOKUP_SECRET_PATTERN.test(trimmed) ? trimmed : null;
}

async function ensureLookupTokensTable() {
  const pool = getAppPool();

  await pool.query(`
    create table if not exists usage_lookup_tokens (
      id bigserial primary key,
      api_key_id bigint not null,
      token_hash text not null unique,
      token_hint text not null,
      masked_api_key text not null,
      label text,
      created_at timestamptz not null default now(),
      last_used_at timestamptz,
      expires_at timestamptz,
      revoked_at timestamptz
    )
  `);

  await pool.query(`
    create unique index if not exists usage_lookup_tokens_one_active_per_key_idx
      on usage_lookup_tokens (api_key_id)
      where revoked_at is null
  `);

  await pool.query(`
    create index if not exists usage_lookup_tokens_hash_active_idx
      on usage_lookup_tokens (token_hash)
      where revoked_at is null
  `);
}

export function ensureLookupTokenStorage() {
  if (!ensureTablePromise) {
    ensureTablePromise = ensureLookupTokensTable().catch((error) => {
      ensureTablePromise = undefined;
      throw error;
    });
  }

  return ensureTablePromise;
}

export async function createLookupToken({
  apiKeyId,
  maskedApiKey,
  label,
  expiresAt
}: {
  apiKeyId: string;
  maskedApiKey: string;
  label?: string | null;
  expiresAt?: Date | null;
}): Promise<CreatedLookupToken> {
  await ensureLookupTokenStorage();

  const lookupSecret = generateLookupSecret();
  const tokenHash = lookupSecretHash(lookupSecret);
  const tokenHint = maskLookupSecret(lookupSecret);
  const pool = getAppPool();
  const client = await pool.connect();

  try {
    await client.query("begin");
    await client.query(
      `
        update usage_lookup_tokens
        set revoked_at = now()
        where api_key_id = $1
          and revoked_at is null
      `,
      [apiKeyId]
    );

    const result = await client.query<CreatedLookupTokenRow>(
      `
        insert into usage_lookup_tokens (
          api_key_id,
          token_hash,
          token_hint,
          masked_api_key,
          label,
          expires_at
        )
        values ($1, $2, $3, $4, $5, $6)
        returning api_key_id, masked_api_key, token_hint, label, expires_at, created_at
      `,
      [apiKeyId, tokenHash, tokenHint, maskedApiKey, normalizeLabel(label), expiresAt ?? null]
    );

    await client.query("commit");

    const row = result.rows[0];

    return {
      apiKeyId: String(row.api_key_id),
      maskedApiKey: row.masked_api_key,
      tokenHint: row.token_hint,
      lookupSecret,
      label: row.label,
      expiresAt: toIso(row.expires_at),
      createdAt: row.created_at.toISOString()
    };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

export async function resolveLookupSecret(lookupSecret: string): Promise<LookupTokenRecord | null> {
  await ensureLookupTokenStorage();

  const tokenHash = lookupSecretHash(lookupSecret);
  const result = await getAppPool().query<LookupTokenRow>(
    `
      update usage_lookup_tokens
      set last_used_at = now()
      where token_hash = $1
        and revoked_at is null
        and (expires_at is null or expires_at > now())
      returning api_key_id, masked_api_key, token_hint, label, expires_at
    `,
    [tokenHash]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  return {
    apiKeyId: String(row.api_key_id),
    maskedApiKey: row.masked_api_key,
    tokenHint: row.token_hint,
    label: row.label,
    expiresAt: toIso(row.expires_at)
  };
}
