import { type Static, StringEnum, Type, dayjs } from "core/utils";
import type { EntityManager } from "../entities";
import { Field, type TActionContext, type TRenderContext, baseFieldConfigSchema } from "./Field";

export const dateFieldConfigSchema = Type.Composite(
   [
      Type.Object({
         //default_value: Type.Optional(Type.Date()),
         type: StringEnum(["date", "datetime", "week"] as const, { default: "date" }),
         timezone: Type.Optional(Type.String()),
         min_date: Type.Optional(Type.String()),
         max_date: Type.Optional(Type.String()),
      }),
      baseFieldConfigSchema,
   ],
   {
      additionalProperties: false,
   },
);

export type DateFieldConfig = Static<typeof dateFieldConfigSchema>;

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
      //console.log("parseDateFromString", value);
      if (this.config.type === "week" && value.includes("-W")) {
         const [year, week] = value.split("-W").map((n) => Number.parseInt(n, 10)) as [
            number,
            number,
         ];
         //console.log({ year, week });
         // @ts-ignore causes errors on build?
         return dayjs().year(year).week(week).toDate();
      }

      return new Date(value);
   }

   override getValue(value: string, context?: TRenderContext): string | undefined {
      if (value === null || !value) return;
      //console.log("getValue", { value, context });
      const date = this.parseDateFromString(value);
      //console.log("getValue.date", date);

      if (context === "submit") {
         try {
            return date.toISOString();
         } catch (e) {
            //console.warn("DateField.getValue:value/submit", value, e);
            return undefined;
         }
      }

      if (this.config.type === "week") {
         try {
            return `${date.getFullYear()}-W${dayjs(date).week()}`;
         } catch (e) {
            console.warn("error - DateField.getValue:week", value, e);
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
         console.warn("DateField.getValue:value", value);
         console.warn("DateField.getValue:e", e);
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
      //console.log("transformRetrieve DateField", _value);
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

      //console.log("transformPersist DateField", value);
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
      return this.toSchemaWrapIfRequired(Type.String({ default: this.getDefault() }));
   }
}
