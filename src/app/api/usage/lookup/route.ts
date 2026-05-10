import { NextRequest, NextResponse } from "next/server";

import { checkRateLimit } from "@/lib/rate-limit";
import {
  isPublicLookupError,
  lookupUsageByApiKey,
  normalizeRange,
  validateApiKeyShape
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

export async function POST(request: NextRequest) {
  const rateLimit = checkRateLimit(clientIp(request));

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, message: "查询太频繁了，请稍后再试" },
      { status: 429 }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "请求格式不正确" },
      { status: 400 }
    );
  }

  const payload = body as { apiKey?: unknown; range?: unknown };
  const apiKey = validateApiKeyShape(payload.apiKey);

  if (!apiKey) {
    return NextResponse.json(
      { ok: false, message: "请输入有效的 API Key" },
      { status: 400 }
    );
  }

  try {
    const data = await lookupUsageByApiKey(apiKey, normalizeRange(payload.range));
    return NextResponse.json({
      ok: true,
      data
    });
  } catch (error) {
    if (isPublicLookupError(error)) {
      return NextResponse.json(
        { ok: false, message: "这个 API Key 不可用或不存在" },
        { status: 404 }
      );
    }

    console.error("usage lookup failed", error instanceof Error ? error.message : "unknown error");
    return NextResponse.json(
      { ok: false, message: "查询失败，请稍后再试" },
      { status: 500 }
    );
  }
}
