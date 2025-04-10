import { AwsClient as Aws4fetchClient } from "aws4fetch";
import { objectKeysPascalToKebab } from "../../utils/objects";
import { xmlToObject } from "../../utils/xml";

type Aws4fetchClientConfig = ConstructorParameters<typeof Aws4fetchClient>[0];
type AwsClientConfig = {
   responseType?: "xml" | "json";
   responseKeysToUpper?: boolean;
   convertParams?: "pascalToKebab";
};

export class AwsClient extends Aws4fetchClient {
   readonly #options: AwsClientConfig;

   constructor(aws4fetchConfig: Aws4fetchClientConfig, options?: AwsClientConfig) {
      super(aws4fetchConfig);
      this.#options = options ?? {
         responseType: "json",
      };
   }

   protected convertParams(params: Record<string, any>): Record<string, any> {
      switch (this.#options.convertParams) {
         case "pascalToKebab":
            return objectKeysPascalToKebab(params);
         default:
            return params;
      }
   }

   getUrl(path: string = "/", searchParamsObj: Record<string, any> = {}): string {
      const url = new URL(path);
      const converted = this.convertParams(searchParamsObj);
      Object.entries(converted).forEach(([key, value]) => {
         url.searchParams.append(key, value as any);
      });
      return url.toString();
   }

   protected updateKeysRecursively(obj: any, direction: "toUpperCase" | "toLowerCase") {
      if (obj === null || obj === undefined) return obj;

      if (Array.isArray(obj)) {
         return obj.map((item) => this.updateKeysRecursively(item, direction));
      }

      if (typeof obj === "object") {
         return Object.keys(obj).reduce(
            (acc, key) => {
               // only if key doesn't have any whitespaces
               let newKey = key;
               if (key.indexOf(" ") === -1) {
                  newKey = key.charAt(0)[direction]() + key.slice(1);
               }
               acc[newKey] = this.updateKeysRecursively(obj[key], direction);
               return acc;
            },
            {} as { [key: string]: any },
         );
      }

      return obj;
   }

   async fetchJson<T extends Record<string, any>>(
      input: RequestInfo,
      init?: RequestInit,
   ): Promise<T> {
      const response = await this.fetch(input, init);

      if (this.#options.responseType === "xml") {
         if (!response.ok) {
            const body = await response.text();
            throw new Error(body);
         }

         const raw = await response.text();
         return xmlToObject(raw) as T;
      }

      if (!response.ok) {
         const body = await response.json<{ message: string }>();
         throw new Error(body.message);
      }

      const raw = (await response.json()) as T;
      if (this.#options.responseKeysToUpper) {
         return this.updateKeysRecursively(raw, "toUpperCase");
      }

      return raw;
   }
}
