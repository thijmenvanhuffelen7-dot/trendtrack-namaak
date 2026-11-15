import { describe, expect, it } from "vitest";
import { diffSnapshots, type ProductState } from "./snapshot-diff";

const p = (id: string, o: Partial<ProductState> = {}): ProductState => ({
  external_id: id,
  price: 20,
  available_variants: 3,
  total_variants: 3,
  position: null,
  ...o,
});

describe("diffSnapshots", () => {
  it("vindt nieuwe, verdwenen, prijswijzigingen, uitverkopen en bestsellerverschuivingen", () => {
    const prev = [
      p("a", { position: 1 }),
      p("b", { price: 30 }),
      p("c"),
      p("d", { available_variants: 1 }),
    ];
    const curr = [
      p("a", { position: 3 }),
      p("b", { price: 25 }),
      p("c", { available_variants: 1 }),
      p("d", { available_variants: 2 }),
      p("e"),
    ];
    const d = diffSnapshots(prev, curr);
    expect(d.newProducts).toEqual(["e"]);
    expect(d.removedProducts).toEqual([]);
    expect(d.priceChanges).toEqual([{ external_id: "b", from: 30, to: 25 }]);
    expect(d.sellouts).toEqual([{ external_id: "c", variants: 2, price: 20 }]);
    expect(d.selloutValue).toBe(40);
    expect(d.restocks).toEqual(["d"]);
    expect(d.bestsellerMoves).toEqual([{ external_id: "a", from: 1, to: 3 }]);
  });

  it("telt geen uitverkoop als het aantal varianten verandert", () => {
    const d = diffSnapshots([p("a")], [p("a", { available_variants: 1, total_variants: 1 })]);
    expect(d.sellouts).toEqual([]);
  });

  it("ziet verdwenen producten", () => {
    expect(diffSnapshots([p("a"), p("b")], [p("a")]).removedProducts).toEqual(["b"]);
  });
});
