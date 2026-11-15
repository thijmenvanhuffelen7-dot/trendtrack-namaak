import { expect, test } from "@playwright/test";

test("calculator rekent in de browser", async ({ page }) => {
  await page.goto("/tools/winstmarge-calculator");
  await page.fill("#c-price", "60");
  await expect(page.locator("ul[aria-live]")).toContainText("€ 27,95");
});

test("opt-out-verzoek indienen", async ({ page }) => {
  await page.goto("/opt-out");
  await page.fill("#oo-domain", `e2e-${Date.now()}.nl`);
  await page.fill("#oo-email", "eigenaar@example.com");
  await page.check("#oo-owner");
  await page.click("button:has-text('Verwijder mijn shop')");
  await expect(page.getByRole("status")).toContainText("Ontvangen");
});

test("sitemap, robots en security headers", async ({ request }) => {
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/tools/clv-calculator");
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /app");
  const res = await request.get("/");
  expect(res.headers()["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(res.headers()["x-content-type-options"]).toBe("nosniff");
  expect(res.headers()["x-powered-by"]).toBeUndefined();
});
