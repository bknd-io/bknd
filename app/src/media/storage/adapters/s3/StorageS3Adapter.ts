import type {
   DeleteObjectRequest,
   GetObjectRequest,
   HeadObjectRequest,
   ListObjectsV2Output,
   ListObjectsV2Request,
   PutObjectRequest,
} from "@aws-sdk/client-s3";
import { AwsClient } from "core/clients/aws/AwsClient";
import { isDebug } from "core/env";
import { isFile, pickHeaders2, parse, s } from "bknd/utils";
import { transform } from "lodash-es";
import type { FileBody, FileListObject } from "../../Storage";
import { StorageAdapter } from "../../StorageAdapter";

export const s3AdapterConfig = s.object(
   {
      access_key: s.string(),
      secret_access_key: s.string(),
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

export type S3AdapterConfig = s.Static<typeof s3AdapterConfig>;

export class StorageS3Adapter extends StorageAdapter {
   readonly #config: S3AdapterConfig;
   readonly client: AwsClient;

   constructor(config: S3AdapterConfig) {
      super();
      this.client = new AwsClient(
         {
            accessKeyId: config.access_key,
            secretAccessKey: config.secret_access_key,
            retries: isDebug() ? 0 : 10,
         },
         {
            convertParams: "pascalToKebab",
            responseType: "xml",
         },
      );
      this.#config = parse(s3AdapterConfig, config);
   }

   getName(): string {
      return "s3";
   }

   getSchema() {
      return s3AdapterConfig;
   }

   getUrl(path: string = "", searchParamsObj: Record<string, any> = {}): string {
      let url = this.getObjectUrl("").slice(0, -1);
      if (path.length > 0) url += `/${path}`;
      return this.client.getUrl(url, searchParamsObj);
   }

   /**
    * Returns the URL of an object
    * @param key the key of the object
    */
   getObjectUrl(key: string): string {
      return `${this.#config.url}/${key}`;
   }

   /**
    * https://docs.aws.amazon.com/AmazonS3/latest/API/API_ListObjectsV2.html
    */
   async listObjects(key: string = ""): Promise<FileListObject[]> {
      const params: Omit<ListObjectsV2Request, "Bucket"> & { ListType: number } = {
         ListType: 2,
         Prefix: key,
      };

      const url = this.getUrl("", params);
      const res = await this.client.fetchJson<{ ListBucketResult: ListObjectsV2Output }>(url, {
         method: "GET",
      });

      // absolutely weird, but if only one object is there, it's an object, not an array
      const { Contents } = res.ListBucketResult;
      const objects = !Contents ? [] : Array.isArray(Contents) ? Contents : [Contents];

      const transformed = transform(
         objects,
         (acc, obj) => {
            // s3 contains folders, but Size is 0, which is filtered here
            if (obj.Key && obj.LastModified && obj.Size) {
               acc.push({
                  key: obj.Key,
                  last_modified: obj.LastModified,
                  size: obj.Size,
               });
            }
         },
         [] as FileListObject[],
      );

      return transformed;
   }

   async putObject(
      key: string,
      body: FileBody,
      // @todo: params must be added as headers, skipping for now
      params: Omit<PutObjectRequest, "Bucket" | "Key"> = {},
   ) {
      const url = this.getUrl(key, {});
      const res = await this.client.fetch(url, {
         method: "PUT",
         body,
         headers: isFile(body)
            ? {
                 // required for node environments
                 "Content-Length": String(body.size),
              }
            : {},
      });

      if (!res.ok) {
         throw new Error(`Failed to upload object: ${res.status} ${res.statusText}`);
      }

      // "df20fcb574dba1446cf5ec997940492b"
      return String(res.headers.get("etag"));
   }

   private async headObject(
      key: string,
      params: Pick<HeadObjectRequest, "PartNumber" | "VersionId"> = {},
   ) {
      const url = this.getUrl(key, {});
      return await this.client.fetch(url, {
         method: "HEAD",
         headers: {
            Range: "bytes=0-1",
         },
      });
   }

   async getObjectMeta(key: string) {
      const res = await this.headObject(key);
      const type = String(res.headers.get("content-type"));
      const size = Number(String(res.headers.get("content-range")?.split("/")[1]));

      return {
         type,
         size,
      };
   }

   /**
    * Check if an object exists by fetching the first byte of the object
    * @param key
    * @param params
    */
   async objectExists(
      key: string,
      params: Pick<HeadObjectRequest, "PartNumber" | "VersionId"> = {},
   ) {
      return (await this.headObject(key)).ok;
   }

   /**
    * Simply returns the Response of the object to download body as needed
    */
   async getObject(key: string, headers: Headers): Promise<Response> {
      const url = this.getUrl(key);
      const res = await this.client.fetch(url, {
         method: "GET",
         headers: pickHeaders2(headers, [
            "if-none-match",
            "accept-encoding",
            "accept",
            "if-modified-since",
         ]),
      });

      // Response has to be copied, because of middlewares that might set headers
      return new Response(res.body, {
         status: res.status,
         statusText: res.statusText,
         headers: res.headers,
      });
   }

   /**
    * Deletes a single object. Method is void, because it doesn't return anything
    */
   async deleteObject(
      key: string,
      params: Omit<DeleteObjectRequest, "Bucket" | "Key"> = {},
   ): Promise<void> {
      const url = this.getUrl(key, params);
      const res = await this.client.fetch(url, {
         method: "DELETE",
      });
   }

   toJSON(secrets?: boolean) {
      return {
         type: this.getName(),
         config: secrets ? this.#config : undefined,
      };
   }
}
