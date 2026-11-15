import "server-only";
import { createServiceClient, type Db } from "@trendtrack/db";

let client: Db | undefined;

/** Service-role client: alleen in server components, route handlers en server actions. */
export function serviceDb(): Db {
  client ??= createServiceClient();
  return client;
}
