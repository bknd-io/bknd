import type { Context } from "hono";
import { setCookie } from "hono/cookie";

const flash_key = "__bknd_flash";
export type FlashMessageType = "error" | "warning" | "success" | "info";

export function addFlashMessage(c: Context, message: string, type: FlashMessageType = "info") {
   if (c.req.header("Accept")?.includes("text/html")) {
      setCookie(c, flash_key, JSON.stringify({ type, message }), {
         path: "/",
      });
   }
}

function getCookieValue(name) {
   const cookies = document.cookie.split("; ");
   for (const cookie of cookies) {
      const [key, value] = cookie.split("=");
      if (key === name) {
         try {
            return decodeURIComponent(value as any);
         } catch (e) {
            return null;
         }
      }
   }
   return null; // Return null if the cookie is not found
}

export function getFlashMessage(
   clear = true,
): { type: FlashMessageType; message: string } | undefined {
   const flash = getCookieValue(flash_key);
   if (flash && clear) {
      // biome-ignore lint/suspicious/noDocumentCookie: .
      document.cookie = `${flash_key}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
   }
   return flash ? JSON.parse(flash) : undefined;
}
