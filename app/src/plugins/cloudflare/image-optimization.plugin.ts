import type { App, AppPlugin } from "bknd";
import { s, jsc, mergeObject, pickHeaders2 } from "bknd/utils";

/**
 * check RequestInitCfPropertiesImage
 */
const schema = s.partialObject({
   dpr: s.number({ minimum: 1, maximum: 3 }),
   fit: s.string({ enum: ["scale-down", "contain", "cover", "crop", "pad"] }),
   format: s.string({
      enum: ["auto", "avif", "webp", "jpeg", "baseline-jpeg", "json"],
      default: "auto",
   }),
   height: s.number(),
   width: s.number(),
   metadata: s.string({ enum: ["copyright", "keep", "none"] }),
   quality: s.number({ minimum: 1, maximum: 100 }),
});
type ImageOptimizationSchema = s.Static<typeof schema>;

export type CloudflareImageOptimizationOptions = {
   accessUrl?: string;
   resolvePath?: string;
   explain?: boolean;
   defaultOptions?: ImageOptimizationSchema;
   fixedOptions?: ImageOptimizationSchema;
   cacheControl?: string;
};

export function cloudflareImageOptimization({
   accessUrl = "/_plugin/image/optimize",
   resolvePath = "/api/media/file",
   explain = false,
   defaultOptions = {},
   fixedOptions = {},
}: CloudflareImageOptimizationOptions = {}): AppPlugin {
   const disallowedAccessUrls = ["/api", "/admin", "/_optimize"];
   if (disallowedAccessUrls.includes(accessUrl) || accessUrl.length < 2) {
      throw new Error(`Disallowed accessUrl: ${accessUrl}`);
   }

   return (app: App) => ({
      name: "cf-image-optimization",
      onBuilt: () => {
         if (explain) {
            app.server.get(accessUrl, async (c) => {
               return c.json({
                  searchParams: schema.toJSON(),
               });
            });
         }
         app.server.get(`${accessUrl}/:path{.+$}`, jsc("query", schema), async (c) => {
            const request = c.req.raw;
            const url = new URL(request.url);

            const storage = app.module.media?.storage;
            if (!storage) {
               throw new Error("No media storage configured");
            }

            const path = c.req.param("path");
            if (!path) {
               throw new Error("No url provided");
            }

            const imageURL = `${url.origin}${resolvePath}/${path}`;
            //const metadata = await storage.objectMetadata(path);

            // Copy parameters from query string to request options.
            // You can implement various different parameters here.
            const options = mergeObject(
               structuredClone(defaultOptions),
               c.req.valid("query"),
               structuredClone(fixedOptions),
            );

            // Your Worker is responsible for automatic format negotiation. Check the Accept header.
            if (options.format) {
               if (options.format === "auto") {
                  const accept = request.headers.get("Accept")!;
                  if (/image\/avif/.test(accept)) {
                     options.format = "avif";
                  } else if (/image\/webp/.test(accept)) {
                     options.format = "webp";
                  }
               }
            }

            // Build a request that passes through request headers
            const imageRequest = new Request(imageURL, {
               headers: request.headers,
            });

            // Returning fetch() with resizing options will pass through response with the resized image.
            const res = await fetch(imageRequest, { cf: { image: options as any } });
            const headers = pickHeaders2(res.headers, [
               "Content-Type",
               "Content-Length",
               "Age",
               "Date",
               "Last-Modified",
            ]);
            headers.set("Cache-Control", "public, max-age=31536000, immutable");

            return new Response(res.body, {
               status: res.status,
               statusText: res.statusText,
               headers,
            });
         });
      },
   });
}
