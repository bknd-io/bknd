/// <reference types="@types/bun" />

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { createApp, registries } from "../../src";
import { mergeObject, randomString } from "../../src/core/utils";
import type { TAppMediaConfig } from "../../src/media/media-schema";
import { StorageLocalAdapter } from "adapter/node/storage/StorageLocalAdapter";
import { assetsPath, assetsTmpPath, disableConsoleLog, enableConsoleLog } from "../helper";

beforeAll(() => {
   registries.media.register("local", StorageLocalAdapter);
});

const path = `${assetsPath}/image.png`;

async function makeApp(mediaOverride: Partial<TAppMediaConfig> = {}) {
   const app = createApp({
      initialConfig: {
         media: mergeObject(
            {
               enabled: true,
               adapter: {
                  type: "local",
                  config: {
                     path: assetsTmpPath,
                  },
               },
            },
            mediaOverride,
         ),
      },
   });

   await app.build();
   return app;
}

function makeName(ext: string) {
   return randomString(10) + "." + ext;
}

beforeAll(disableConsoleLog);
afterAll(enableConsoleLog);

describe("MediaController", () => {
   test("accepts direct", async () => {
      const app = await makeApp();
      console.log("app", app);

      const file = Bun.file(path);
      const name = makeName("png");
      const res = await app.server.request("/api/media/upload/" + name, {
         method: "POST",
         body: file,
      });
      const result = (await res.json()) as any;
      console.log(result);
      expect(result.name).toBe(name);

      const destFile = Bun.file(assetsTmpPath + "/" + name);
      expect(destFile.exists()).resolves.toBe(true);
      await destFile.delete();
   });

   test("accepts form data", async () => {
      const app = await makeApp();

      const file = Bun.file(path);
      const name = makeName("png");
      const form = new FormData();
      form.append("file", file);

      const res = await app.server.request("/api/media/upload/" + name, {
         method: "POST",
         body: form,
      });
      const result = (await res.json()) as any;
      expect(result.name).toBe(name);

      const destFile = Bun.file(assetsTmpPath + "/" + name);
      expect(destFile.exists()).resolves.toBe(true);
      await destFile.delete();
   });

   test("limits body", async () => {
      const app = await makeApp({ storage: { body_max_size: 1 } });

      const file = await Bun.file(path);
      const name = makeName("png");
      const res = await app.server.request("/api/media/upload/" + name, {
         method: "POST",
         body: file,
      });

      expect(res.status).toBe(413);
      expect(await Bun.file(assetsTmpPath + "/" + name).exists()).toBe(false);
   });
});
