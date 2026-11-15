import { readFile } from "node:fs/promises";

/** Leest een zoekwoordenlijst: één per regel, # voor commentaar. */
export function parseKeywords(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/\r?\n/)
        .map((l) => l.replace(/#.*$/, "").trim().toLowerCase())
        .filter((l) => l.length >= 2),
    ),
  ];
}

export async function readKeywords(path: string): Promise<string[]> {
  return parseKeywords(await readFile(path, "utf8"));
}
