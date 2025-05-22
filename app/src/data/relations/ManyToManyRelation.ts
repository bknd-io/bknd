import type { Static } from "core/utils";
import type { ExpressionBuilder } from "kysely";
import { Entity, type EntityManager } from "../entities";
import { type Field, PrimaryField } from "../fields";
import type { RepoQuery } from "../server/query";
import { EntityRelation, type KyselyQueryBuilder } from "./EntityRelation";
import { EntityRelationAnchor } from "./EntityRelationAnchor";
import { RelationField } from "./RelationField";
import { type RelationType, RelationTypes } from "./relation-types";
import * as tbbox from "@sinclair/typebox";
const { Type } = tbbox;

export type ManyToManyRelationConfig = Static<typeof ManyToManyRelation.schema>;

export class ManyToManyRelation extends EntityRelation<typeof ManyToManyRelation.schema> {
   connectionEntity: Entity;
   additionalFields: Field[] = [];
   connectionTableMappedName: string;
   private em?: EntityManager<any>;

   static override schema = Type.Composite(
      [
         EntityRelation.schema,
         Type.Object({
            connectionTable: Type.Optional(Type.String()),
            connectionTableMappedName: Type.Optional(Type.String()),
         }),
      ],
      {
         additionalProperties: false,
      },
   );

   constructor(
      source: Entity,
      target: Entity,
      config?: ManyToManyRelationConfig,
      additionalFields?: Field[],
   ) {
      const connectionTable =
         config?.connectionTable || ManyToManyRelation.defaultConnectionTable(source, target);

      const sourceAnchor = new EntityRelationAnchor(source, source.name);
      const targetAnchor = new EntityRelationAnchor(target, target.name);
      super(sourceAnchor, targetAnchor, config);

      this.connectionEntity = new Entity(connectionTable, additionalFields, undefined, "generated");

      this.connectionTableMappedName = config?.connectionTableMappedName || connectionTable;
      this.additionalFields = additionalFields || [];
   }

   static defaultConnectionTable(source: Entity, target: Entity) {
      return `${source.name}_${target.name}`;
   }

   type(): RelationType {
      return RelationTypes.ManyToMany;
   }

   /**
    * Many to many is always listable in both directions
    */
   override isListableFor(): boolean {
      return true;
   }

   getField(entity: Entity): RelationField {
      const conn = this.connectionEntity;
      const selfField = conn.fields.find(
         (f) => f instanceof RelationField && f.target() === entity.name,
      )!;

      if (!selfField || !(selfField instanceof RelationField)) {
         throw new Error(
            `Connection entity "${conn.name}" does not have a relation to "${entity.name}"`,
         );
      }

      return selfField;
   }

   protected getQueryInfo(entity: Entity) {
      const other = this.other(entity);
      const conn = this.connectionEntity;
      const entityField = this.getField(entity);
      const otherField = this.getField(other.entity);

      const entityRef = `${entity.name}.${entity.getPrimaryField().name}`;
      const selfRef = `${conn.name}.${entityField.name}`;
      const otherRef = `${conn.name}.${otherField.name}`;

      const join = [
         conn.name,
         `${other.entity.name}.${other.entity.getPrimaryField().name}`,
         otherRef,
      ] as const;

      const groupBy = `${entity.name}.${entity.getPrimaryField().name}`;

      return {
         other,
         join,
         entityRef,
         selfRef,
         otherRef,
         groupBy,
      };
   }

   override getReferenceQuery(entity: Entity, id: number): Partial<RepoQuery> {
      const { other, otherRef } = this.getQueryInfo(entity);

      return {
         where: {
            [otherRef]: id,
         },
         join: [other.reference],
      };
   }

   buildJoin(entity: Entity, qb: KyselyQueryBuilder) {
      const { other, join, entityRef, selfRef, groupBy } = this.getQueryInfo(entity);

      return qb
         .innerJoin(other.entity.name, entityRef, selfRef)
         .innerJoin(...join)
         .groupBy(groupBy);
   }

   buildWith(entity: Entity) {
      if (!this.em) {
         throw new Error("EntityManager not set, can't build");
      }
      const jsonBuildObject = this.em.connection.fn.jsonBuildObject;
      if (!jsonBuildObject) {
         throw new Error("Connection does not support jsonBuildObject");
      }

      const limit = 5;
      const { other, join, entityRef, selfRef } = this.getQueryInfo(entity);
      const additionalFields = this.connectionEntity.fields.filter(
         (f) => !(f instanceof RelationField || f instanceof PrimaryField),
      );

      return (eb: ExpressionBuilder<any, any>) =>
         eb
            .selectFrom(other.entity.name)
            .select((eb2) => {
               const select: any[] = [];
               if (additionalFields.length > 0) {
                  const conn = this.connectionEntity.name;
                  select.push(
                     jsonBuildObject(
                        Object.fromEntries(
                           additionalFields.map((f) => [f.name, eb2.ref(`${conn}.${f.name}`)]),
                        ),
                     ).as(this.connectionTableMappedName),
                  );
               }

               return select;
            })
            .whereRef(entityRef, "=", selfRef)
            .innerJoin(...join)
            .limit(limit);
   }

   initialize(em: EntityManager<any>) {
      this.em = em;

      const sourceField = RelationField.create(this, this.source);
      const targetField = RelationField.create(this, this.target);

      if (em.hasEntity(this.connectionEntity)) {
         // @todo: also check for correct signatures of field
         if (!this.connectionEntity.hasField(sourceField)) {
            this.connectionEntity.addField(sourceField);
         }
         if (!this.connectionEntity.hasField(targetField)) {
            this.connectionEntity.addField(targetField);
         }
      } else {
         this.connectionEntity.addField(sourceField);
         this.connectionEntity.addField(targetField);
         em.addEntity(this.connectionEntity);
      }
   }

   override getName(): string {
      return [
         super.getName(),
         [this.connectionEntity.name, this.connectionTableMappedName].filter(Boolean),
      ].join("_");
   }
}
