/** Toestand van één product op één dag. */
export interface ProductState {
  external_id: string;
  price: number | null;
  available_variants: number;
  total_variants: number;
  position: number | null;
}

export interface PriceChange {
  external_id: string;
  from: number;
  to: number;
}

export interface Sellout {
  external_id: string;
  /** Aantal varianten dat van beschikbaar naar uitverkocht ging. */
  variants: number;
  price: number;
}

export interface SnapshotDiff {
  newProducts: string[];
  removedProducts: string[];
  priceChanges: PriceChange[];
  sellouts: Sellout[];
  restocks: string[];
  /** Som van prijs × uitverkochte varianten: een ondergrens voor wat er verkocht is. */
  selloutValue: number;
  bestsellerMoves: { external_id: string; from: number | null; to: number | null }[];
}

/** Vergelijkt de product-toestand van gisteren met vandaag. Puur. */
export function diffSnapshots(prev: ProductState[], curr: ProductState[]): SnapshotDiff {
  const before = new Map(prev.map((p) => [p.external_id, p]));
  const now = new Map(curr.map((p) => [p.external_id, p]));

  const diff: SnapshotDiff = {
    newProducts: [],
    removedProducts: [],
    priceChanges: [],
    sellouts: [],
    restocks: [],
    selloutValue: 0,
    bestsellerMoves: [],
  };

  for (const c of curr) {
    const p = before.get(c.external_id);
    if (!p) {
      diff.newProducts.push(c.external_id);
      continue;
    }
    if (p.price !== null && c.price !== null && Math.abs(p.price - c.price) >= 0.01) {
      diff.priceChanges.push({ external_id: c.external_id, from: p.price, to: c.price });
    }
    const soldOut = p.available_variants - c.available_variants;
    // Alleen tellen als het aantal varianten gelijk bleef; anders is er iets aan het product veranderd.
    if (soldOut > 0 && p.total_variants === c.total_variants) {
      const price = c.price ?? p.price ?? 0;
      diff.sellouts.push({ external_id: c.external_id, variants: soldOut, price });
      diff.selloutValue += soldOut * price;
    } else if (soldOut < 0) {
      diff.restocks.push(c.external_id);
    }
    if (p.position !== c.position && (p.position !== null || c.position !== null)) {
      diff.bestsellerMoves.push({ external_id: c.external_id, from: p.position, to: c.position });
    }
  }
  for (const p of prev) if (!now.has(p.external_id)) diff.removedProducts.push(p.external_id);

  diff.selloutValue = round2(diff.selloutValue);
  return diff;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}
