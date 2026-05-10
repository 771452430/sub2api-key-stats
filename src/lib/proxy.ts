import { NextRequest, NextResponse } from "next/server";

const HOP_BY_HOP_HEADERS = new Set([
  "connection",
  "content-length",
  "host",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade"
]);

function upstreamBaseUrl() {
  const value = process.env.SUB2API_UPSTREAM_URL || "http://sub2api:8080";
  return value.replace(/\/+$/, "");
}

function forwardedHeaders(request: NextRequest) {
  const headers = new Headers();

  request.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  headers.set("x-forwarded-host", request.headers.get("host") || "");
  headers.set("x-forwarded-proto", "https");
  return headers;
}

function responseHeaders(upstreamHeaders: Headers) {
  const headers = new Headers();

  upstreamHeaders.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  return headers;
}

export async function proxyToSub2Api(request: NextRequest, pathname: string) {
  const target = new URL(`${upstreamBaseUrl()}${pathname}`);
  request.nextUrl.searchParams.forEach((value, key) => {
    target.searchParams.append(key, value);
  });

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const body = hasBody ? await request.arrayBuffer() : undefined;

  const upstreamResponse = await fetch(target, {
    method: request.method,
    headers: forwardedHeaders(request),
    body,
    redirect: "manual"
  });

  return new NextResponse(upstreamResponse.body, {
    status: upstreamResponse.status,
    statusText: upstreamResponse.statusText,
    headers: responseHeaders(upstreamResponse.headers)
  });
}
