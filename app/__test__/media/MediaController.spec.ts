/// <reference types="@types/bun" />

import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { registries } from "../../src";
import { createApp } from "core/test/utils";
import { mergeObject, randomString } from "../../src/core/utils";
import type { TAppMediaConfig } from "../../src/media/media-schema";
import { StorageLocalAdapter } from "adapter/node/storage/StorageLocalAdapter";
import { assetsPath, assetsTmpPath } from "../helper";
import { disableConsoleLog, enableConsoleLog } from "core/utils/test";
import * as proto from "data/prototype";

beforeAll(() => {
   disableConsoleLog();
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

   test("entity upload with max_items and overwrite", async () => {
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
               {},
            ),
            data: {
               entities: {
                  posts: proto
                     .entity("posts", {
                        title: proto.text(),
                        cover: proto.medium(),
                     })
                     .toJSON(),
               },
            },
         },
      });
      await app.build();

      // create a post first
      const createRes = await app.server.request("/api/data/entity/posts", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ title: "Test Post" }),
      });
      expect(createRes.status).toBe(201);
      const { data: post } = (await createRes.json()) as any;

      const file = Bun.file(path);
      const uploadedFiles: string[] = [];

      // upload first file to entity (should succeed)
      const res1 = await app.server.request(`/api/media/entity/posts/${post.id}/cover`, {
         method: "POST",
         body: file,
      });
      expect(res1.status).toBe(201);
      const result1 = (await res1.json()) as any;
      uploadedFiles.push(result1.name);

      // upload second file without overwrite (should fail - max_items reached)
      const res2 = await app.server.request(`/api/media/entity/posts/${post.id}/cover`, {
         method: "POST",
         body: file,
      });
      expect(res2.status).toBe(400);
      const result2 = (await res2.json()) as any;
      expect(result2.error).toContain("Max items");

      // upload third file with overwrite=true (should succeed and delete old file)
      const res3 = await app.server.request(
         `/api/media/entity/posts/${post.id}/cover?overwrite=true`,
         {
            method: "POST",
            body: file,
         },
      );
      expect(res3.status).toBe(201);
      const result3 = (await res3.json()) as any;
      uploadedFiles.push(result3.name);

      // verify old file was deleted from storage
      const oldFile = Bun.file(assetsTmpPath + "/" + uploadedFiles[0]);
      expect(await oldFile.exists()).toBe(false);

      // verify new file exists
      const newFile = Bun.file(assetsTmpPath + "/" + uploadedFiles[1]);
      expect(await newFile.exists()).toBe(true);

      // cleanup
      await newFile.delete();
   });
});
