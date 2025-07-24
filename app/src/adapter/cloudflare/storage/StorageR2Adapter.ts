import { registries } from "bknd";
import { isDebug } from "bknd/core";
// @ts-ignore
import { StringEnum } from "bknd/utils";
import { guessMimeType as guess, StorageAdapter, type FileBody } from "bknd/media";
import { getBindings } from "../bindings";
import * as tb from "@sinclair/typebox";
const { Type } = tb;

export function makeSchema(bindings: string[] = []) {
   return Type.Object(
      {
         binding: bindings.length > 0 ? StringEnum(bindings) : Type.Optional(Type.String()),
      },
      { title: "R2", description: "Cloudflare R2 storage" },
   );
}

export function registerMedia(env: Record<string, any>) {
   const r2_bindings = getBindings(env, "R2Bucket");

   registries.media.register(
      "r2",
      class extends StorageR2Adapter {
         constructor(private config: any) {
            const binding = r2_bindings.find((b) => b.key === config.binding);
            if (!binding) {
               throw new Error(`No R2Bucket found with key ${config.binding}`);
            }

            super(binding?.value);
         }

         override getSchema() {
            return makeSchema(r2_bindings.map((b) => b.key));
         }

         override toJSON() {
            return {
               ...super.toJSON(),
               config: this.config,
            };
         }
      },
   );
}

/**
 * Adapter for R2 storage
 * @todo: add tests (bun tests won't work, need node native tests)
 */
export class StorageR2Adapter extends StorageAdapter {
   constructor(private readonly bucket: R2Bucket) {
      super();
   }

   getName(): string {
      return "r2";
   }

   getSchema() {
      return makeSchema();
   }

   async putObject(key: string, body: FileBody) {
      try {
         const res = await this.bucket.put(this.getKey(key), body);
         return res?.etag;
      } catch (e) {
         return undefined;
      }
   }
   async listObjects(prefix = ""): Promise<{ key: string; last_modified: Date; size: number }[]> {
      const list = await this.bucket.list({ limit: 50, prefix: this.getKey(prefix) });
      return list.objects.map((item) => ({
         key: item.key.replace(this.getKey(""), ""),
         size: item.size,
         last_modified: item.uploaded,
      }));
   }

   private async headObject(key: string): Promise<R2Object | null> {
      return await this.bucket.head(this.getKey(key));
   }

   async objectExists(key: string): Promise<boolean> {
      return (await this.headObject(key)) !== null;
   }

   async getObject(_key: string, headers: Headers): Promise<Response> {
      let object: R2ObjectBody | null;
      const key = this.getKey(_key);

      const responseHeaders = new Headers({
         "Accept-Ranges": "bytes",
         "Content-Type": guess(key),
      });

      const range = headers.has("range");

      //console.log("getObject:headers", headersToObject(headers));
      if (range) {
         const options = isDebug()
            ? {} // miniflare doesn't support range requests
            : {
                 range: headers,
                 onlyIf: headers,
              };

         object = (await this.bucket.get(key, options)) as R2ObjectBody;

         if (!object) {
            return new Response(null, { status: 404 });
         }

         if (object.range) {
            const offset = "offset" in object.range ? object.range.offset : 0;
            const end = "end" in object.range ? object.range.end : object.size - 1;
            responseHeaders.set("Content-Range", `bytes ${offset}-${end}/${object.size}`);
            responseHeaders.set("Connection", "keep-alive");
            responseHeaders.set("Vary", "Accept-Encoding");
         }
      } else {
         object = (await this.bucket.get(key)) as R2ObjectBody;

         if (object === null) {
            return new Response(null, { status: 404 });
         }
      }

      this.writeHttpMetadata(responseHeaders, object);
      responseHeaders.set("etag", object.httpEtag);
      responseHeaders.set("Content-Length", String(object.size));
      responseHeaders.set("Last-Modified", object.uploaded.toUTCString());

      return new Response(object.body, {
         status: range ? 206 : 200,
         headers: responseHeaders,
      });
   }

   private writeHttpMetadata(headers: Headers, object: R2Object | R2ObjectBody): void {
      let metadata = object.httpMetadata;

      if (!metadata || Object.keys(metadata).length === 0) {
         // guessing is especially required for dev environment (miniflare)
         metadata = {
            contentType: guess(object.key),
         };
      }

      for (const [key, value] of Object.entries(metadata)) {
         const camelToDash = key.replace(/([A-Z])/g, "-$1").toLowerCase();
         headers.set(camelToDash, value);
      }
   }

   async getObjectMeta(key: string): Promise<{ type: string; size: number }> {
      const head = await this.headObject(key);
      if (!head) {
         throw new Error("Object not found");
      }

      return {
         type: String(head.httpMetadata?.contentType ?? guess(key)),
         size: head.size,
      };
   }

   async deleteObject(key: string): Promise<void> {
      await this.bucket.delete(this.getKey(key));
   }

   getObjectUrl(key: string): string {
      throw new Error("Method getObjectUrl not implemented.");
   }

   protected getKey(key: string) {
      return key;
   }

   toJSON(secrets?: boolean) {
      return {
         type: this.getName(),
         config: {},
      };
   }
}
