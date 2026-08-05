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
import { isFile, pickHeaders2, parse, s, secret, $console } from "bknd/utils";
import { transform } from "lodash-es";
import type { FileBody, FileListObject } from "../../Storage";
import { StorageAdapter } from "../../StorageAdapter";

export const s3AdapterConfig = s.object(
   {
      access_key: secret(),
      secret_access_key: secret(),
      url: s.string({
         pattern: "^https?://(?:.*)?[^/.]+$",
         description: "URL to S3 compatible endpoint without trailing slash",
         examples: [
            "https://{account_id}.r2.cloudflarestorage.com/{bucket}",
            "https://{bucket}.s3.{region}.amazonaws.com",
            "https://t3.storage.dev/{bucket}",
            "{self_hosted_s3_url}/{bucket}"
         ],
      }),
   },
   {
      title: "AWS S3",
      description: "AWS S3 or compatible storage",
   },
);

export type S3AdapterConfig = s.Static<typeof s3AdapterConfig>;

interface UploadPart {
   partNumber: number;
   etag: string;
}

export class StorageS3Adapter extends StorageAdapter {
   readonly #config: S3AdapterConfig;
   readonly client: AwsClient;
   readonly CHUNK_SIZE = 5 * 1024 * 1024; // 5MB

   constructor(config: S3AdapterConfig) {
      super();
      this.client = new AwsClient(
         {
            accessKeyId: config.access_key,
            secretAccessKey: config.secret_access_key,
            retries: isDebug() ? 0 : 10,
            service: "s3",
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

   // --- Multipart Upload Methods ---

   async getOrCreateUploadId(key: string): Promise<string> {
      // Scope active upload lookup specifically to this key prefix
      const url = this.getUrl("", { uploads: "", prefix: key });

      const response = await this.client.fetch(url, { method: "GET" });
      if (!response.ok) {
         return await this.createUploadId(key);
      }

      const xmlText = await response.text();
      const uploadIdMatches = [...xmlText.matchAll(/<UploadId>(.*?)<\/UploadId>/g)];

      if (uploadIdMatches.length > 0) {
         // Grab the most recent upload ID
         const latestUploadId = uploadIdMatches[uploadIdMatches.length - 1]![1]!;
         return latestUploadId;
      }

      return await this.createUploadId(key);
   }

   async getUploadedParts(key: string, uploadId: string): Promise<Map<number, string> | null> {
      const partsMap = new Map<number, string>();
      let partNumberMarker = 0;
      let isTruncated = true;

      while (isTruncated) {
         // S3 API requires the part-number-marker to be set to the last part number received in the previous response
         const url = this.getUrl(`${key}?uploadId=${uploadId}&part-number-marker=${partNumberMarker}`);
         const response = await this.client.fetch(url, { method: "GET" });

         if (!response.ok) {
            console.error(
               `ERROR: Failed to list parts for key '${key}' (status ${response.status}):`,
               await response.text(),
            );
            break;
         }

         const xmlText = await response.text();
         const partBlocks = xmlText.match(/<Part>[\s\S]*?<\/Part>/g) || [];

         for (const block of partBlocks) {
            const partNumMatch = block.match(/<PartNumber>(\d+)<\/PartNumber>/);
            const etagMatch = block.match(/<ETag>(.*?)<\/ETag>/);

            if (partNumMatch && etagMatch) {
               const partNum = parseInt(partNumMatch[1]!, 10);
               const etag = etagMatch[1]!.replace(/&quot;|"/g, "").trim();
               partsMap.set(partNum, etag);
               partNumberMarker = partNum;
            }
         }

         isTruncated = /<IsTruncated>true<\/IsTruncated>/.test(xmlText);
      }

      return partsMap;
   }

   async createUploadId(key: string): Promise<string> {
      const url = this.getUrl(`${key}?uploads`);
      const response = await this.client.fetch(url, {
         method: "POST",
      });

      if (!response.ok) {
         throw new Error(`Failed to create upload ID: ${response.status} ${await response.text()}`);
      }

      const xmlText = await response.text();
      const match = xmlText.match(/<UploadId>(.*?)<\/UploadId>/);
      if (!match || !match[1])
         throw new Error(`Could not locate UploadId in XML response: ${xmlText}`);
      return match[1];
   }

   async uploadChunk(
      key: string,
      uploadId: string,
      partNumber: number,
      chunk: Uint8Array<ArrayBuffer>,
   ): Promise<string> {
      // casing of query parameters is important for S3, so we construct the URL manually
      const url = this.getUrl(`${key}?uploadId=${uploadId}&partNumber=${partNumber}`, {});

      const response = await this.client.fetch(url, {
         method: "PUT",
         body: chunk,
      });

      if (!response.ok) {
         throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

     const etag = response.headers.get("etag") || response.headers.get("ETag");
      if (!etag || etag === null) throw new Error(`Missing ETag header in response for part ${partNumber}`);

      return etag.replace(/"/g, "").trim();
   }

   async completeMultipartUpload(
      key: string,
      uploadId: string,
      parts: UploadPart[],
   ): Promise<string> {
      const url = this.getUrl(`${key}?uploadId=${uploadId}`);

      const xmlBody = `<CompleteMultipartUpload>${parts
         .map(
            (part) =>
               `<Part><PartNumber>${part.partNumber}</PartNumber><ETag>"${part.etag}"</ETag></Part>`,
         )
         .join("")}</CompleteMultipartUpload>`;

         // $console.info({xmlBody})

      const response = await this.client.fetch(url, {
         method: "POST",
         body: xmlBody,
         headers: {
            "Content-Type": "application/xml",
         },
      });

      if (!response.ok) {
         const errorText = await response.text();
         $console.error({ response: errorText });
         throw new Error(
            `Failed to complete multipart upload: ${response.status} ${response.statusText}`,
         );
      }

      // some provider (Tigris) put ETag in body
      const responseText = await response.text();
      const match = responseText.match(/<ETag>(.*?)<\/ETag>/);
      const rawEtag = match ? match[1] : null;

      let escapedEtag = rawEtag?.replace(/&#34;|&quot;/g, '"').trim();
      if (escapedEtag && !escapedEtag.startsWith('"')) {
         escapedEtag = `"${escapedEtag}"`;
      }

      
      const etag = response.headers.get("etag") || response.headers.get("ETag") || escapedEtag;
      // $console.info({
      //    response: responseText,
      //    headers:response.headers,
      //    etag,
      //    etagInBody
      // });

      // Output: '"bb56c53263bb7088a430725912ba5a81-10"' 
      //           ^ collective hash of all chunks  ^ no. of chunks      
      return etag as string;
   }

   async putObjectMultipart(key: string, body: FileBody) {
      let uploadId = await this.getOrCreateUploadId(key);

      let uploadedParts = await this.getUploadedParts(key, uploadId);

      // Invalidate upload ID if stale or non-existent on S3
      if (uploadedParts === null) {
         uploadId = await this.createUploadId(key);
         uploadedParts = (await this.getUploadedParts(key, uploadId)) || new Map();
      }

      const fileData = new Uint8Array(
         body instanceof ArrayBuffer ? body : await (body as File).bytes(),
      );
      const size = fileData.byteLength;
      if (size === 0) {
         throw new Error("Body size is 0, cannot upload empty file");
      }

      const totalParts = Math.ceil(size / this.CHUNK_SIZE);
      const completedParts: UploadPart[] = [];
      const promises: Promise<void>[] = [];

      for (let i = 0; i < totalParts; i++) {
         promises.push(
            (async () => {
               const partNumber = i + 1;
               const start = i * this.CHUNK_SIZE;
               const end = Math.min(start + this.CHUNK_SIZE, size);
               const chunk = fileData.subarray(start, end);

               if (uploadedParts.has(partNumber)) {
                  completedParts.push({
                     partNumber,
                     etag: uploadedParts.get(partNumber)!,
                  });
               } else {
                  const etag = await this.uploadChunk(key, uploadId, partNumber, chunk);
                  completedParts.push({ partNumber, etag });
               }
            })(),
         );
      }

      await Promise.all(promises);

      completedParts.sort((a, b) => a.partNumber - b.partNumber);
      return await this.completeMultipartUpload(key, uploadId, completedParts);
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
            //"accept-encoding", (causes 403 on r2)
            "accept",
            "if-modified-since",
         ]),
      });

      // response has to be copied, because of middlewares that might set headers
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
