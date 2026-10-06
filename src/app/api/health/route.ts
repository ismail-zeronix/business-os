import { db } from "@/core/database/client";

/**
 * Liveness/readiness probe for the Docker healthcheck and the reverse proxy. Deliberately outside sign-in (a load balancer has no
 * session) and tells nothing about the data itself: just "the server answers" and "the database answers". Never cached.
 */
export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return Response.json({ status: "ok" }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ status: "error" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
