import { dayjs, $console, s } from "bknd/utils";
import type { EntityManager } from "../entities";
import { Field, type TActionContext, type TRenderContext, baseFieldConfigSchema } from "./Field";
import type { TFieldTSType } from "data/entities/EntityTypescript";

export const dateFieldConfigSchema = s
   .strictObject({
      type: s.string({ enum: ["date", "datetime", "week"], default: "date" }),
      timezone: s.string(),
      min_date: s.string(),
      max_date: s.string(),
      ...baseFieldConfigSchema.properties,
   })
   .partial();

export type DateFieldConfig = s.Static<typeof dateFieldConfigSchema>;

export class DateField<Required extends true | false = false> extends Field<
   DateFieldConfig,
   Date,
   Required
> {
   override readonly type = "date";

   protected getSchema() {
      return dateFieldConfigSchema;
   }

   override schema() {
      return Object.freeze({
         ...super.schema()!,
         type: this.config.type === "datetime" ? "datetime" : "date",
      });
   }

   override getHtmlConfig() {
      const htmlType = this.config.type === "datetime" ? "datetime-local" : this.config.type;

      return {
         ...super.getHtmlConfig(),
         element: "date",
         props: {
            type: htmlType,
         },
      };
   }

   private parseDateFromString(value: string): Date {
      if (this.config.type === "week" && value.includes("-W")) {
         const [year, week] = value.split("-W").map((n) => Number.parseInt(n, 10)) as [
            number,
            number,
         ];
         // @ts-ignore causes errors on build?
         return dayjs().year(year).week(week).toDate();
      }

      return new Date(value);
   }

   override getValue(value: string, context?: TRenderContext): string | undefined {
      if (value === null || !value) return;
      const date = this.parseDateFromString(value);

      if (context === "submit") {
         try {
            return date.toISOString();
         } catch (e) {
            return undefined;
         }
      }

      if (this.config.type === "week") {
         try {
            return `${date.getFullYear()}-W${dayjs(date).week()}`;
         } catch (e) {
            $console.warn("DateField.getValue:week error", value, String(e));
            return;
         }
      }

      try {
         const utc = new Date();
         const offset = utc.getTimezoneOffset();
         //console.log("offset", offset);
         const local = new Date(date.getTime() - offset * 60000);

         return this.formatDate(local);
      } catch (e) {
         $console.warn("DateField.getValue error", this.config.type, value, String(e));
         return;
      }
   }

   formatDate(_date: Date): string {
      switch (this.config.type) {
         case "datetime":
            return _date.toISOString().split(".")[0]!.replace("T", " ");
         default:
            return _date.toISOString().split("T")[0]!;
         /*case "week": {
            const date = dayjs(_date);
            return `${date.year()}-W${date.week()}`;
         }*/
      }
   }

   override transformRetrieve(_value: string): Date | null {
      const value = super.transformRetrieve(_value);
      if (value === null) return null;

      try {
         return new Date(value);
      } catch (e) {
         return null;
      }
   }

   override async transformPersist(
      _value: any,
      em: EntityManager<any>,
      context: TActionContext,
   ): Promise<string | undefined> {
      const value = await super.transformPersist(_value, em, context);
      if (this.nullish(value)) return value;

      switch (this.config.type) {
         case "date":
         case "week":
            return new Date(value).toISOString().split("T")[0]!;
         default:
            return new Date(value).toISOString();
      }
   }

   // @todo: check this
   override toJsonSchema() {
      return this.toSchemaWrapIfRequired(s.string({ default: this.getDefault() }));
   }

   override toType(): TFieldTSType {
      return {
         ...super.toType(),
         type: "Date | string",
      };
   }
}
