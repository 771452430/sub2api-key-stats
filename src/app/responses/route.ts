import { NextRequest } from "next/server";

import { proxyToSub2Api } from "@/lib/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: NextRequest) {
  return proxyToSub2Api(request, "/responses");
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
