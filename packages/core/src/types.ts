import { z } from "zod";

/** Bandbreedte voor elk geschat getal. We tonen nooit één hard getal. */
export const EstimateSchema = z.object({
  low: z.number().nonnegative(),
  mid: z.number().nonnegative(),
  high: z.number().nonnegative(),
  confidence: z.number().min(0).max(1),
  estimate: z.literal(true),
});
export type Estimate = z.infer<typeof EstimateSchema>;

export const PlatformSchema = z.enum(["meta", "tiktok", "google"]);
export type Platform = z.infer<typeof PlatformSchema>;

export const ShopStatusSchema = z.enum(["active", "blocked", "dead"]);
export type ShopStatus = z.infer<typeof ShopStatusSchema>;
