export type EmailType = "welcome" | "flow" | "campaign";

export interface EmailTiming {
  id: string;
  receivedAt: string; // ISO
}

export interface ClassifiedEmail {
  id: string;
  type: EmailType;
  /** Positie in de geautomatiseerde reeks (welcome + flow), 1-based. Null voor campagnes. */
  flowStep: number | null;
}

export const CLASSIFY = {
  /** Alles binnen 48 uur na inschrijven = welcome-reeks. */
  welcomeWindowHours: 48,
  /** Na zoveel dagen is er geen flow meer, alleen campagnes. */
  flowWindowDays: 30,
  /** Flows hebben vaste vertragingen in hele uren; zoveel minuten speling. */
  wholeHourToleranceMinutes: 10,
} as const;

/**
 * Classificeert de mails van één shop (heuristiek, zie docs/emails.md):
 * - welcome: binnen 48 uur na inschrijven
 * - flow: na de welcome-reeks, binnen 30 dagen, op een vaste afstand (hele uren, ±10 min)
 *   van de vorige geautomatiseerde mail
 * - campaign: de rest (op een kalendermoment verstuurd, los van onze inschrijving)
 * Zonder bekende inschrijfdatum is alles een campagne.
 */
export function classifyEmails(
  emails: EmailTiming[],
  subscribedAt: string | null,
): ClassifiedEmail[] {
  const sorted = [...emails].sort((a, b) => a.receivedAt.localeCompare(b.receivedAt));
  if (!subscribedAt) return sorted.map((e) => ({ id: e.id, type: "campaign", flowStep: null }));

  const sub = Date.parse(subscribedAt);
  let step = 0;
  let lastAutomated = sub;
  return sorted.map((e) => {
    const t = Date.parse(e.receivedAt);
    const sinceSub = (t - sub) / 3_600_000;
    if (sinceSub >= 0 && sinceSub <= CLASSIFY.welcomeWindowHours) {
      step++;
      lastAutomated = t;
      return { id: e.id, type: "welcome", flowStep: step };
    }
    const gapMinutes = (t - lastAutomated) / 60_000;
    if (sinceSub > 0 && sinceSub <= CLASSIFY.flowWindowDays * 24 && isWholeHours(gapMinutes)) {
      step++;
      lastAutomated = t;
      return { id: e.id, type: "flow", flowStep: step };
    }
    return { id: e.id, type: "campaign", flowStep: null };
  });
}

function isWholeHours(minutes: number): boolean {
  if (minutes < 60 - CLASSIFY.wholeHourToleranceMinutes) return false;
  const off = minutes % 60;
  return Math.min(off, 60 - off) <= CLASSIFY.wholeHourToleranceMinutes;
}
