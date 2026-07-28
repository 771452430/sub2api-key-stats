import { NextRequest, NextResponse } from "next/server";

import { resolveLookupSecret, validateLookupSecretShape } from "@/lib/lookup-tokens";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  isPublicLookupError,
  lookupUsageByApiKeyId
} from "@/lib/usage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function clientIp(request: NextRequest) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip") || "unknown";
}

function jsonResponse(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, {
    ...init,
    headers: {
      "Cache-Control": "no-store",
      ...init?.headers
    }
  });
}

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(clientIp(request));

  if (!rateLimit.allowed) {
    return jsonResponse(
      { ok: false, message: "查询太频繁了，请稍后再试" },
      { status: 429 }
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

  const payload = body as { lookupSecret?: unknown };
  const lookupSecret = validateLookupSecretShape(payload.lookupSecret);

  if (!lookupSecret) {
    return jsonResponse(
      { ok: false, message: "请输入有效的查询秘钥" },
      { status: 400 }
    );
  }

  try {
    const lookupToken = await resolveLookupSecret(lookupSecret);

    if (!lookupToken) {
      return jsonResponse(
        { ok: false, message: "这个查询秘钥不可用或不存在" },
        { status: 404 }
      );
    }

    const data = await lookupUsageByApiKeyId(lookupToken.apiKeyId, lookupToken.maskedApiKey);
    return jsonResponse({
      ok: true,
      data
    });
  } catch (error) {
    if (isPublicLookupError(error)) {
      return jsonResponse(
        { ok: false, message: "这个查询秘钥不可用或不存在" },
        { status: 404 }
      );
    }

    console.error("usage lookup failed", error instanceof Error ? error.message : "unknown error");
    return jsonResponse(
      { ok: false, message: "查询失败，请稍后再试" },
      { status: 500 }
    );
  }
}
