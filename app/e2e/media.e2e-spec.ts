// @ts-check
import { test, expect } from "@playwright/test";
import { testIds } from "../src/ui/lib/config";
import type { SchemaResponse } from "../src/modules/server/SystemController";
import { getAdapterConfig } from "./inc/adapters";

// Annotate entire file as serial.
test.describe.configure({ mode: "serial" });

const adapterConfig = getAdapterConfig();

test("can enable media", async ({ page }) => {
   await page.goto("/media/settings");

   // enable
   const enableToggle = page.locator("css=button#enabled");
   if ((await enableToggle.getAttribute("aria-checked")) !== "true") {
      await expect(enableToggle).toBeVisible();
      await enableToggle.click();
      await expect(enableToggle).toHaveAttribute("aria-checked", "true");

      // select local
      const adapterChoice = page.locator(`css=button#adapter-${adapterConfig.media_adapter}`);
      await expect(adapterChoice).toBeVisible();
      await adapterChoice.click();

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
      expect(body.config.media.adapter.type, "correct adapter").toBe(adapterConfig.media_adapter);
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
   await fileChooser.setFiles("./e2e/assets/image.jpg");
});
