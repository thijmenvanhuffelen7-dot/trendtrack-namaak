/**
 * Cursor = base64url van { p: pagina, l: limit }. Opaak voor de gebruiker, zodat we later naar
 * keyset-paginering kunnen zonder de API te breken.
 */
export function encodeCursor(page: number, limit: number): string {
  return Buffer.from(JSON.stringify({ p: page, l: limit })).toString("base64url");
}

export function decodeCursor(cursor: string | undefined): { page: number; limit: number } | null {
  if (!cursor) return null;
  try {
    const v = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as {
      p?: unknown;
      l?: unknown;
    };
    if (
      Number.isInteger(v.p) &&
      Number.isInteger(v.l) &&
      (v.p as number) >= 1 &&
      (v.l as number) >= 1 &&
      (v.l as number) <= 100
    ) {
      return { page: v.p as number, limit: v.l as number };
    }
  } catch {
    // ongeldig
  }
  return null;
}

/** Pagina + limit uit query (cursor wint), en de volgende cursor als er meer is. */
export function pageFrom(query: { limit: number; cursor?: string }) {
  const c = decodeCursor(query.cursor);
  return {
    page: c?.page ?? 1,
    perPage: c?.limit ?? query.limit,
    invalidCursor: Boolean(query.cursor && !c),
  };
}

export function nextCursor(page: number, perPage: number, total: number): string | null {
  return page * perPage < total ? encodeCursor(page + 1, perPage) : null;
}
