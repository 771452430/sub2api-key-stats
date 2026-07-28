import { timingSafeEqual } from "crypto";
import { NextRequest, NextResponse } from "next/server";

import { createLookupToken } from "@/lib/lookup-tokens";
import {
  findUsableApiKeyByApiKey,
  isPublicLookupError,
  validateApiKeyShape
} from "@/lib/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...init?.headers
    }
  });
}

function bearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization") ?? "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() ?? null;
}

function secureEquals(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function isAuthorized(request: NextRequest) {
  const expectedToken = process.env.LOOKUP_ADMIN_TOKEN;

  if (!expectedToken) {
    throw new Error("LOOKUP_ADMIN_TOKEN is not configured");
  }

  const token = bearerToken(request);
  return token ? secureEquals(token, expectedToken) : false;
}

function normalizeLabel(label: unknown) {
  if (label === undefined || label === null) {
    return null;
  }

  if (typeof label !== "string") {
    return null;
  }

  const trimmed = label.trim();
  return trimmed ? trimmed : null;
}

function parseExpiresAt(expiresAt: unknown) {
  if (expiresAt === undefined || expiresAt === null || expiresAt === "") {
    return null;
  }

  if (typeof expiresAt !== "string") {
    return undefined;
  }

  const parsed = new Date(expiresAt);

  if (Number.isNaN(parsed.getTime()) || parsed.getTime() <= Date.now()) {
    return undefined;
  }

  return parsed;
}

export async function POST(request: NextRequest) {
  try {
    if (!isAuthorized(request)) {
      return jsonResponse(
        { ok: false, message: "未授权" },
        { status: 401 }
      );
    }
  } catch (error) {
    console.error("lookup token admin auth failed", error instanceof Error ? error.message : "unknown error");
    return jsonResponse(
      { ok: false, message: "管理员配置缺失" },
      { status: 500 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(
      { ok: false, message: "请求格式不正确" },
      { status: 400 }
    );
  }

  const payload = body as { apiKey?: unknown; label?: unknown; expiresAt?: unknown };
  const apiKey = validateApiKeyShape(payload.apiKey);
  const label = normalizeLabel(payload.label);
  const expiresAt = parseExpiresAt(payload.expiresAt);

  if (!apiKey) {
    return jsonResponse(
      { ok: false, message: "请输入有效的 API Key" },
      { status: 400 }
    );
  }

  if (expiresAt === undefined) {
    return jsonResponse(
      { ok: false, message: "expiresAt 必须是未来时间" },
      { status: 400 }
    );
  }

  try {
    const apiKeyInfo = await findUsableApiKeyByApiKey(apiKey);
    const token = await createLookupToken({
      apiKeyId: apiKeyInfo.id,
      maskedApiKey: apiKeyInfo.maskedKey,
      label,
      expiresAt
    });

    return jsonResponse({
      ok: true,
      data: {
        lookupSecret: token.lookupSecret,
        tokenHint: token.tokenHint,
        label: token.label,
        expiresAt: token.expiresAt,
        createdAt: token.createdAt,
        apiKey: {
          id: apiKeyInfo.id,
          name: apiKeyInfo.name,
          maskedKey: apiKeyInfo.maskedKey,
          expiresAt: apiKeyInfo.expiresAt
        }
      }
    });
  } catch (error) {
    if (isPublicLookupError(error)) {
      return jsonResponse(
        { ok: false, message: "这个 API Key 不可用或不存在" },
        { status: 404 }
      );
    }

    console.error("lookup token creation failed", error instanceof Error ? error.message : "unknown error");
    return jsonResponse(
      { ok: false, message: "生成查询秘钥失败，请稍后再试" },
      { status: 500 }
    );
  }
}
