// @ts-check
import { test, expect } from "@playwright/test";
import { testIds } from "../src/ui/lib/config";
import type { SchemaResponse } from "../src/modules/server/SystemController";
// Annotate entire file as serial.
test.describe.configure({ mode: "serial" });

test("can enable media", async ({ page }) => {
   await page.goto("/media/settings");

   // enable
   const enableToggle = page.locator("css=button#enabled");
   if ((await enableToggle.getAttribute("aria-checked")) !== "true") {
      await expect(enableToggle).toBeVisible();
      await enableToggle.click();
      await expect(enableToggle).toHaveAttribute("aria-checked", "true");

      // select local
      const localAdapter = page.locator("css=button#adapter-local");
      await expect(localAdapter).toBeVisible();
      await localAdapter.click();

      // save
      const saveBtn = page.getByRole("button", { name: /Update/i });
      await expect(saveBtn).toBeVisible();

      // intercept network request, wait for it to finish and get the response
      const [request] = await Promise.all([
         page.waitForRequest((request) => request.url().includes("api/system/schema")),
         saveBtn.click(),
      ]);
      const response = await request.response();
      expect(response?.status(), "fresh config 200").toBe(200);
      const body = (await response?.json()) as SchemaResponse;
      expect(body.config.media.enabled, "media is enabled").toBe(true);
      expect(body.config.media.adapter.type, "adapter is local").toBe("local");
   }
});

test("can upload a file", async ({ page }) => {
   await page.goto("/media");
   // check any text to contain "Upload files"
   await expect(page.getByText(/Upload files/i)).toBeVisible();

   // upload a file from disk
   // Start waiting for file chooser before clicking. Note no await.
   const fileChooserPromise = page.waitForEvent("filechooser");
   await page.getByText("Upload file").click();
   const fileChooser = await fileChooserPromise;
   await fileChooser.setFiles("./e2e/assets/image1.png");
});
