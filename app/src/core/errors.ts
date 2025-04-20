import type { ContentfulStatusCode } from "hono/utils/http-status";
import { HttpStatus } from "./utils/reqres";

export class Exception extends Error {
   code: ContentfulStatusCode = HttpStatus.BAD_REQUEST;
   override name = "Exception";
   protected _context = undefined;

   constructor(message: string, code?: ContentfulStatusCode) {
      super(message);
      if (code) {
         this.code = code;
      }
   }

   context(context: any) {
      this._context = context;
      return this;
   }

   toJSON() {
      return {
         error: this.message,
         type: this.name,
         context: this._context,
      };
   }
}

export class BkndError extends Error {
   constructor(
      message: string,
      public details?: Record<string, any>,
      public type?: string,
   ) {
      super(message);
   }

   static with(message: string, details?: Record<string, any>, type?: string) {
      throw new BkndError(message, details, type);
   }

   toJSON() {
      return {
         type: this.type ?? "unknown",
         message: this.message,
         details: this.details,
      };
   }
}
