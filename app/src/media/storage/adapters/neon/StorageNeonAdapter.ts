import { parse, s, secret } from "bknd/utils";
import type { FileBody } from "../../Storage";
import { StorageAdapter } from "../../StorageAdapter";
import { StorageS3Adapter } from "../s3/StorageS3Adapter";

export const neonAdapterConfig = s.object(
   {
      access_key: secret({
         description: "Neon credential token_id (nak_live_...)",
      }),
      secret_access_key: secret({
         description: "Neon credential s3_secret_access_key (nsk_live_...)",
      }),
      endpoint: s.string({
         pattern: "^https://[^/]+$",
         description: "Branch storage endpoint without trailing slash (AWS_ENDPOINT_URL_S3)",
         examples: ["https://br-{branch}.storage.c-{n}.{region}.aws.neon.tech"],
      }),
      bucket: s.string({
         description: "Name of a bucket on the branch",
      }),
      region: s
         .string({
            description: "Signing region (AWS_REGION), derived from the endpoint if omitted",
            examples: ["us-east-2"],
         })
         .optional(),
   },
   {
      title: "Neon",
      description: "Neon Object Storage",
   },
);

export type NeonAdapterConfig = s.Static<typeof neonAdapterConfig>;

/**
 * Returns the region embedded in a Neon branch storage endpoint, e.g.
 * `br-xxx.storage.c-6.us-east-2.aws.neon.tech` -> `us-east-2`
 */
export function getNeonRegion(endpoint: string): string | undefined {
   return new URL(endpoint).hostname.match(/\.([a-z]{2}-[a-z]+-\d+)\.aws\.neon\.tech$/)?.[1];
}

/**
 * Adapter for Neon Object Storage, an S3-compatible store whose buckets branch with the database.
 * https://neon.com/docs/storage/overview
 */
export class StorageNeonAdapter extends StorageAdapter {
   readonly #config: NeonAdapterConfig;
   readonly s3: StorageS3Adapter;

   constructor(config: NeonAdapterConfig) {
      super();
      this.#config = parse(neonAdapterConfig, config);

      const { endpoint, bucket } = this.#config;

      // Neon only supports path-style addressing. It doesn't enforce the signing region,
      // but sign with the branch's region where known, like clients configured from AWS_REGION.
      this.s3 = new StorageS3Adapter(
         {
            access_key: this.#config.access_key,
            secret_access_key: this.#config.secret_access_key,
            url: `${endpoint}/${bucket}`,
         },
         { region: this.#config.region || getNeonRegion(endpoint) },
      );
   }

   get client() {
      return this.s3.client;
   }

   getName(): string {
      return "neon";
   }

   getSchema() {
      return neonAdapterConfig;
   }

   listObjects(prefix?: string) {
      return this.s3.listObjects(prefix);
   }

   putObject(key: string, body: FileBody) {
      return this.s3.putObject(key, body);
   }

   deleteObject(key: string) {
      return this.s3.deleteObject(key);
   }

   objectExists(key: string) {
      return this.s3.objectExists(key);
   }

   getObject(key: string, headers: Headers) {
      return this.s3.getObject(key, headers);
   }

   getObjectUrl(key: string) {
      return this.s3.getObjectUrl(key);
   }

   getObjectMeta(key: string) {
      return this.s3.getObjectMeta(key);
   }

   toJSON(secrets?: boolean) {
      return {
         type: this.getName(),
         config: secrets ? this.#config : undefined,
      };
   }
}
