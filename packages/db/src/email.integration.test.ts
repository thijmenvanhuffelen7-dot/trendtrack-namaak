import { afterAll, describe, expect, it } from "vitest";
import { createServiceClient } from "./client";
import {
  EMAIL_BUCKET,
  getOrCreateSeedInbox,
  ingestInboundEmail,
  markSubscribed,
} from "./email-ingest";

const INBOX = "inbox.test.local";
const SHOP = "bosbad.be"; // uit supabase/seed.sql

describe("e-mail library", () => {
  const db = createServiceClient();
  let shopId = "";

  afterAll(async () => {
    const { data } = await db.from("emails").select("html_storage_path").eq("shop_id", shopId);
    const paths = (data ?? []).map((e) => e.html_storage_path).filter((p): p is string => !!p);
    if (paths.length) await db.storage.from(EMAIL_BUCKET).remove(paths);
    await db.from("emails").delete().eq("shop_id", shopId);
    await db.from("seed_inboxes").delete().eq("shop_id", shopId);
  });

  it("koppelt een mail aan de juiste shop, schoont hem op en classificeert hem", async () => {
    const inbox = await getOrCreateSeedInbox(db, SHOP, INBOX);
    shopId = inbox.shop_id;
    expect(inbox.address).toMatch(/^bosbad-verzorging-[a-z2-9]{6}@inbox\.test\.local$/);
    expect((await getOrCreateSeedInbox(db, SHOP, INBOX)).address).toBe(inbox.address); // idempotent

    const subscribed = new Date(Date.now() - 60 * 60_000);
    await markSubscribed(db, SHOP, subscribed);

    const welcome = await ingestInboundEmail(
      db,
      {
        to: ["iemand@anders.nl", inbox.address],
        from: "hallo@bosbad.be",
        subject: "Welkom bij Bosbad 🌲",
        html: `<div style="display:none">Je kortingscode staat erin</div><p>Hoi ${inbox.address}</p><script>alert(1)</script><a href="https://bosbad.be/unsubscribe?u=1">Afmelden</a>`,
        text: null,
        messageId: "<welkom-1@klaviyo>",
        receivedAt: new Date().toISOString(),
      },
      INBOX,
    );
    expect(welcome).toMatchObject({ status: "stored", shopId, type: "welcome", flowStep: 1 });

    const { data: row } = await db.from("emails").select("*").eq("id", welcome.emailId!).single();
    expect(row).toMatchObject({
      subject: "Welkom bij Bosbad 🌲",
      preheader: "Je kortingscode staat erin",
      from_address: "hallo@bosbad.be",
    });

    const { data: file } = await db.storage.from(EMAIL_BUCKET).download(row!.html_storage_path!);
    const html = await file!.text();
    expect(html).not.toContain("<script");
    expect(html).not.toContain(inbox.address);
    expect(html).not.toContain("unsubscribe?u=1");

    // Dezelfde mail nog eens (provider retry) => geen dubbele rij
    const dupe = await ingestInboundEmail(
      db,
      {
        to: [inbox.address],
        from: "hallo@bosbad.be",
        subject: "x",
        html: "x",
        text: null,
        messageId: "<welkom-1@klaviyo>",
        receivedAt: new Date().toISOString(),
      },
      INBOX,
    );
    expect(dupe).toMatchObject({ status: "duplicate", emailId: welcome.emailId });

    // Een week later op een willekeurig tijdstip => campagne
    const campaign = await ingestInboundEmail(
      db,
      {
        to: [inbox.address],
        from: "nieuws@bosbad.be",
        subject: "Black Friday",
        html: null,
        text: "Tot 40% korting",
        messageId: "<bf@klaviyo>",
        receivedAt: new Date(subscribed.getTime() + 7 * 86_400_000 + 37 * 60_000).toISOString(),
      },
      INBOX,
    );
    expect(campaign).toMatchObject({ status: "stored", type: "campaign", flowStep: null });
  });

  it("weigert mail voor een onbekend adres en logt het", async () => {
    const r = await ingestInboundEmail(
      db,
      {
        to: [`bestaatniet-xxxxxx@${INBOX}`],
        from: "spam@x.nl",
        subject: "spam",
        html: "x",
        text: null,
        messageId: null,
        receivedAt: new Date().toISOString(),
      },
      INBOX,
    );
    expect(r.status).toBe("unknown_recipient");
    const { data } = await db
      .from("inbound_rejects")
      .select("reason")
      .eq("subject", "spam")
      .limit(1)
      .single();
    expect(data!.reason).toBe("onbekend seed-adres");
    await db.from("inbound_rejects").delete().eq("subject", "spam");
  });
});
