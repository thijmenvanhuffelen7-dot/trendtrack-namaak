import { describe, expect, it } from "vitest";
import { JOBS, PRIORITY } from "../jobs";
import { MemoryShopRepo } from "../test/helpers";
import {
  enqueueDomains,
  parseSeedList,
  requestLookup,
  runDiscovery,
  type JobQueue,
} from "./discovery";

function fakeQueue() {
  const sent: { name: string; data: object; options?: object }[] = [];
  const queue: JobQueue = {
    send: async (name, data, options) => {
      sent.push({ name, data, options });
      return `job-${sent.length}`;
    },
  };
  return { queue, sent };
}

describe("discovery", () => {
  it("parseert de seedlijst", () => {
    expect(
      parseSeedList("# commentaar\nshop.nl\nhttps://www.shop.nl/\n\nlocalhost\nmerk.be # notitie"),
    ).toEqual(["shop.nl", "merk.be"]);
  });

  it("zet domeinen in de wachtrij met singletonKey en prioriteit", async () => {
    const { queue, sent } = fakeQueue();
    await enqueueDomains(queue, ["Shop.nl", "ongeldig"], "seed");
    expect(sent).toEqual([
      {
        name: JOBS.shopDetect,
        data: { domain: "shop.nl" },
        options: { singletonKey: "shop.nl", priority: PRIORITY.seed, retryLimit: 2 },
      },
    ]);
  });

  it("geeft gebruikers-lookups de hoogste prioriteit", async () => {
    const { queue, sent } = fakeQueue();
    await requestLookup(queue, "nieuw.nl");
    expect(sent[0]?.options).toMatchObject({ priority: PRIORITY.user });
    expect(PRIORITY.user).toBeGreaterThan(PRIORITY.ads);
  });

  it("vindt onbekende landingsdomeinen uit ads", async () => {
    const repo = new MemoryShopRepo();
    await repo.upsertShop("bekend.nl", {});
    repo.ads.push(
      { landing_domain: "bekend.nl", shop_id: null },
      { landing_domain: "nieuw.nl", shop_id: null },
      { landing_domain: "nieuw.nl", shop_id: null },
    );
    const { queue, sent } = fakeQueue();
    expect(await runDiscovery({ repo, queue })).toEqual({ ads: 1, seed: 0 });
    expect(sent.map((s) => s.data)).toEqual([{ domain: "nieuw.nl" }]);
  });
});
