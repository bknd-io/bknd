/**
 * Central file containing all storage adapter schemas.
 * This file has NO Node.js dependencies and can be safely imported in any environment.
 * The schemas are used by the Admin UI to display adapter configuration options.
 */

import { s, secret } from "bknd/utils";

/**
 * Local filesystem storage adapter schema
 */
export const localAdapterSchema = s.object(
   {
      path: s.string({ default: "./" }),
   },
   { title: "Local", description: "Local file system storage", additionalProperties: false },
);

/**
 * AWS S3 (and compatible) storage adapter schema
 */
export const s3AdapterSchema = s.object(
   {
      access_key: secret(),
      secret_access_key: secret(),
      url: s.string({
         pattern: "^https?://(?:.*)?[^/.]+$",
         description: "URL to S3 compatible endpoint without trailing slash",
         examples: [
            "https://{account_id}.r2.cloudflarestorage.com/{bucket}",
            "https://{bucket}.s3.{region}.amazonaws.com",
         ],
      }),
   },
   {
      title: "AWS S3",
      description: "AWS S3 or compatible storage",
   },
);

/**
 * Cloudinary storage adapter schema
 */
export const cloudinaryAdapterSchema = s.object(
   {
      cloud_name: s.string(),
      api_key: secret(),
      api_secret: secret(),
      upload_preset: s.string().optional(),
   },
   { title: "Cloudinary", description: "Cloudinary media storage" },
);

/**
 * All available adapter schemas, keyed by adapter type.
 * This is used by the Admin UI to build the adapter selection form.
 */
export const adapterSchemas = {
   local: localAdapterSchema,
   s3: s3AdapterSchema,
   cloudinary: cloudinaryAdapterSchema,
} as const;

export type AdapterType = keyof typeof adapterSchemas;
