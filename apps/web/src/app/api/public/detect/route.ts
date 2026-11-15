import { serviceDb } from "@/lib/server/db";
import { limited, toolError } from "@/lib/public/respond";
import { detectPublic, hitPublicLimit, parseDomain } from "@/lib/public/tools";

export const dynamic = "force-dynamic";
export const maxDuration = 20;

/** Thema- en app-detector (gratis, zonder login). */
export async function GET(req: Request) {
  try {
    const domain = parseDomain(new URL(req.url).searchParams.get("domain"));
    const hit = await hitPublicLimit(serviceDb(), req.headers, "detect");
    if (!hit.allowed) return limited(hit.resetAt);
    return Response.json(await detectPublic(domain));
  } catch (err) {
    return toolError(err);
  }
}
