/// <reference types="@types/bun" />

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { registries } from "../../src";
import { createApp } from "core/test/utils";
import { mergeObject, randomString } from "../../src/core/utils";
import type { TAppMediaConfig } from "../../src/media/media-schema";
import { StorageLocalAdapter } from "adapter/node/storage/StorageLocalAdapter";
import { assetsPath, assetsTmpPath } from "../helper";
import { disableConsoleLog, enableConsoleLog } from "core/utils/test";

beforeAll(() => {
   //disableConsoleLog();
   registries.media.register("local", StorageLocalAdapter);
});
afterAll(enableConsoleLog);

const path = `${assetsPath}/image.png`;

async function makeApp(mediaOverride: Partial<TAppMediaConfig> = {}) {
   const app = createApp({
      config: {
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

describe("MediaController", () => {
   test("accepts direct", async () => {
      const app = await makeApp();

      const file = Bun.file(path);
      const name = makeName("png");
      const res = await app.server.request("/api/media/upload/" + name, {
         method: "POST",
         body: file,
      });
      const result = (await res.json()) as any;
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

   test("audio files", async () => {
      const app = await makeApp();
      const file = Bun.file(`${assetsPath}/test.mp3`);
      const name = makeName("mp3");
      const res = await app.server.request("/api/media/upload/" + name, {
         method: "POST",
         body: file,
      });
      const result = (await res.json()) as any;
      expect(result.data.mime_type).toStartWith("audio/mpeg");
      expect(result.name).toBe(name);

      const destFile = Bun.file(assetsTmpPath + "/" + name);
      expect(destFile.exists()).resolves.toBe(true);
      await destFile.delete();
   });

   test("text files", async () => {
      const app = await makeApp();
      const file = Bun.file(`${assetsPath}/test.txt`);
      const name = makeName("txt");
      const res = await app.server.request("/api/media/upload/" + name, {
         method: "POST",
         body: file,
      });
      const result = (await res.json()) as any;
      expect(result.data.mime_type).toStartWith("text/plain");
      expect(result.name).toBe(name);

      const destFile = Bun.file(assetsTmpPath + "/" + name);
      expect(destFile.exists()).resolves.toBe(true);
      await destFile.delete();
   });
});
