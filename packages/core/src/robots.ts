/**
 * Minimale robots.txt-parser (RFC 9309): groepen per user-agent, Allow/Disallow met
 * `*` en `$`, langste match wint, bij gelijke lengte wint Allow.
 */
export interface RobotsRules {
  isAllowed(path: string): boolean;
  crawlDelaySeconds: number | null;
}

interface Rule {
  allow: boolean;
  pattern: string;
  re: RegExp;
}

export function parseRobots(txt: string, userAgentToken: string): RobotsRules {
  const groups: { agents: string[]; rules: Rule[]; crawlDelay: number | null }[] = [];
  let current: (typeof groups)[number] | null = null;
  let lastWasAgent = false;

  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (key === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [], crawlDelay: null };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!current) continue;
    if (key === "allow" || key === "disallow") {
      if (value === "") continue; // "Disallow:" (leeg) = alles toegestaan
      current.rules.push({ allow: key === "allow", pattern: value, re: patternToRegExp(value) });
    } else if (key === "crawl-delay") {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) current.crawlDelay = n;
    }
  }

  const token = userAgentToken.toLowerCase();
  const specific = groups.filter((g) => g.agents.some((a) => a !== "*" && token.includes(a)));
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes("*"));
  const rules = chosen.flatMap((g) => g.rules);
  const crawlDelay = chosen.map((g) => g.crawlDelay).find((d) => d !== null) ?? null;

  return {
    crawlDelaySeconds: crawlDelay,
    isAllowed(path: string) {
      let best: Rule | null = null;
      for (const r of rules) {
        if (!r.re.test(path)) continue;
        if (
          !best ||
          r.pattern.length > best.pattern.length ||
          (r.pattern.length === best.pattern.length && r.allow)
        ) {
          best = r;
        }
      }
      return best ? best.allow : true;
    },
  };
}

function patternToRegExp(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern)
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}
