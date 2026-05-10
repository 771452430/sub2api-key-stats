import { NextRequest } from "next/server";

import { proxyToSub2Api } from "@/lib/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    path: string[];
  }>;
};

async function handle(request: NextRequest, context: RouteContext) {
  const params = await context.params;
  return proxyToSub2Api(request, `/v1/${params.path.join("/")}`);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
