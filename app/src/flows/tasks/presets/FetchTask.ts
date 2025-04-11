import { StringEnum } from "core/utils";
import { Task, dynamic } from "../Task";
import * as tbbox from "@sinclair/typebox";
const { Type } = tbbox;

const FetchMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export class FetchTask<Output extends Record<string, any>> extends Task<
   typeof FetchTask.schema,
   Output
> {
   type = "fetch";

   static override schema = Type.Object({
      url: Type.String({
         pattern: "^(http|https)://",
      }),
      method: Type.Optional(dynamic(StringEnum(FetchMethods, { default: "GET" }))),
      headers: Type.Optional(
         dynamic(
            Type.Array(
               Type.Object({
                  key: Type.String(),
                  value: Type.String(),
               }),
            ),
            JSON.parse,
         ),
      ),
      body: Type.Optional(dynamic(Type.String())),
      normal: Type.Optional(dynamic(Type.Number(), Number.parseInt)),
   });

   protected getBody(): string | undefined {
      const body = this.params.body;
      if (!body) return;
      if (typeof body === "string") return body;
      if (typeof body === "object") return JSON.stringify(body);

      throw new Error(`Invalid body type: ${typeof body}`);
   }

   async execute() {
      if (!FetchMethods.includes(this.params.method ?? "GET")) {
         throw this.error("Invalid method", {
            given: this.params.method,
            valid: FetchMethods,
         });
      }

      const body = this.getBody();
      const headers = new Headers(this.params.headers?.map((h) => [h.key, h.value]));

      const result = await fetch(this.params.url, {
         method: this.params.method ?? "GET",
         headers,
         body,
      });

      if (!result.ok) {
         throw this.error("Failed to fetch", {
            status: result.status,
            statusText: result.statusText,
         });
      }

      const data = (await result.json()) as Output;
      return data;
   }
}
