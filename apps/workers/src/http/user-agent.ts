import { z } from "zod";

/** Onze bot-identiteit. Contactadres komt uit env zodat het per omgeving klopt. */
export function crawlerIdentity(env: NodeJS.ProcessEnv = process.env) {
  const { CRAWLER_CONTACT } = z
    .object({ CRAWLER_CONTACT: z.string().min(3).default("https://trendtrack.example/bot") })
    .parse(env);
  return {
    robotsToken: "TrendTrackBot",
    userAgent: `Mozilla/5.0 (compatible; TrendTrackBot/0.1; +${CRAWLER_CONTACT})`,
  };
}
