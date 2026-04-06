import type { RequestHandler } from "@builder.io/qwik-city";
import { handler } from "~/lib/bknd";

export const onRequest: RequestHandler = async ({
   env,
   url,
   next,
   status,
   headers,
   request,
   redirect,
   getWritableStream,
}) => {
   const pathname = url.pathname;

   if (pathname.startsWith("/api") || pathname !== "/") {
      const response = await handler(request, env);

      // skips unknown paths
      if (response.status === 404) {
         await next();
         return;
      }

      // adds the set-cookie header
      response.headers.forEach((value, key) => {
         headers.set(key, value);
      });

      // for redirect
      if (response.status >= 300 && response.status < 400) {
         const location = response.headers.get("location");
         if (location) {
            throw redirect(response.status as any, location);
         }
      }

      // stream back the body
      status(response.status);
      if (response.body) {
         await response.body?.pipeTo(getWritableStream());
         return;
      }
   }
};
