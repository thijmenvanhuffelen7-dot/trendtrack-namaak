import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("voegt klassen samen en lost tailwind-conflicten op", () => {
    expect(cn("px-2", false && "hidden", "px-4")).toBe("px-4");
  });
});
