import type { App, AppPlugin } from "bknd";

export type CloudflareImageOptimizationOptions = {
   accessUrl?: string;
   resolvePath?: string;
   autoFormat?: boolean;
};

export function cloudflareImageOptimization({
   accessUrl = "/_plugin/image/optimize",
   resolvePath = "/api/media/file",
   autoFormat = true,
}: CloudflareImageOptimizationOptions = {}): AppPlugin {
   const disallowedAccessUrls = ["/api", "/admin", "/_optimize"];
   if (disallowedAccessUrls.includes(accessUrl) || accessUrl.length < 2) {
      throw new Error(`Disallowed accessUrl: ${accessUrl}`);
   }

   return (app: App) => ({
      name: "cf-image-optimization",
      onBuilt: () => {
         app.server.get(`${accessUrl}/:path{.+$}`, async (c) => {
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
            const metadata = await storage.objectMetadata(path);

            // Cloudflare-specific options are in the cf object.
            const params = Object.fromEntries(url.searchParams.entries());
            const options: RequestInitCfPropertiesImage = {};

            // Copy parameters from query string to request options.
            // You can implement various different parameters here.
            if ("fit" in params) options.fit = params.fit as any;
            if ("width" in params) options.width = Number.parseInt(params.width);
            if ("height" in params) options.height = Number.parseInt(params.height);
            if ("quality" in params) options.quality = Number.parseInt(params.quality);

            // Your Worker is responsible for automatic format negotiation. Check the Accept header.
            if (autoFormat) {
               const accept = request.headers.get("Accept")!;
               if (/image\/avif/.test(accept)) {
                  options.format = "avif";
               } else if (/image\/webp/.test(accept)) {
                  options.format = "webp";
               }
            }

            // Build a request that passes through request headers
            const imageRequest = new Request(imageURL, {
               headers: request.headers,
            });

            // Returning fetch() with resizing options will pass through response with the resized image.
            const res = await fetch(imageRequest, { cf: { image: options } });

            return new Response(res.body, {
               status: res.status,
               statusText: res.statusText,
               headers: {
                  "Cache-Control": "public, max-age=600",
                  "Content-Type": metadata.type,
                  "Content-Length": metadata.size.toString(),
               },
            });
         });
      },
   });
}
