import type { Instrumentation } from "next";

/** Serverfouten naar monitoring (alleen als SENTRY_DSN gezet is, zie @trendtrack/core/monitoring). */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { reportError } = await import("@trendtrack/core/monitoring");
  // Alleen pad en methode: geen headers of query (daar kunnen tokens in staan).
  await reportError(err, {
    service: "web",
    tags: { route: context.routePath, kind: context.routeType, method: request.method },
    extra: { path: request.path.split("?")[0] },
  });
};
