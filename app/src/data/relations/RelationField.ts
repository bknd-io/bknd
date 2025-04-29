import { type Static, StringEnum } from "core/utils";
import type { EntityManager } from "../entities";
import { Field, baseFieldConfigSchema } from "../fields";
import type { EntityRelation } from "./EntityRelation";
import type { EntityRelationAnchor } from "./EntityRelationAnchor";
import * as tbbox from "@sinclair/typebox";
import type { TFieldTSType } from "data/entities/EntityTypescript";
const { Type } = tbbox;

const CASCADES = ["cascade", "set null", "set default", "restrict", "no action"] as const;

export const relationFieldConfigSchema = Type.Composite([
   baseFieldConfigSchema,
   Type.Object({
      reference: Type.String(),
      target: Type.String(), // @todo: potentially has to be an instance!
      target_field: Type.Optional(Type.String({ default: "id" })),
      on_delete: Type.Optional(StringEnum(CASCADES, { default: "set null" })),
   }),
]);

export type RelationFieldConfig = Static<typeof relationFieldConfigSchema>;
export type RelationFieldBaseConfig = { label?: string };

export class RelationField extends Field<RelationFieldConfig> {
   override readonly type = "relation";

   protected getSchema() {
      return relationFieldConfigSchema;
   }

   static create(
      relation: EntityRelation,
      target: EntityRelationAnchor,
      config?: RelationFieldBaseConfig,
   ) {
      const name = [
         target.reference ?? target.entity.name,
         target.entity.getPrimaryField().name,
      ].join("_");

      return new RelationField(name, {
         ...config,
         required: relation.required,
         reference: target.reference,
         target: target.entity.name,
         target_field: target.entity.getPrimaryField().name,
      });
   }

   reference() {
      return this.config.reference;
   }

   target() {
      return this.config.target;
   }

   targetField(): string {
      return this.config.target_field!;
   }

   override schema() {
      return Object.freeze({
         ...super.schema()!,
         type: "integer",
         references: `${this.config.target}.${this.config.target_field}`,
         onDelete: this.config.on_delete ?? "set null",
      });
   }

   override transformRetrieve(value: any): any {
      return value;
   }

   override async transformPersist(value: any, em: EntityManager<any>): Promise<any> {
      throw new Error("RelationField: This function should not be called");
   }

   override toJsonSchema() {
      return this.toSchemaWrapIfRequired(
         Type.Number({
            $ref: `${this.config?.target}#/properties/${this.config?.target_field}`,
         }),
      );
   }

   override toType(): TFieldTSType {
      return {
         ...super.toType(),
         type: "number",
      };
   }
}
