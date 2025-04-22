/// <reference types="@types/bun" />
import { describe, expect, it } from "bun:test";
import { Hono } from "hono";
import { getFileFromContext, isFile, isReadableStream } from "core/utils";
import { MediaApi } from "media/api/MediaApi";
import { assetsPath, assetsTmpPath } from "../helper";

const mockedBackend = new Hono()
   .basePath("/api/media")
   .post("/upload/:name", async (c) => {
      const { name } = c.req.param();
      const body = await getFileFromContext(c);
      return c.json({ name, is_file: isFile(body), size: body.size });
   })
   .get("/file/:name", async (c) => {
      const { name } = c.req.param();
      const file = Bun.file(`${assetsPath}/${name}`);
      return new Response(file, {
         headers: {
            "Content-Type": file.type,
            "Content-Length": file.size.toString(),
         },
      });
   });

describe("MediaApi", () => {
   it("should give correct file upload url", () => {
      const host = "http://localhost";
      const basepath = "/api/media";
      // @ts-ignore tests
      const api = new MediaApi({
         host,
         basepath,
      });
      expect(api.getFileUploadUrl({ path: "path" } as any)).toBe(`${host}${basepath}/upload/path`);
   });

   it("should have correct upload headers", () => {
      // @ts-ignore tests
      const api = new MediaApi({
         token: "token",
         token_transport: "header",
      });
      expect(api.getUploadHeaders().get("Authorization")).toBe("Bearer token");
   });

   it("should return empty headers if not using `header` transport", () => {
      expect(
         new MediaApi({
            token_transport: "cookie",
         })
            .getUploadHeaders()
            .has("Authorization"),
      ).toBe(false);
      expect(
         new MediaApi({
            token_transport: "none",
         })
            .getUploadHeaders()
            .has("Authorization"),
      ).toBe(false);
   });

   it("should get file: native", async () => {
      const name = "image.png";
      const path = `${assetsTmpPath}/${name}`;
      const res = await mockedBackend.request("/api/media/file/" + name);
      await Bun.write(path, res);

      const file = await Bun.file(path);
      expect(file.size).toBeGreaterThan(0);
      expect(file.type).toBe("image/png");
      await file.delete();
   });

   it("download", async () => {
      // @ts-ignore tests
      const api = new MediaApi({}, mockedBackend.request);

      const name = "image.png";
      const file = await api.download(name);
      expect(isFile(file)).toBe(true);
      expect(file.size).toBeGreaterThan(0);
      expect(file.type).toBe("image/png");
      expect(file.name).toContain(name);
   });

   it("getFile", async () => {
      // @ts-ignore tests
      const api = new MediaApi({}, mockedBackend.request);

      const name = "image.png";
      const res = await api.getFile(name);
      expect(res.ok).toBe(true);
      // make sure it's a normal api request as usual
      expect(res.res.ok).toBe(true);
      expect(isReadableStream(res)).toBe(true);
      expect(isReadableStream(res.body)).toBe(true);
      expect(isReadableStream(res.res.body)).toBe(true);

      const blob = await res.res.blob();
      expect(isFile(blob)).toBe(true);
      expect(blob.size).toBeGreaterThan(0);
      expect(blob.type).toBe("image/png");
      expect(blob.name).toContain(name);
   });

   it("getFileStream", async () => {
      // @ts-ignore tests
      const api = new MediaApi({}, mockedBackend.request);

      const name = "image.png";
      const res = await api.getFileStream(name);
      expect(isReadableStream(res)).toBe(true);

      const blob = await new Response(res).blob();
      expect(isFile(blob)).toBe(true);
      expect(blob.size).toBeGreaterThan(0);
      expect(blob.type).toBe("image/png");
      expect(blob.name).toContain(name);
   });

   it("should upload file in various ways", async () => {
      const api = new MediaApi(
         {
            upload_fetcher: mockedBackend.request,
         },
         mockedBackend.request,
      );
      const file = Bun.file(`${assetsPath}/image.png`);

      async function matches(req: Promise<any>, filename: string) {
         const res: any = await req;
         expect(res.name).toBe(filename);
         expect(res.is_file).toBe(true);
         expect(res.size).toBe(file.size);
      }

      const url = "http://localhost/api/media/file/image.png";

      // upload bun file
      await matches(api.upload(file as any, { filename: "bunfile.png" }), "bunfile.png");

      // upload via request
      await matches(api.upload(new Request(url), { filename: "request.png" }), "request.png");

      // upload via url
      await matches(api.upload(url, { filename: "url.png" }), "url.png");

      // upload via response
      {
         const response = await mockedBackend.request(url);
         await matches(api.upload(response, { filename: "response.png" }), "response.png");
      }

      // upload via readable from bun
      await matches(await api.upload(file.stream(), { filename: "readable.png" }), "readable.png");

      // upload via readable from response
      {
         const response = (await mockedBackend.request(url)) as Response;
         await matches(
            await api.upload(response.body!, { filename: "readable.png" }),
            "readable.png",
         );
      }
   });
});
