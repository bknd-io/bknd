import { get } from "lodash-es";

export type TemplateObject = Record<string, string | Record<string, string>>;
export type TemplateTypes = string | TemplateObject | any;

export type SimpleRendererOptions = {
   renderKeys?: boolean;
};

export class SimpleRenderer {
   constructor(
      private variables: Record<string, any> = {},
      private options: SimpleRendererOptions = {},
   ) {}

   another() {
      return 1;
   }

   static hasMarkup(template: string | object): boolean {
      let flat: string = "";

      if (Array.isArray(template) || typeof template === "object") {
         // only plain arrays and objects
         if (!["Array", "Object"].includes(template.constructor.name)) return false;

         flat = JSON.stringify(template);
      } else {
         flat = String(template);
      }

      const checks = ["{{"];
      return checks.some((check) => flat.includes(check));
   }

   async render<Given extends TemplateTypes = TemplateTypes>(template: Given): Promise<Given> {
      if (typeof template === "undefined" || template === null) return template;

      if (typeof template === "string") {
         return (await this.renderString(template)) as unknown as Given;
      } else if (Array.isArray(template)) {
         return (await Promise.all(template.map((item) => this.render(item)))) as unknown as Given;
      } else if (typeof template === "object") {
         return (await this.renderObject(template as any)) as unknown as Given;
      }

      throw new Error("Invalid template type");
   }

   async renderString(template: string): Promise<string> {
      return template.replace(/{{\s*([^{}]+?)\s*}}/g, (_, expr: string) => {
         const value = get(this.variables, expr.trim());
         return value == null ? "" : String(value);
      });
   }

   async renderObject(template: TemplateObject): Promise<TemplateObject> {
      const result: TemplateObject = {};

      for (const [key, value] of Object.entries(template)) {
         let resultKey = key;
         if (this.options.renderKeys) {
            resultKey = await this.renderString(key);
         }

         result[resultKey] = await this.render(value);
      }

      return result;
   }
}
