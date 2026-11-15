import { afterAll, describe, expect, it } from "vitest";
import { affiliateStats, createAffiliate, validReferral } from "./affiliates";
import { processBillingEvent } from "./billing";
import { createServiceClient } from "./client";
import { getWorkspaceForUser } from "./queries/workspace";

const db = createServiceClient();
const users: string[] = [];

async function newUser() {
  const { data, error } = await db.auth.admin.createUser({
    email: `aff-${crypto.randomUUID()}@test.local`,
    email_confirm: true,
  });
  if (error) throw error;
  users.push(data.user.id);
  return { id: data.user.id, ws: (await getWorkspaceForUser(db, data.user.id))!.id };
}

afterAll(async () => {
  for (const u of users) await db.auth.admin.deleteUser(u);
});

describe("affiliates", () => {
  it("code aanmaken, geen dubbele codes, geen commissie op jezelf", async () => {
    const partner = await newUser();
    const buyer = await newUser();
    const code = `p-${crypto.randomUUID().slice(0, 8)}`;
    expect((await createAffiliate(db, partner.id, code))?.commission_pct).toBe(30);
    // Tweede keer: dezelfde rij terug; andere gebruiker met dezelfde code: null.
    expect((await createAffiliate(db, partner.id, "iets-anders"))?.code).toBe(code);
    expect(await createAffiliate(db, buyer.id, code)).toBeNull();

    expect(await validReferral(db, code, buyer.id)).toBe(code);
    expect(await validReferral(db, code, partner.id)).toBeNull();
    expect(await validReferral(db, "bestaat-niet", buyer.id)).toBeNull();
    expect(await validReferral(db, "Ongeldig!", buyer.id)).toBeNull();

    await processBillingEvent(
      db,
      "stripe",
      `evt_${crypto.randomUUID()}`,
      "customer.subscription.created",
      [
        {
          type: "subscription_upsert",
          eventAt: new Date().toISOString(),
          subscription: {
            workspaceId: buyer.ws,
            providerSubscriptionId: `sub_${crypto.randomUUID()}`,
            customerId: null,
            plan: "pro",
            interval: "month",
            seats: 1,
            status: "active",
            currentPeriodStart: null,
            currentPeriodEnd: null,
            cancelAtPeriodEnd: false,
            trialEndsAt: null,
            referral: code,
          },
        },
      ],
    );
    expect(await affiliateStats(db, code)).toEqual({ signups: 1, paying: 1 });
  });
});
