import { z } from "zod";

const EmailEnvSchema = z.object({
  EMAIL_INBOX_DOMAIN: z
    .string({ error: "EMAIL_INBOX_DOMAIN ontbreekt (bv. inbox.jouwdomein.nl)" })
    .regex(
      /^[a-z0-9.-]+\.[a-z]{2,}$/i,
      "EMAIL_INBOX_DOMAIN moet een domein zijn, bv. inbox.jouwdomein.nl",
    )
    .transform((s) => s.toLowerCase()),
});

export function readEmailEnv(env: NodeJS.ProcessEnv = process.env) {
  return EmailEnvSchema.parse(env);
}
