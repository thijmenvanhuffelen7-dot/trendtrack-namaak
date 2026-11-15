import { ToolError } from "./tools";

export function toolError(err: unknown) {
  if (err instanceof ToolError)
    return Response.json({ error: err.message }, { status: err.status });
  console.error("[public tool]", err);
  return Response.json({ error: "Er ging iets mis. Probeer het later opnieuw." }, { status: 500 });
}

export const limited = (resetAt: string) =>
  Response.json(
    {
      error:
        "Je hebt deze tool het afgelopen uur vaak gebruikt. Maak een gratis account voor meer, of probeer het over een uur opnieuw.",
      reset_at: resetAt,
    },
    {
      status: 429,
      headers: {
        "retry-after": String(Math.max(1, Math.ceil((Date.parse(resetAt) - Date.now()) / 1000))),
      },
    },
  );
