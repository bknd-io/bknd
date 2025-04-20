import { isDebug, tbValidator as tb } from "core";
import { HttpStatus, getFileFromContext } from "core/utils";
import type { StorageAdapter } from "media";
import { StorageEvents, getRandomizedFilename, MediaPermissions } from "media";
import { DataPermissions } from "data";
import { Controller } from "modules/Controller";
import type { AppMedia } from "../AppMedia";
import { MediaField } from "../MediaField";
import * as tbbox from "@sinclair/typebox";
const { Type } = tbbox;

const booleanLike = Type.Transform(Type.String())
   .Decode((v) => v === "1")
   .Encode((v) => (v ? "1" : "0"));

export class MediaController extends Controller {
   constructor(private readonly media: AppMedia) {
      super();
   }

   private getStorageAdapter(): StorageAdapter {
      return this.getStorage().getAdapter();
   }

   private getStorage() {
      return this.media.storage;
   }

   override getController() {
      // @todo: multiple providers?
      // @todo: implement range requests
      const { auth, permission } = this.middlewares;
      const hono = this.create().use(auth());

      // get files list (temporary)
      hono.get("/files", permission(MediaPermissions.listFiles), async (c) => {
         const files = await this.getStorageAdapter().listObjects();
         return c.json(files);
      });

      // get file by name
      // @todo: implement more aggressive cache? (configurable)
      hono.get("/file/:filename", permission(MediaPermissions.readFile), async (c) => {
         const { filename } = c.req.param();
         if (!filename) {
            throw new Error("No file name provided");
         }

         await this.getStorage().emgr.emit(new StorageEvents.FileAccessEvent({ name: filename }));
         const res = await this.getStorageAdapter().getObject(filename, c.req.raw.headers);

         const headers = new Headers(res.headers);
         headers.set("Cache-Control", "public, max-age=31536000, immutable");

         return new Response(res.body, {
            status: res.status,
            statusText: res.statusText,
            headers,
         });
      });

      // delete a file by name
      hono.delete("/file/:filename", permission(MediaPermissions.deleteFile), async (c) => {
         const { filename } = c.req.param();
         if (!filename) {
            throw new Error("No file name provided");
         }
         await this.getStorage().deleteFile(filename);

         return c.json({ message: "File deleted" });
      });

      const maxSize = this.getStorage().getConfig().body_max_size ?? Number.POSITIVE_INFINITY;

      if (isDebug()) {
         hono.post("/inspect", async (c) => {
            const file = await getFileFromContext(c);
            return c.json({
               type: file?.type,
               name: file?.name,
               size: file?.size,
            });
         });
      }

      // upload file
      // @todo: add required type for "upload endpoints"
      hono.post("/upload/:filename?", permission(MediaPermissions.uploadFile), async (c) => {
         const reqname = c.req.param("filename");

         const body = await getFileFromContext(c);
         if (!body) {
            return c.json({ error: "No file provided" }, HttpStatus.BAD_REQUEST);
         }
         if (body.size > maxSize) {
            return c.json(
               { error: `Max size (${maxSize} bytes) exceeded` },
               HttpStatus.PAYLOAD_TOO_LARGE,
            );
         }

         const filename = reqname ?? getRandomizedFilename(body as File);
         const res = await this.getStorage().uploadFile(body, filename);

         return c.json(res, HttpStatus.CREATED);
      });

      // add upload file to entity
      // @todo: add required type for "upload endpoints"
      hono.post(
         "/entity/:entity/:id/:field",
         tb(
            "query",
            Type.Object({
               overwrite: Type.Optional(booleanLike),
            }),
         ),
         permission([DataPermissions.entityCreate, MediaPermissions.uploadFile]),
         async (c) => {
            const entity_name = c.req.param("entity");
            const field_name = c.req.param("field");
            const entity_id = Number.parseInt(c.req.param("id"));

            // check if entity exists
            const entity = this.media.em.entity(entity_name);
            if (!entity) {
               return c.json({ error: `Entity "${entity_name}" not found` }, HttpStatus.NOT_FOUND);
            }

            // check if field exists and is of type MediaField
            const field = entity.field(field_name);
            if (!field || !(field instanceof MediaField)) {
               return c.json({ error: `Invalid field "${field_name}"` }, HttpStatus.BAD_REQUEST);
            }

            const media_entity = this.media.getMediaEntity().name as "media";
            const reference = `${entity_name}.${field_name}`;
            const mediaRef = {
               scope: field_name,
               reference,
               entity_id: entity_id,
            };

            // check max items
            const max_items = field.getMaxItems();
            const paths_to_delete: string[] = [];
            if (max_items) {
               const { overwrite } = c.req.valid("query");
               const { count } = await this.media.em.repository(media_entity).count(mediaRef);

               // if there are more than or equal to max items
               if (count >= max_items) {
                  // if overwrite not set, abort early
                  if (!overwrite) {
                     return c.json(
                        { error: `Max items (${max_items}) reached` },
                        HttpStatus.BAD_REQUEST,
                     );
                  }

                  // if already more in database than allowed, abort early
                  // because we don't know if we can delete multiple items
                  if (count > max_items) {
                     return c.json(
                        { error: `Max items (${max_items}) exceeded already with ${count} items.` },
                        HttpStatus.UNPROCESSABLE_ENTITY,
                     );
                  }

                  // collect items to delete
                  const deleteRes = await this.media.em.repo(media_entity).findMany({
                     select: ["path"],
                     where: mediaRef,
                     sort: {
                        by: "id",
                        dir: "asc",
                     },
                     limit: count - max_items + 1,
                  });

                  if (deleteRes.data && deleteRes.data.length > 0) {
                     deleteRes.data.map((item) => paths_to_delete.push(item.path));
                  }
               }
            }

            // check if entity exists in database
            const { exists } = await this.media.em.repository(entity).exists({ id: entity_id });
            if (!exists) {
               return c.json(
                  { error: `Entity "${entity_name}" with ID "${entity_id}" doesn't exist found` },
                  HttpStatus.NOT_FOUND,
               );
            }

            const file = await getFileFromContext(c);
            if (!file) {
               return c.json({ error: "No file provided" }, HttpStatus.BAD_REQUEST);
            }
            if (file.size > maxSize) {
               return c.json(
                  { error: `Max size (${maxSize} bytes) exceeded` },
                  HttpStatus.PAYLOAD_TOO_LARGE,
               );
            }

            const filename = getRandomizedFilename(file as File);
            const info = await this.getStorage().uploadFile(file, filename, true);

            const mutator = this.media.em.mutator(media_entity);
            mutator.__unstable_toggleSystemEntityCreation(false);
            const result = await mutator.insertOne({
               ...this.media.uploadedEventDataToMediaPayload(info),
               ...mediaRef,
            } as any);
            mutator.__unstable_toggleSystemEntityCreation(true);

            // delete items if needed
            if (paths_to_delete.length > 0) {
               // delete files from db & adapter
               for (const path of paths_to_delete) {
                  await this.getStorage().deleteFile(path);
               }
            }

            return c.json({ ok: true, result: result.data, ...info }, HttpStatus.CREATED);
         },
      );

      return hono.all("*", (c) => c.notFound());
   }
}
