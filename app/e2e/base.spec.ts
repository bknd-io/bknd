// @ts-check
import { test, expect } from "@playwright/test";
import { testIds } from "../src/ui/lib/config";

test("start page has expected title", async ({ page }) => {
   await page.goto("/");
   await expect(page).toHaveTitle(/BKND/);
});

test("start page has expected heading", async ({ page }) => {
   await page.goto("/");

   // Example of checking if a heading with "No entity selected" exists and is visible
   const heading = page.getByRole("heading", { name: /No entity selected/i });
   await expect(heading).toBeVisible();
});

test("modal opens on button click", async ({ page }) => {
   await page.goto("/");
   await page.getByTestId(testIds.data.btnCreateEntity).click();
   await expect(page.getByRole("dialog")).toBeVisible();
});
