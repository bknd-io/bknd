import {
   parse,
   snakeToPascalWithSpaces,
   type Static,
   StringEnum,
   type TSchema,
   TypeInvalidError,
} from "core/utils";
import type { HTMLInputTypeAttribute, InputHTMLAttributes } from "react";
import type { EntityManager } from "../entities";
import { InvalidFieldConfigException, TransformPersistFailedException } from "../errors";
import type { FieldSpec } from "data/connection/Connection";
import * as tbbox from "@sinclair/typebox";
import type { TFieldTSType } from "data/entities/EntityTypescript";
const { Type } = tbbox;

// @todo: contexts need to be reworked
// e.g. "table" is irrelevant, because if read is not given, it fails

export const ActionContext = ["create", "read", "update", "delete"] as const;
export type TActionContext = (typeof ActionContext)[number];

export const RenderContext = ["form", "table", "read", "submit"] as const;
export type TRenderContext = (typeof RenderContext)[number];

const TmpContext = ["create", "read", "update", "delete", "form", "table", "submit"] as const;
export type TmpActionAndRenderContext = (typeof TmpContext)[number];

const DEFAULT_REQUIRED = false;
const DEFAULT_FILLABLE = true;
const DEFAULT_HIDDEN = false;

// @todo: add refine functions (e.g. if required, but not fillable, needs default value)
export const baseFieldConfigSchema = Type.Object(
   {
      label: Type.Optional(Type.String()),
      description: Type.Optional(Type.String()),
      required: Type.Optional(Type.Boolean({ default: DEFAULT_REQUIRED })),
      fillable: Type.Optional(
         Type.Union(
            [
               Type.Boolean({ title: "Boolean", default: DEFAULT_FILLABLE }),
               Type.Array(StringEnum(ActionContext), { title: "Context", uniqueItems: true }),
            ],
            {
               default: DEFAULT_FILLABLE,
            },
         ),
      ),
      hidden: Type.Optional(
         Type.Union(
            [
               Type.Boolean({ title: "Boolean", default: DEFAULT_HIDDEN }),
               // @todo: tmp workaround
               Type.Array(StringEnum(TmpContext), { title: "Context", uniqueItems: true }),
            ],
            {
               default: DEFAULT_HIDDEN,
            },
         ),
      ),
      // if field is virtual, it will not call transformPersist & transformRetrieve
      virtual: Type.Optional(Type.Boolean()),
      default_value: Type.Optional(Type.Any()),
   },
   {
      additionalProperties: false,
   },
);
export type BaseFieldConfig = Static<typeof baseFieldConfigSchema>;

export abstract class Field<
   Config extends BaseFieldConfig = BaseFieldConfig,
   Type = any,
   Required extends true | false = false,
> {
   _required!: Required;
   _type!: Type;

   /**
    * Property name that gets persisted on database
    */
   readonly name: string;
   readonly type: string = "field";
   readonly config: Config;

   constructor(name: string, config?: Partial<Config>) {
      this.name = name;
      this._type;
      this._required;

      try {
         this.config = parse(this.getSchema(), config || {}) as Config;
      } catch (e) {
         if (e instanceof TypeInvalidError) {
            throw new InvalidFieldConfigException(this, config, e);
         }

         throw e;
      }
   }

   getType() {
      return this.type;
   }

   protected abstract getSchema(): TSchema;

   /**
    * Used in SchemaManager.ts
    * @param em
    */
   schema(): FieldSpec | undefined {
      return Object.freeze({
         name: this.name,
         type: "text",
         nullable: true,
         dflt: this.getDefault(),
      });
   }

   hasDefault() {
      return this.config.default_value !== undefined;
   }

   getDefault() {
      return this.config?.default_value;
   }

   isFillable(context?: TActionContext): boolean {
      if (Array.isArray(this.config.fillable)) {
         return context ? this.config.fillable.includes(context) : DEFAULT_FILLABLE;
      }
      return !!this.config.fillable;
   }

   isHidden(context?: TmpActionAndRenderContext): boolean {
      if (Array.isArray(this.config.hidden)) {
         return context ? this.config.hidden.includes(context as any) : DEFAULT_HIDDEN;
      }
      return this.config.hidden ?? false;
   }

   isRequired(): boolean {
      return this.config?.required ?? false;
   }

   /**
    * Virtual fields are not persisted or retrieved from database
    * Used for MediaField, to add specifics about uploads, etc.
    */
   isVirtual(): boolean {
      return this.config.virtual ?? false;
   }

   getLabel(options?: { fallback?: boolean }): string | undefined {
      return this.config.label
         ? this.config.label
         : options?.fallback !== false
           ? snakeToPascalWithSpaces(this.name)
           : undefined;
   }

   getDescription(): string | undefined {
      return this.config.description;
   }

   /**
    * [GET] DB -> field.transformRetrieve -> [sent]
    *   table: form.getValue("table")
    *   form: form.getValue("form") -> modified -> form.getValue("submit") -> [sent]
    *
    * [PATCH] body parse json -> field.transformPersist -> [stored]
    *
    * @param value
    * @param context
    */
   getValue(value: any, context?: TRenderContext) {
      return value;
   }

   getHtmlConfig(): { element: HTMLInputTypeAttribute | string; props?: InputHTMLAttributes<any> } {
      return {
         element: "input",
         props: { type: "text" },
      };
   }

   // @todo: add field level validation
   isValid(value: any, context: TActionContext): boolean {
      if (typeof value !== "undefined") {
         return this.isFillable(context);
      } else if (context === "create") {
         return !this.isRequired();
      }
      return true;
   }

   /**
    * Transform value after retrieving from database
    * @param value
    */
   transformRetrieve(value: any): any {
      return value;
   }

   /**
    * Transform value before persisting to database
    * @param value
    * @param em EntityManager (optional, for relation fields)
    */
   async transformPersist(
      value: unknown,
      em: EntityManager<any>,
      context: TActionContext,
   ): Promise<any> {
      if (this.nullish(value)) {
         if (this.isRequired() && !this.hasDefault()) {
            throw TransformPersistFailedException.required(this.name);
         }
         return this.getDefault();
      }

      return value;
   }

   protected toSchemaWrapIfRequired<Schema extends TSchema>(schema: Schema) {
      return this.isRequired() ? schema : Type.Optional(schema);
   }

   protected nullish(value: any) {
      return value === null || value === undefined;
   }

   toJsonSchema(): TSchema {
      return this.toSchemaWrapIfRequired(Type.Any());
   }

   toType(): TFieldTSType {
      return {
         required: this.isRequired(),
         comment: this.getDescription(),
         type: "any",
      };
   }

   toJSON() {
      return {
         // @todo: current workaround because of fixed string type
         type: this.type as any,
         config: this.config,
      };
   }
}
