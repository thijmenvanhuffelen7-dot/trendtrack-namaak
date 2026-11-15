import { describe, expect, it } from "vitest";
import { extractReviewCount } from "./reviews";

describe("extractReviewCount", () => {
  it("leest JSON-LD AggregateRating", () => {
    expect(
      extractReviewCount(`{"@type":"AggregateRating","ratingValue":"4.8","reviewCount":"1234"}`),
    ).toBe(1234);
  });
  it("leest de Judge.me all-reviews badge en neemt het hoogste getal", () => {
    const html = `<div class="jdgm-prev-badge" data-number-of-reviews="12"></div>
      <div class="jdgm-all-reviews-rating-wrapper" data-number-of-reviews="2318"></div>`;
    expect(extractReviewCount(html)).toBe(2318);
  });
  it("geeft null als er niets te vinden is", () => {
    expect(extractReviewCount("<html></html>")).toBeNull();
  });
});
