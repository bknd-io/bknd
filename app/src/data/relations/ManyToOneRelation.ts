import type { PrimaryFieldType } from "bknd";
import { snakeToPascalWithSpaces, s } from "bknd/utils";
import type { ExpressionBuilder } from "kysely";
import type { Entity, EntityManager } from "../entities";
import type { RepoQuery } from "../server/query";
import { EntityRelation, type KyselyQueryBuilder } from "./EntityRelation";
import { EntityRelationAnchor } from "./EntityRelationAnchor";
import { RelationField, type RelationFieldBaseConfig } from "./RelationField";
import type { MutationInstructionResponse } from "./RelationMutator";
import { type RelationType, RelationTypes } from "./relation-types";

/**
 * Source entity receives the mapping field
 *
 * Many-to-one (many) [sources] has (one) [target]
 * Example: [posts] has (one) [user]
 *    posts gets a users_id field
 */

export type ManyToOneRelationConfig = s.Static<typeof ManyToOneRelation.schema>;

export class ManyToOneRelation extends EntityRelation<typeof ManyToOneRelation.schema> {
   private fieldConfig?: RelationFieldBaseConfig;
   static DEFAULTS = {
      with_limit: 5,
   };

   static override schema = s.strictObject({
      sourceCardinality: s.number().optional(),
      with_limit: s.number({ default: ManyToOneRelation.DEFAULTS.with_limit }).optional(),
      fieldConfig: s
         .object({
            label: s.string(),
         })
         .optional(),
      ...EntityRelation.schema.properties,
   });

   constructor(
      source: Entity,
      target: Entity,
      config: Partial<s.Static<typeof ManyToOneRelation.schema>> = {},
   ) {
      const mappedBy = config.mappedBy || target.name;
      const inversedBy = config.inversedBy || source.name;

      // if source can be multiple, allow it. otherwise unlimited
      const sourceCardinality =
         typeof config.sourceCardinality === "number" && config.sourceCardinality > 0
            ? config.sourceCardinality
            : undefined;
      const sourceAnchor = new EntityRelationAnchor(source, inversedBy, sourceCardinality);
      const targetAnchor = new EntityRelationAnchor(target, mappedBy, 1);
      super(sourceAnchor, targetAnchor, config);

      this.fieldConfig = config.fieldConfig ?? {};
      // set relation required or not
      //this.required = !!config.required;
   }

   type(): RelationType {
      return RelationTypes.ManyToOne;
   }

   override initialize(em: EntityManager<any>) {
      const defaultLabel = snakeToPascalWithSpaces(this.target.reference);

      // add required mapping field on source
      const field = RelationField.create(this, this.target, {
         label: defaultLabel,
         ...this.fieldConfig,
      });

      if (!this.source.entity.field(field.name)) {
         this.source.entity.addField(
            RelationField.create(this, this.target, {
               label: defaultLabel,
               ...this.fieldConfig,
            }),
         );
      }
   }

   /**
    * Retrieve the RelationField
    */
   getField(): RelationField {
      const id = this.target.entity.getPrimaryField().name;
      const field = this.source.entity.getField(`${this.target.reference}_${id}`);

      if (!(field instanceof RelationField)) {
         throw new Error(
            `Field "${this.target.reference}_${id}" not found on entity "${this.source.entity.name}"`,
         );
      }

      return field;
   }

   protected queryInfo(entity: Entity, reference: string) {
      const side = this.source.reference === reference ? "source" : "target";
      const self = this[side];
      const other = this[side === "source" ? "target" : "source"];
      let relationRef: string;
      let entityRef: string;
      let otherRef: string;
      if (side === "source") {
         relationRef = this.source.reference;
         entityRef = `${relationRef}.${this.getField().name}`;
         otherRef = `${entity.name}.${self.entity.getPrimaryField().name}`;
      } else {
         relationRef = this.target.reference;
         entityRef = `${relationRef}.${entity.getPrimaryField().name}`;
         otherRef = `${entity.name}.${this.getField().name}`;
      }

      const groupBy = `${entity.name}.${entity.getPrimaryField().name}`;

      return {
         other,
         self,
         relationRef,
         entityRef,
         otherRef,
         groupBy,
      };
   }

   override getReferenceQuery(entity: Entity, id: number, reference: string): Partial<RepoQuery> {
      const side = this.source.reference === reference ? "source" : "target";
      const self = this[side];
      const other = this[side === "source" ? "target" : "source"];
      const otherRef = `${other.reference}_${other.entity.getPrimaryField().name}`;

      return {
         where: {
            [otherRef]: id,
         },
         join: other.entity.name === self.entity.name ? [] : [other.entity.name],
      };
   }

   buildJoin(entity: Entity, qb: KyselyQueryBuilder, reference: string) {
      const { self, entityRef, otherRef, groupBy } = this.queryInfo(entity, reference);
      return qb.innerJoin(self.entity.name, entityRef, otherRef).groupBy(groupBy);
   }

   buildWith(entity: Entity, reference: string) {
      const { self, entityRef, otherRef, relationRef } = this.queryInfo(entity, reference);

      return (eb: ExpressionBuilder<any, any>) =>
         eb
            .selectFrom(`${self.entity.name} as ${relationRef}`)
            .whereRef(entityRef, "=", otherRef)
            .$if(self.cardinality === 1, (qb) => qb.limit(1));
   }

   /**
    * $set is performed using the reference:
    * { [reference]: { $set: { id: 1 } } }
    *
    * It must resolve from [reference] ("users") to field ("user_id")
    * -> returns instructions
    */
   override async $set(
      em: EntityManager<any>,
      key: string,
      value: object,
   ): Promise<void | MutationInstructionResponse> {
      if (typeof value !== "object") {
         throw new Error(`Invalid value for relation field "${key}" given, expected object.`);
      }

      const entity = this.source.entity;
      const helper = this.helper(entity.name);
      const info = helper.getMutationInfo();
      if (!info.$set) {
         throw new Error(`Cannot perform $set for relation "${key}"`);
      }

      const local_field = info.local_field;
      const field = this.getField();
      // @ts-ignore
      const primaryReference = value[Object.keys(value)[0]] as PrimaryFieldType;

      if (!local_field || !(field instanceof RelationField)) {
         throw new Error(`Cannot perform $set for relation "${key}"`);
      }

      // if "{ $set: { id: null } }" given, and not required, allow it
      if (primaryReference === null && !field.isRequired()) {
         return [local_field, null] satisfies MutationInstructionResponse;
      }

      const query = await em.repository(field.target()).exists({
         [field.targetField()]: primaryReference as any,
      });

      if (!query.data.exists) {
         const idProp = field.targetField();
         throw new Error(
            `Cannot connect "${entity.name}.${key}" to ` +
               `"${field.target()}.${idProp}" = "${primaryReference}": not found.`,
         );
      }

      return [local_field, primaryReference] satisfies MutationInstructionResponse;
   }
}
